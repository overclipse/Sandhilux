// Package checker реализует фоновый воркер для периодической проверки эндпоинтов.
// Архитектура:
//
//	app.Run() → go chk.Run(ctx)   — запуск фонового цикла
//	tick()    → fetchDueEndpoints → параллельные горутины → checkOne
//	checkOne  → Probe (HTTP) → saveResult (PG) → triggerAlerts → Events (SSE канал)
package checker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Endpoint — данные эндпоинта из PostgreSQL, нужные для проверки.
type Endpoint struct {
	ID               string
	Name             string
	URL              string
	Method           string
	Headers          map[string]string
	Body             string
	CheckInterval    int
	Timeout          int
	ExpectedStatus   int
	LatencyThreshold int
	FollowRedirects  bool
}

// CheckEvent — результат одной проверки. Уходит в SSE клиентам и сохраняется в PostgreSQL.
type CheckEvent struct {
	ID         string `json:"id"`
	EndpointID string `json:"endpoint_id"`
	IsUp       bool   `json:"is_up"`
	Status     string `json:"status"`
	StatusCode int    `json:"status_code"`
	LatencyMs  int    `json:"latency_ms"`
	Error      string `json:"error"`
	CheckedAt  string `json:"checked_at"`
}

// Checker — фоновый воркер. Хранит соединение с PostgreSQL и канал событий.
type Checker struct {
	pg         *pgxpool.Pool
	Events     chan CheckEvent // буферизованный канал; SSE хендлер читает из него
	failCounts sync.Map        // endpoint_id → int: счётчик подряд идущих падений
}

// New создаёт Checker. pg может быть nil — тогда записи пропускаются.
func New(pg *pgxpool.Pool) *Checker {
	return &Checker{
		pg:     pg,
		Events: make(chan CheckEvent, 256),
	}
}

// Run запускает фоновый цикл проверок. Блокирует до отмены ctx.
// Вызывать как горутину: go chk.Run(ctx).
func (c *Checker) Run(ctx context.Context) {
	log.Println("checker: started")
	defer log.Println("checker: stopped")

	// Тик — как часто чекер смотрит "кого пора проверить".
	// Это НЕ интервал проверки каждого эндпоинта — тот задаётся в check_interval.
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	c.tick(ctx) // первая проверка сразу при старте

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.tick(ctx)
		}
	}
}

