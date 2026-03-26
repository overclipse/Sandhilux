package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ── ListEndpoints ──────────────────────────────────────────────────────────

func TestListEndpoints_NilDB_ReturnsEmptyArray(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/endpoints/", nil)
	w := httptest.NewRecorder()
	h.ListEndpoints(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	var result []any
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("want empty array, got %d items", len(result))
	}
}

// ── CreateEndpoint ─────────────────────────────────────────────────────────

func TestCreateEndpoint_MissingName_Returns400(t *testing.T) {
	h := newNilHandler()
	body := `{"url":"https://example.com"}`
	req := httptest.NewRequest(http.MethodPost, "/api/endpoints/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.CreateEndpoint(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
	assertErrorField(t, w.Body.Bytes())
}

func TestCreateEndpoint_MissingURL_Returns400(t *testing.T) {
	h := newNilHandler()
	body := `{"name":"My Service"}`
	req := httptest.NewRequest(http.MethodPost, "/api/endpoints/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.CreateEndpoint(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
}

func TestCreateEndpoint_InvalidJSON_Returns400(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/endpoints/", strings.NewReader("{bad json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.CreateEndpoint(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
}

func TestCreateEndpoint_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	body := `{"name":"Svc","url":"https://example.com","enabled":true}`
	req := httptest.NewRequest(http.MethodPost, "/api/endpoints/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.CreateEndpoint(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ── GetEndpoint ────────────────────────────────────────────────────────────

func TestGetEndpoint_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodGet, "/api/endpoints/some-id", "id", "some-id")
	w := httptest.NewRecorder()
	h.GetEndpoint(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ── UpdateEndpoint ─────────────────────────────────────────────────────────

func TestUpdateEndpoint_InvalidJSON_Returns400(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPut, "/", "id", "some-id")
	req.Body = http.NoBody
	req = withBody(req, "{not json")
	w := httptest.NewRecorder()
	h.UpdateEndpoint(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
}

func TestUpdateEndpoint_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPut, "/", "id", "some-id")
	req = withBody(req, `{"name":"x","url":"https://x.com"}`)
	w := httptest.NewRecorder()
	h.UpdateEndpoint(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ── DeleteEndpoint ─────────────────────────────────────────────────────────

func TestDeleteEndpoint_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodDelete, "/", "id", "some-id")
	w := httptest.NewRecorder()
	h.DeleteEndpoint(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ── ToggleEndpoint ────────────────────────────────────────────────────────

func TestToggleEndpoint_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPatch, "/", "id", "some-id")
	w := httptest.NewRecorder()
	h.ToggleEndpoint(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ── CheckEndpointNow ───────────────────────────────────────────────────────

func TestCheckEndpointNow_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPost, "/", "id", "some-id")
	w := httptest.NewRecorder()
	h.CheckEndpointNow(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ── ListRules ──────────────────────────────────────────────────────────────

func TestListRules_NilDB_ReturnsEmptyArray(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodGet, "/", "id", "some-id")
	w := httptest.NewRecorder()
	h.ListRules(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	var result []any
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("want empty array, got %d items", len(result))
	}
}

// ── CreateRule ─────────────────────────────────────────────────────────────

func TestCreateRule_MissingType_Returns400(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPost, "/", "id", "some-id")
	req = withBody(req, `{"notify_telegram":false}`)
	w := httptest.NewRecorder()
	h.CreateRule(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
}

func TestCreateRule_InvalidJSON_Returns400(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPost, "/", "id", "some-id")
	req = withBody(req, "not json")
	w := httptest.NewRecorder()
	h.CreateRule(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
}

func TestCreateRule_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPost, "/", "id", "some-id")
	req = withBody(req, `{"type":"down"}`)
	w := httptest.NewRecorder()
	h.CreateRule(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ── GetHistory ─────────────────────────────────────────────────────────────

func TestGetHistory_NilCH_ReturnsEmptyArray(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodGet, "/", "id", "some-id")
	w := httptest.NewRecorder()
	h.GetHistory(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	var result []any
	if err := json.NewDecoder(w.Body).Decode(&result); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("want empty array, got %d items", len(result))
	}
}

// ── GetStats ───────────────────────────────────────────────────────────────

func TestGetStats_NilCH_ReturnsZeroStats(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodGet, "/", "id", "some-id")
	w := httptest.NewRecorder()
	h.GetStats(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	for _, field := range []string{"p50_latency", "p95_latency", "incidents_7d", "checks_today"} {
		if _, ok := body[field]; !ok {
			t.Errorf("missing field %q in response", field)
		}
	}
}

// ── helpers ────────────────────────────────────────────────────────────────

// assertErrorField checks the JSON body has an "error" key.
func assertErrorField(t *testing.T, body []byte) {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		t.Fatalf("assertErrorField: decode body: %v", err)
	}
	if _, ok := m["error"]; !ok {
		t.Errorf("response body missing \"error\" field: %s", body)
	}
}
