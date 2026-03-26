package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// ── ListAlerts ─────────────────────────────────────────────────────────────

func TestListAlerts_NilDB_ReturnsEmptyArray(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/alerts/", nil)
	w := httptest.NewRecorder()
	h.ListAlerts(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	assertEmptyArray(t, w.Body.Bytes())
}

func TestListAlerts_NilDB_WithFilters_StillReturnsEmpty(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet,
		"/api/alerts/?status=active&type=down&endpoint_id=some-id", nil)
	w := httptest.NewRecorder()
	h.ListAlerts(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
}

// ── ResolveAlert ───────────────────────────────────────────────────────────

func TestResolveAlert_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPut, "/", "id", "alert-id-1")
	w := httptest.NewRecorder()
	h.ResolveAlert(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
	assertErrorField(t, w.Body.Bytes())
}

// ── alertRow JSON shape ────────────────────────────────────────────────────

func TestAlertRow_JSONFields(t *testing.T) {
	a := alertRow{
		ID:           "id-1",
		EndpointID:   "ep-1",
		EndpointName: "My Service",
		Type:         "down",
		Status:       "active",
		Message:      "Service is down",
		RuleType:     "down",
		RuleDetail:   "3 consecutive failures",
		CreatedAt:    "2024-01-01T00:00:00Z",
	}
	b, err := json.Marshal(a)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var m map[string]any
	_ = json.Unmarshal(b, &m)

	for _, field := range []string{
		"id", "endpoint_id", "endpoint_name", "type", "status",
		"message", "rule_type", "rule_detail", "created_at",
	} {
		if _, ok := m[field]; !ok {
			t.Errorf("missing field %q in alertRow JSON", field)
		}
	}
	// resolved_at should be omitted when nil
	if _, ok := m["resolved_at"]; ok {
		t.Error("resolved_at should be omitted when nil")
	}
}

func TestAlertRow_ResolvedAt_Present(t *testing.T) {
	ts := "2024-06-01T12:00:00Z"
	a := alertRow{
		ID:         "id-2",
		Status:     "resolved",
		CreatedAt:  "2024-06-01T10:00:00Z",
		ResolvedAt: &ts,
	}
	b, _ := json.Marshal(a)
	var m map[string]any
	_ = json.Unmarshal(b, &m)

	v, ok := m["resolved_at"]
	if !ok {
		t.Fatal("resolved_at should be present when set")
	}
	if v.(string) != ts {
		t.Errorf("resolved_at: want %q, got %q", ts, v)
	}
}

func TestAlertRow_TypeValues(t *testing.T) {
	for _, typ := range []string{"down", "slow", "status"} {
		a := alertRow{Type: typ, CreatedAt: time.Now().UTC().Format(time.RFC3339)}
		b, err := json.Marshal(a)
		if err != nil {
			t.Fatalf("marshal type=%q: %v", typ, err)
		}
		var m map[string]any
		_ = json.Unmarshal(b, &m)
		if m["type"] != typ {
			t.Errorf("type: want %q, got %v", typ, m["type"])
		}
	}
}

// ── ListAlerts: query parameter handling ──────────────────────────────────

func TestListAlerts_LimitAndOffset_QueryParams(t *testing.T) {
	h := newNilHandler()
	// With nil DB returns [] regardless of params — just verify no panic + 200
	for _, url := range []string{
		"/api/alerts/?limit=0",
		"/api/alerts/?limit=300",
		"/api/alerts/?limit=-1",
		"/api/alerts/?offset=-5",
		"/api/alerts/?limit=10&offset=20",
	} {
		req := httptest.NewRequest(http.MethodGet, url, nil)
		w := httptest.NewRecorder()
		h.ListAlerts(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("url=%q: want 200, got %d", url, w.Code)
		}
	}
}

func TestListAlerts_StatusFilter_QueryParam(t *testing.T) {
	h := newNilHandler()
	for _, status := range []string{"active", "resolved", ""} {
		req := httptest.NewRequest(http.MethodGet, "/api/alerts/?status="+status, nil)
		w := httptest.NewRecorder()
		h.ListAlerts(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("status=%q: want 200, got %d", status, w.Code)
		}
		assertEmptyArray(t, w.Body.Bytes())
	}
}

func TestListAlerts_TypeFilter_QueryParam(t *testing.T) {
	h := newNilHandler()
	for _, typ := range []string{"down", "slow", "status", ""} {
		req := httptest.NewRequest(http.MethodGet, "/api/alerts/?type="+typ, nil)
		w := httptest.NewRecorder()
		h.ListAlerts(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("type=%q: want 200, got %d", typ, w.Code)
		}
	}
}

func TestListAlerts_ContentTypeIsJSON(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/alerts/", nil)
	w := httptest.NewRecorder()
	h.ListAlerts(w, req)

	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("want Content-Type=application/json, got %q", ct)
	}
}

// ── ResolveAlert ──────────────────────────────────────────────────────────

func TestResolveAlert_EmptyID_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPut, "/", "id", "")
	w := httptest.NewRecorder()
	h.ResolveAlert(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

func TestResolveAlert_ContentTypeIsJSON(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPut, "/", "id", "some-id")
	w := httptest.NewRecorder()
	h.ResolveAlert(w, req)

	ct := w.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("want Content-Type=application/json, got %q", ct)
	}
}
