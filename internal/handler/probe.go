package handler

import (
	"net/http"
	"time"

	"overclipse/Sandhilux/internal/service/checker"
)

// ProbeURL — GET /api/probe?url=https://example.com
//
// Быстрая одноразовая проверка любого URL без регистрации эндпоинта в БД.
// Не требует path-параметра и тела запроса — только query-параметр url.
// Использует те же SSRF-фильтры, что и CreateEndpoint.
func (h *Handler) ProbeURL(w http.ResponseWriter, r *http.Request) {
	rawURL := r.URL.Query().Get("url")
	if rawURL == "" {
		badRequest(w, "url query parameter is required")
		return
	}
	if err := validateEndpointURL(rawURL); err != nil {
		badRequest(w, err.Error())
		return
	}

	result := checker.Probe(checker.ProbeParams{
		Method:  "GET",
		URL:     rawURL,
		Timeout: 10,
	})

	ok(w, map[string]any{
		"url":        rawURL,
		"is_up":      result.IsUp,
		"status":     result.Status,
		"status_code": result.StatusCode,
		"latency_ms": int(result.Latency.Milliseconds()),
		"dns_ms":     int(result.DNSTime.Milliseconds()),
		"conn_ms":    int(result.ConnTime.Milliseconds()),
		"tls_ms":     int(result.TLSTime.Milliseconds()),
		"ttfb_ms":    int(result.TTFB.Milliseconds()),
		"error":      result.Error,
		"checked_at": time.Now().UTC().Format(time.RFC3339),
	})
}
