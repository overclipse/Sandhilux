package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
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
	// Verify that alertRow serialises all expected fields
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
