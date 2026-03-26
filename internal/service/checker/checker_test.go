package checker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// newChecker создаёт Checker с nil БД.
// saveResult пропускает запись в PG и CH — тестируем только логику.
func newChecker() *Checker {
	return New(nil)
}

// ── ProbeOne: структура результата ───────────────────────────

func TestProbeOne_ReturnsCorrectEvent(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newChecker()
	ep := Endpoint{
		ID:     "test-id",
		Name:   "test",
		URL:    srv.URL,
		Method: http.MethodGet,
	}

	event := c.ProbeOne(context.Background(), ep)

	if event.EndpointID != ep.ID {
		t.Errorf("expected EndpointID=%q, got %q", ep.ID, event.EndpointID)
	}
	if event.Status != "up" {
		t.Errorf("expected status=up, got %q", event.Status)
	}
	if !event.IsUp {
		t.Error("expected IsUp=true")
	}
	if event.StatusCode != http.StatusOK {
		t.Errorf("expected status_code=200, got %d", event.StatusCode)
	}
	if event.ID == "" {
		t.Error("expected non-empty event ID")
	}
	if event.CheckedAt == "" {
		t.Error("expected non-empty CheckedAt")
	}
	if event.LatencyMs < 0 {
		t.Errorf("expected LatencyMs >= 0, got %d", event.LatencyMs)
	}
}

func TestProbeOne_DownEndpoint(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable) // 503
	}))
	defer srv.Close()

	c := newChecker()
	ep := Endpoint{ID: "ep-1", URL: srv.URL}

	event := c.ProbeOne(context.Background(), ep)

	if event.Status != "down" {
		t.Errorf("expected status=down, got %q", event.Status)
	}
	if event.IsUp {
		t.Error("expected IsUp=false for 503")
	}
}

func TestProbeOne_UniqueIDs(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newChecker()
	ep := Endpoint{ID: "ep-1", URL: srv.URL}

	e1 := c.ProbeOne(context.Background(), ep)
	e2 := c.ProbeOne(context.Background(), ep)

	if e1.ID == e2.ID {
		t.Error("each check must have a unique ID")
	}
}

// ── checkOne: Events канал ───────────────────────────────────

func TestCheckOne_SendsEventToChannel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newChecker()
	ep := Endpoint{ID: "ep-1", Name: "test", URL: srv.URL}

	c.checkOne(context.Background(), ep)

	select {
	case event := <-c.Events:
		if event.EndpointID != ep.ID {
			t.Errorf("expected EndpointID=%q, got %q", ep.ID, event.EndpointID)
		}
		if event.Status != "up" {
			t.Errorf("expected status=up, got %q", event.Status)
		}
	case <-time.After(time.Second):
		t.Error("timeout: no event received in channel")
	}
}

func TestCheckOne_ChannelFullDropsEvent(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c := newChecker()
	ep := Endpoint{ID: "ep-1", Name: "test", URL: srv.URL}

	// Заполняем канал до краёв
	for i := 0; i < cap(c.Events); i++ {
		c.Events <- CheckEvent{}
	}

	// checkOne не должен заблокироваться когда канал полный
	done := make(chan struct{})
	go func() {
		c.checkOne(context.Background(), ep)
		close(done)
	}()

	select {
	case <-done:
		// OK — не заблокировался
	case <-time.After(5 * time.Second):
		t.Error("checkOne blocked on full channel")
	}
}

// ── Run: старт и остановка ───────────────────────────────────

func TestRun_StopsOnContextCancel(t *testing.T) {
	c := newChecker() // pg=nil, tick() сразу выходит

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		c.Run(ctx)
		close(done)
	}()

	cancel() // отменяем контекст

	select {
	case <-done:
		// OK — Run завершился
	case <-time.After(2 * time.Second):
		t.Error("Run did not stop after context cancel")
	}
}

// ── saveResult: CheckedAt формат ─────────────────────────────

func TestSaveResult_CheckedAtIsRFC3339(t *testing.T) {
	c := newChecker()
	ep := Endpoint{ID: "ep-1"}
	result := Result{Status: "up", IsUp: true, Latency: 10 * time.Millisecond}

	event := c.saveResult(context.Background(), ep, result)

	_, err := time.Parse(time.RFC3339, event.CheckedAt)
	if err != nil {
		t.Errorf("CheckedAt is not RFC3339: %q, err: %v", event.CheckedAt, err)
	}
}

func TestSaveResult_MapsResultFields(t *testing.T) {
	c := newChecker()
	ep := Endpoint{ID: "ep-42"}
	result := Result{
		Status:     "slow",
		IsUp:       true,
		StatusCode: 200,
		Error:      "",
		Latency:    150 * time.Millisecond,
	}

	event := c.saveResult(context.Background(), ep, result)

	if event.EndpointID != "ep-42" {
		t.Errorf("EndpointID mismatch: %q", event.EndpointID)
	}
	if event.Status != "slow" {
		t.Errorf("Status mismatch: %q", event.Status)
	}
	if !event.IsUp {
		t.Error("IsUp mismatch")
	}
	if event.StatusCode != 200 {
		t.Errorf("StatusCode mismatch: %d", event.StatusCode)
	}
	if event.LatencyMs != 150 {
		t.Errorf("LatencyMs: expected 150, got %d", event.LatencyMs)
	}
}
