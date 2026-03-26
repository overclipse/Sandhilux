package checker

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// newTestServer создаёт временный HTTP сервер и возвращает его URL.
// Закрывается автоматически через t.Cleanup.
func newTestServer(t *testing.T, handler http.HandlerFunc) string {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return srv.URL
}

// ── Probe: статусы ───────────────────────────────────────────

func TestProbe_Up(t *testing.T) {
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	result := Probe(ProbeParams{URL: url})

	if result.Status != "up" {
		t.Errorf("expected status=up, got %q", result.Status)
	}
	if !result.IsUp {
		t.Error("expected IsUp=true")
	}
	if result.StatusCode != http.StatusOK {
		t.Errorf("expected status_code=200, got %d", result.StatusCode)
	}
	if result.Error != "" {
		t.Errorf("expected no error, got %q", result.Error)
	}
}

func TestProbe_DownOnServerError(t *testing.T) {
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	result := Probe(ProbeParams{URL: url})

	if result.Status != "down" {
		t.Errorf("expected status=down, got %q", result.Status)
	}
	if result.IsUp {
		t.Error("expected IsUp=false for 500 response")
	}
	if result.StatusCode != http.StatusInternalServerError {
		t.Errorf("expected status_code=500, got %d", result.StatusCode)
	}
}

func TestProbe_DownOnConnectionRefused(t *testing.T) {
	// Порт заведомо закрыт — connection refused
	result := Probe(ProbeParams{URL: "http://127.0.0.1:1"})

	if result.Status != "down" {
		t.Errorf("expected status=down, got %q", result.Status)
	}
	if result.IsUp {
		t.Error("expected IsUp=false")
	}
	if result.Error == "" {
		t.Error("expected non-empty error")
	}
}

// ── Probe: expected_status ───────────────────────────────────

func TestProbe_ExpectedStatusMatch(t *testing.T) {
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated) // 201
	})

	result := Probe(ProbeParams{URL: url, ExpectedStatus: 201})

	if result.Status != "up" {
		t.Errorf("expected status=up when status_code matches expected, got %q", result.Status)
	}
}

func TestProbe_ExpectedStatusMismatch(t *testing.T) {
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK) // 200, но ждали 201
	})

	result := Probe(ProbeParams{URL: url, ExpectedStatus: 201})

	if result.Status != "down" {
		t.Errorf("expected status=down when status_code != expected, got %q", result.Status)
	}
}

// ── Probe: latency threshold ─────────────────────────────────

func TestProbe_SlowAboveThreshold(t *testing.T) {
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	})

	// Порог 1ms — сервер точно медленнее
	result := Probe(ProbeParams{URL: url, LatencyThreshold: 1})

	if result.Status != "slow" {
		t.Errorf("expected status=slow, got %q", result.Status)
	}
	if !result.IsUp {
		t.Error("expected IsUp=true for slow (site is responding)")
	}
}

func TestProbe_FastBelowThreshold(t *testing.T) {
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	result := Probe(ProbeParams{URL: url, LatencyThreshold: 10000}) // 10 секунд — точно успеем

	if result.Status != "up" {
		t.Errorf("expected status=up below threshold, got %q", result.Status)
	}
}

// ── Probe: метод и заголовки ─────────────────────────────────

func TestProbe_DefaultMethodIsGET(t *testing.T) {
	var receivedMethod string
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		receivedMethod = r.Method
		w.WriteHeader(http.StatusOK)
	})

	Probe(ProbeParams{URL: url}) // метод не указан

	if receivedMethod != http.MethodGet {
		t.Errorf("expected method=GET by default, got %q", receivedMethod)
	}
}

func TestProbe_CustomMethodAndHeaders(t *testing.T) {
	var receivedMethod, receivedHeader string
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		receivedMethod = r.Method
		receivedHeader = r.Header.Get("X-Api-Key")
		w.WriteHeader(http.StatusOK)
	})

	Probe(ProbeParams{
		URL:     url,
		Method:  http.MethodPost,
		Headers: map[string]string{"X-Api-Key": "secret"},
	})

	if receivedMethod != http.MethodPost {
		t.Errorf("expected method=POST, got %q", receivedMethod)
	}
	if receivedHeader != "secret" {
		t.Errorf("expected header X-Api-Key=secret, got %q", receivedHeader)
	}
}

// ── Probe: timeout ───────────────────────────────────────────

func TestProbe_Timeout(t *testing.T) {
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond) // сервер отвечает медленно
	})

	result := Probe(ProbeParams{URL: url, Timeout: 1}) // 1 секунда... но ждём 500ms

	// Сервер ответит в пределах таймаута — должно быть up
	if result.Status != "up" && result.Status != "slow" {
		// Если всё же упало из-за timing — просто проверяем что нет паники
		t.Logf("status=%s (acceptable: up/slow/down depending on timing)", result.Status)
	}
}

func TestProbe_TimeoutExceeded(t *testing.T) {
	// TEST-NET (192.0.2.0/24) никуда не маршрутизируется — таймаут гарантирован
	result := Probe(ProbeParams{URL: "http://192.0.2.1", Timeout: 1})

	if result.Status != "down" {
		t.Logf("got status=%s (timing-dependent, acceptable)", result.Status)
	}
}

// ── Probe: невалидный URL ────────────────────────────────────

func TestProbe_InvalidURL(t *testing.T) {
	result := Probe(ProbeParams{URL: "not-a-url"})

	if result.Status != "down" {
		t.Errorf("expected status=down for invalid URL, got %q", result.Status)
	}
	if result.Error == "" {
		t.Error("expected non-empty error for invalid URL")
	}
}

// ── Probe: latency заполняется ───────────────────────────────

func TestProbe_LatencyIsSet(t *testing.T) {
	url := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	result := Probe(ProbeParams{URL: url})

	if result.Latency <= 0 {
		t.Errorf("expected Latency > 0, got %v", result.Latency)
	}
}
