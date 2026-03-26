package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// ── GetOverview ────────────────────────────────────────────────────────────

func TestGetOverview_NilDB_ReturnsZeroOverview(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/metrics/overview", nil)
	w := httptest.NewRecorder()
	h.GetOverview(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	for _, field := range []string{
		"total_endpoints", "online_endpoints",
		"avg_uptime_24h", "avg_latency", "active_alerts",
	} {
		if _, ok := body[field]; !ok {
			t.Errorf("missing field %q in response", field)
		}
	}
}

// ── GetDashboardLatency ────────────────────────────────────────────────────

func TestGetDashboardLatency_NilCH_ReturnsEmptyArray(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/metrics/latency", nil)
	w := httptest.NewRecorder()
	h.GetDashboardLatency(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	assertEmptyArray(t, w.Body.Bytes())
}

// ── GetDashboardUptime ─────────────────────────────────────────────────────

func TestGetDashboardUptime_NilCH_ReturnsEmptyArray(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/metrics/uptime", nil)
	w := httptest.NewRecorder()
	h.GetDashboardUptime(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	assertEmptyArray(t, w.Body.Bytes())
}

// ── GetEndpointLatency ─────────────────────────────────────────────────────

func TestGetEndpointLatency_NilCH_ReturnsEmptyArray(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodGet, "/", "id", "some-id")
	w := httptest.NewRecorder()
	h.GetEndpointLatency(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	assertEmptyArray(t, w.Body.Bytes())
}

func TestGetEndpointLatency_PeriodParam(t *testing.T) {
	h := newNilHandler()
	for _, period := range []string{"24h", "7d", "30d", ""} {
		t.Run("period="+period, func(t *testing.T) {
			req := chiRequest(http.MethodGet, "/?period="+period, "id", "ep-1")
			w := httptest.NewRecorder()
			h.GetEndpointLatency(w, req)
			if w.Code != http.StatusOK {
				t.Errorf("period=%q: want 200, got %d", period, w.Code)
			}
		})
	}
}

// ── GetEndpointUptime ──────────────────────────────────────────────────────

func TestGetEndpointUptime_NilCH_ReturnsEmptyArray(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodGet, "/", "id", "some-id")
	w := httptest.NewRecorder()
	h.GetEndpointUptime(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	assertEmptyArray(t, w.Body.Bytes())
}

// ── helpers ────────────────────────────────────────────────────────────────

func assertEmptyArray(t *testing.T, body []byte) {
	t.Helper()
	var result []any
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatalf("assertEmptyArray: decode body: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("want empty array, got %d items", len(result))
	}
}