// fetchDueEndpoints возвращает эндпоинты у которых истёк интервал проверки.
// Логика "кого пора проверить" живёт в VIEW endpoints_due (001_init.sql).
func (c *Checker) fetchDueEndpoints(ctx context.Context) ([]Endpoint, error) {
	rows, err := c.pg.Query(ctx, `
		SELECT id, name, url, method, headers, body,
		       check_interval, timeout, expected_status, latency_threshold,
		       follow_redirects
		FROM endpoints_due
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var endpoints []Endpoint
	for rows.Next() {
		var ep Endpoint
		var headersJSON []byte
		if err := rows.Scan(
			&ep.ID, &ep.Name, &ep.URL, &ep.Method, &headersJSON, &ep.Body,
			&ep.CheckInterval, &ep.Timeout, &ep.ExpectedStatus, &ep.LatencyThreshold,
			&ep.FollowRedirects,
		); err != nil {
			log.Printf("checker: scan endpoint: %v", err)
			continue
		}
		if len(headersJSON) > 0 {
			_ = json.Unmarshal(headersJSON, &ep.Headers)
		}
		endpoints = append(endpoints, ep)
	}
	// rows.Err() ловит ошибки возникшие во время итерации (обрыв соединения и т.п.)
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return endpoints, nil
}

// tick — один цикл: достать эндпоинты и проверить их параллельно.
func (c *Checker) tick(ctx context.Context) {
	if c.pg == nil {
		return
	}

	endpoints, err := c.fetchDueEndpoints(ctx)
	if err != nil {
		log.Printf("checker: fetch due endpoints: %v", err)
		return
	}
	if len(endpoints) == 0 {
		return
	}

	log.Printf("checker: checking %d endpoints", len(endpoints))

	// Go 1.22+: переменная цикла ep захватывается по значению — отдельный аргумент не нужен.
	var wg sync.WaitGroup
	for _, ep := range endpoints {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c.checkOne(ctx, ep)
		}()
	}
	wg.Wait()
}

// saveResult сохраняет результат проверки в PostgreSQL (check_records + кеш endpoints).
// Единая точка записи — используется и автоматическим чекером, и ручной проверкой.
func (c *Checker) saveResult(ctx context.Context, ep Endpoint, result Result) CheckEvent {
	now := time.Now().UTC()
	latencyMs := int(result.Latency.Milliseconds())
	checkID := uuid.New().String()

	if c.pg != nil {
		// Пишем запись о проверке в time-series таблицу.
		_, err := c.pg.Exec(ctx,
			`INSERT INTO check_records (id, endpoint_id, is_up, status, status_code, latency_ms, error, checked_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			checkID, ep.ID, result.IsUp, result.Status, result.StatusCode, latencyMs, result.Error, now,
		)
		if err != nil {
			log.Printf("checker: insert check_record: %v", err)
		}

		// Обновляем кеш-поля эндпоинта (status, avg_latency, uptime_24h).
		_, err = c.pg.Exec(ctx,
			`SELECT fn_update_endpoint_check($1, $2, $3, $4)`,
			ep.ID, result.Status, latencyMs, now,
		)
		if err != nil {
			log.Printf("checker: postgres update: %v", err)
		}

		c.triggerAlerts(ctx, ep, result, latencyMs)
	}

	return CheckEvent{
		ID:         checkID,
		EndpointID: ep.ID,
		IsUp:       result.IsUp,
		Status:     result.Status,
		StatusCode: result.StatusCode,
		LatencyMs:  latencyMs,
		Error:      result.Error,
		CheckedAt:  now.Format(time.RFC3339),
	}
}

// triggerAlerts fetches alert rules for ep, evaluates conditions,
// and creates alert records in PostgreSQL when thresholds are exceeded.
func (c *Checker) triggerAlerts(ctx context.Context, ep Endpoint, result Result, latencyMs int) {
	// Update consecutive-fail counter.
	var failCount int
	if result.IsUp {
		c.failCounts.LoadAndDelete(ep.ID)
	} else {
		prev, _ := c.failCounts.LoadOrStore(ep.ID, 0)
		failCount = prev.(int) + 1
		c.failCounts.Store(ep.ID, failCount)
	}

	// Fetch alert rules for this endpoint.
	rows, err := c.pg.Query(ctx, `
		SELECT id::text, type, threshold, consecutive_fails
		FROM alert_rules WHERE endpoint_id = $1
	`, ep.ID)
	if err != nil {
		log.Printf("checker: fetch alert rules for %s: %v", ep.Name, err)
		return
	}
	defer rows.Close()

	type alertRule struct {
		ID               string
		Type             string
		Threshold        *int
		ConsecutiveFails *int
	}

	for rows.Next() {
		var rule alertRule
		if err := rows.Scan(&rule.ID, &rule.Type, &rule.Threshold,
			&rule.ConsecutiveFails); err != nil {
			log.Printf("checker: scan alert rule: %v", err)
			continue
		}

		switch rule.Type {
		case "down":
			if result.Status != "down" {
				continue
			}
			minFails := 1
			if rule.ConsecutiveFails != nil && *rule.ConsecutiveFails > 1 {
				minFails = *rule.ConsecutiveFails
			}
			if failCount < minFails {
				continue
			}
			msg := fmt.Sprintf("%s is DOWN (%d consecutive failures)", ep.Name, failCount)
			c.createAlertIfNone(ctx, ep, "down", "down",
				fmt.Sprintf("%d consecutive failures", failCount), msg)

		case "latency_gt":
			if rule.Threshold == nil || latencyMs <= *rule.Threshold {
				continue
			}
			msg := fmt.Sprintf("%s latency %dms exceeds threshold %dms", ep.Name, latencyMs, *rule.Threshold)
			c.createAlertIfNone(ctx, ep, "slow", "latency_gt",
				fmt.Sprintf(">%dms", *rule.Threshold), msg)

		case "status_code":
			// threshold = expected status code; fire if actual differs
			if rule.Threshold == nil || result.StatusCode == *rule.Threshold {
				continue
			}
			msg := fmt.Sprintf("%s returned %d (expected %d)", ep.Name, result.StatusCode, *rule.Threshold)
			c.createAlertIfNone(ctx, ep, "status", "status_code",
				fmt.Sprintf("expected %d", *rule.Threshold), msg)
		}
	}
}

