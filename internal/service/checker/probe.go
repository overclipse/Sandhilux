package checker

import (
	"crypto/tls"
	"io"
	"net/http"
	"net/http/httptrace"
	"strings"
	"time"
)

// ── Результат одной проверки ─────────────────────────────────
// Это внутренняя структура — не уходит напрямую в БД.
// Чекер вызывает Probe(), получает Result, потом сам решает
// что писать в ClickHouse, что в PostgreSQL.

type Result struct {
	StatusCode int           // HTTP код ответа (200, 503...)
	Latency    time.Duration // общее время запроса
	DNSTime    time.Duration // время DNS резолва
	ConnTime   time.Duration // время TCP соединения
	TLSTime    time.Duration // время TLS хендшейка
	TTFB       time.Duration // Time To First Byte
	IsUp       bool          // итоговый вердикт: сайт живой?
	Status     string        // "up" | "down" | "slow"
	Error      string        // текст ошибки (если есть)
}

// ── Параметры проверки ───────────────────────────────────────
// Берутся из таблицы endpoints в PostgreSQL.

type ProbeParams struct {
	Method           string
	URL              string
	Headers          map[string]string
	Body             string
	Timeout          int  // секунды
	ExpectedStatus   int  // какой код ожидаем (0 = любой 2xx)
	LatencyThreshold int  // порог в мс (0 = без порога)
	FollowRedirects  bool // следовать ли HTTP-редиректам (301/302/…)
}

// Probe делает HTTP запрос к сайту и возвращает результат.
//
// Это чистая функция без side-effects — она НЕ пишет в БД,
// НЕ отправляет SSE, НЕ создаёт алерты. Просто проверяет и возвращает.
func Probe(p ProbeParams) Result {
	var result Result

	// ── Таймаут ──────────────────────────────────────────
	// Если в настройках эндпоинта не указан — 10 секунд по умолчанию.
	timeout := p.Timeout
	if timeout <= 0 {
		timeout = 10
	}

	// ── httptrace: засекаем время каждого этапа ──────────
	// Go вызывает эти callback-и автоматически в процессе запроса.
	var dnsStart, connStart, tlsStart, reqStart time.Time

	trace := &httptrace.ClientTrace{
		// DNS: домен → IP адрес
		DNSStart: func(_ httptrace.DNSStartInfo) {
			dnsStart = time.Now()
		},
		DNSDone: func(_ httptrace.DNSDoneInfo) {
			result.DNSTime = time.Since(dnsStart)
		},

		// TCP: установка соединения с сервером
		ConnectStart: func(_, _ string) {
			connStart = time.Now()
		},
		ConnectDone: func(_, _ string, _ error) {
			result.ConnTime = time.Since(connStart)
		},

		// TLS: шифрование (только для HTTPS)
		TLSHandshakeStart: func() {
			tlsStart = time.Now()
		},
		TLSHandshakeDone: func(_ tls.ConnectionState, _ error) {
			result.TLSTime = time.Since(tlsStart)
		},

		// TTFB: сколько ждали первый байт ответа
		GotFirstResponseByte: func() {
			result.TTFB = time.Since(reqStart)
		},
	}

	// ── Собираем HTTP запрос ─────────────────────────────
	var bodyReader io.Reader
	if p.Body != "" {
		bodyReader = strings.NewReader(p.Body)
	}

	method := p.Method
	if method == "" {
		method = http.MethodGet
	}

	req, err := http.NewRequest(method, p.URL, bodyReader)
	if err != nil {
		result.Error = err.Error()
		result.Status = "down"
		return result
	}

	// Привязываем трейс к запросу через context.
	// Теперь Go будет дёргать наши callback-и во время выполнения.
	req = req.WithContext(httptrace.WithClientTrace(req.Context(), trace))

	// Ставим кастомные заголовки (например Authorization для API)
	for k, v := range p.Headers {
		req.Header.Set(k, v)
	}

	// ── HTTP клиент ──────────────────────────────────────
	client := &http.Client{
		Timeout: time.Duration(timeout) * time.Second,
	}
	if !p.FollowRedirects {
		// Не следуем редиректам — нам важен реальный ответ
		client.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		}
	}

	// ── Выполняем запрос ─────────────────────────────────
	reqStart = time.Now()
	resp, err := client.Do(req)
	result.Latency = time.Since(reqStart)

	// Сайт не ответил вообще (таймаут, connection refused, DNS fail)
	if err != nil {
		result.Error = err.Error()
		result.Status = "down"
		result.IsUp = false
		return result
	}
	defer resp.Body.Close()

	// Читаем тело чтобы соединение могло переиспользоваться (keep-alive).
	// Без этого Go не вернёт соединение в пул.
	_, _ = io.Copy(io.Discard, resp.Body)

	result.StatusCode = resp.StatusCode

	// ── Определяем статус ────────────────────────────────
	expectedOK := false
	if p.ExpectedStatus > 0 {
		// Есть конкретный ожидаемый код
		expectedOK = resp.StatusCode == p.ExpectedStatus
	} else {
		// Нет ожидаемого кода → любой 2xx считаем OK
		expectedOK = resp.StatusCode >= 200 && resp.StatusCode < 300
	}

	latencyMs := int(result.Latency.Milliseconds())

	switch {
	case !expectedOK:
		result.Status = "down"
		result.IsUp = false
	case p.LatencyThreshold > 0 && latencyMs > p.LatencyThreshold:
		result.Status = "slow"
		result.IsUp = true // сайт отвечает, просто медленно
	default:
		result.Status = "up"
		result.IsUp = true
	}

	return result
}