// createAlertIfNone inserts an alert record only if there is no active alert
// of the same type for this endpoint. Prevents duplicate active alerts.
func (c *Checker) createAlertIfNone(
	ctx context.Context,
	ep Endpoint,
	alertType, ruleType, ruleDetail, message string,
) {
	var count int
	err := c.pg.QueryRow(ctx, `
		SELECT COUNT(*) FROM alerts
		WHERE endpoint_id = $1 AND type = $2 AND status = 'active'
	`, ep.ID, alertType).Scan(&count)
	if err != nil || count > 0 {
		return // already active, skip
	}

	_, err = c.pg.Exec(ctx, `
		INSERT INTO alerts (endpoint_id, endpoint_name, type, message, rule_type, rule_detail)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, ep.ID, ep.Name, alertType, message, ruleType, ruleDetail)
	if err != nil {
		log.Printf("checker: create alert for %s: %v", ep.Name, err)
		return
	}

	log.Printf("checker: alert [%s] created for %s: %s", alertType, ep.Name, message)
	c.sendAlertWebhook(ep, alertType, message)
}

func (c *Checker) sendAlertWebhook(ep Endpoint, alertType, message string) {
	webhookURL := os.Getenv("ALERT_WEBHOOK_URL")
	if webhookURL == "" {
		return
	}

	payload := map[string]any{
		"event":         "alert_created",
		"type":          alertType,
		"endpoint_id":   ep.ID,
		"endpoint_name": ep.Name,
		"url":           ep.URL,
		"message":       message,
		"at":            time.Now().UTC().Format(time.RFC3339),
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewReader(body))
	if err != nil {
		log.Printf("checker: webhook request build failed: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{Timeout: 5 * time.Second}).Do(req)
	if err != nil {
		log.Printf("checker: webhook send failed: %v", err)
		return
	}
	_ = resp.Body.Close()
	if resp.StatusCode >= 300 {
		log.Printf("checker: webhook returned status %d", resp.StatusCode)
	}
}

// checkOne проверяет один эндпоинт, сохраняет результат и отправляет событие в SSE канал.
func (c *Checker) checkOne(ctx context.Context, ep Endpoint) {
	result := Probe(ProbeParams{
		Method: ep.Method, URL: ep.URL, Headers: ep.Headers, Body: ep.Body,
		Timeout: ep.Timeout, ExpectedStatus: ep.ExpectedStatus, LatencyThreshold: ep.LatencyThreshold,
		FollowRedirects: ep.FollowRedirects,
	})

	event := c.saveResult(ctx, ep, result)

	// Неблокирующая отправка: если канал полный — пропускаем.
	// Лучше потерять одно SSE событие, чем заблокировать горутину чекера.
	select {
	case c.Events <- event:
	default:
	}

	log.Printf("checker: %s → %s %dms", ep.Name, result.Status, event.LatencyMs)
}

// ProbeOne выполняет разовую проверку эндпоинта по запросу из хендлера.
// Используется для POST /api/endpoints/{id}/check.
func (c *Checker) ProbeOne(ctx context.Context, ep Endpoint) CheckEvent {
	result := Probe(ProbeParams{
		Method: ep.Method, URL: ep.URL, Headers: ep.Headers, Body: ep.Body,
		Timeout: ep.Timeout, ExpectedStatus: ep.ExpectedStatus, LatencyThreshold: ep.LatencyThreshold,
		FollowRedirects: ep.FollowRedirects,
	})
	return c.saveResult(ctx, ep, result)
}
