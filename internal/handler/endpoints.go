package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"overclipse/Sandhilux/internal/service/checker"
)

var errNoDB = errors.New("database not connected")

type endpointCreateRequest struct {
	Name             string            `json:"name"`
	URL              string            `json:"url"`
	Method           string            `json:"method"`
	Headers          map[string]string `json:"headers,omitempty"`
	Body             string            `json:"body,omitempty"`
	CheckInterval    int               `json:"check_interval"`
	Timeout          int               `json:"timeout"`
	ExpectedStatus   *int              `json:"expected_status,omitempty"`
	LatencyThreshold *int              `json:"latency_threshold,omitempty"`
	FollowRedirects  bool              `json:"follow_redirects"`
	Enabled          bool              `json:"enabled"`
}

type alertRuleCreateRequest struct {
	Type             string `json:"type"`
	Threshold        *int   `json:"threshold,omitempty"`
	ConsecutiveFails *int   `json:"consecutive_fails,omitempty"`
}

type endpointRow struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	URL              string            `json:"url"`
	Method           string            `json:"method"`
	Headers          map[string]string `json:"headers"`
	Body             string            `json:"body"`
	CheckInterval    int               `json:"check_interval"`
	Timeout          int               `json:"timeout"`
	ExpectedStatus   *int              `json:"expected_status,omitempty"`
	LatencyThreshold *int              `json:"latency_threshold,omitempty"`
	FollowRedirects  bool              `json:"follow_redirects"`
	Enabled          bool              `json:"enabled"`
	Status           string            `json:"status"`
	Uptime24h        float64           `json:"uptime_24h"`
	AvgLatency       int               `json:"avg_latency"`
	LastCheckedAt    string            `json:"last_checked_at"`
	CreatedAt        string            `json:"created_at"`
}

// endpointScanner abstracts pgx.Row and pgx.Rows to a single Scan interface.
type endpointScanner interface {
	Scan(dest ...any) error
}

func scanEndpoint(s endpointScanner) (endpointRow, error) {
	var ep endpointRow
	var headersJSON []byte
	var lastCheckedAt, createdAt time.Time
	err := s.Scan(
		&ep.ID, &ep.Name, &ep.URL, &ep.Method, &headersJSON, &ep.Body,
		&ep.CheckInterval, &ep.Timeout, &ep.ExpectedStatus, &ep.LatencyThreshold,
		&ep.FollowRedirects, &ep.Enabled, &ep.Status, &ep.Uptime24h, &ep.AvgLatency,
		&lastCheckedAt, &createdAt,
	)
	if err != nil {
		return ep, err
	}
	if len(headersJSON) > 0 {
		_ = json.Unmarshal(headersJSON, &ep.Headers)
	}
	if ep.Headers == nil {
		ep.Headers = map[string]string{}
	}
	ep.LastCheckedAt = lastCheckedAt.UTC().Format(time.RFC3339)
	ep.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return ep, nil
}

const endpointSelectCols = `
	id::text, name, url, method, headers, body,
	check_interval, timeout, expected_status, latency_threshold,
	follow_redirects, enabled, status, uptime_24h, avg_latency,
	last_checked_at, created_at`

// ListEndpoints — GET /api/endpoints
func (h *Handler) ListEndpoints(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		ok(w, []any{})
		return
	}
	rows, err := h.PG.Query(r.Context(),
		`SELECT `+endpointSelectCols+` FROM endpoints ORDER BY created_at DESC`)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	result := []endpointRow{}
	for rows.Next() {
		ep, err := scanEndpoint(rows)
		if err != nil {
			internalError(w, err)
			return
		}
		result = append(result, ep)
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}
	ok(w, result)
}

// CreateEndpoint — POST /api/endpoints
func (h *Handler) CreateEndpoint(w http.ResponseWriter, r *http.Request) {
	var req endpointCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "invalid request body")
		return
	}
	if req.Name == "" || req.URL == "" {
		badRequest(w, "name and url are required")
		return
	}
	if err := validateEndpointURL(req.URL); err != nil {
		badRequest(w, "invalid url: "+err.Error())
		return
	}
	if req.Method == "" {
		req.Method = "GET"
	}
	switch req.Method {
	case "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS":
	default:
		badRequest(w, "unsupported HTTP method")
		return
	}
	if req.CheckInterval == 0 {
		req.CheckInterval = 60
	}
	if req.Timeout == 0 {
		req.Timeout = 10
	}
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}

	headersJSON, _ := json.Marshal(req.Headers)
	claims := claimsFromCtx(r.Context())
	var userID *string
	if claims != nil {
		if _, err := uuid.Parse(claims.UserID); err == nil {
			userID = &claims.UserID
		}
	}

	row := h.PG.QueryRow(r.Context(), `
		INSERT INTO endpoints
		    (user_id, name, url, method, headers, body, check_interval, timeout,
		     expected_status, latency_threshold, follow_redirects, enabled)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING `+endpointSelectCols,
		userID, req.Name, req.URL, req.Method, headersJSON, req.Body,
		req.CheckInterval, req.Timeout, req.ExpectedStatus, req.LatencyThreshold,
		req.FollowRedirects, req.Enabled,
	)
	ep, err := scanEndpoint(row)
	if err != nil {
		internalError(w, err)
		return
	}
	created(w, ep)
}

// GetEndpoint — GET /api/endpoints/{id}
func (h *Handler) GetEndpoint(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}
	row := h.PG.QueryRow(r.Context(),
		`SELECT `+endpointSelectCols+` FROM endpoints WHERE id = $1`, id)
	ep, err := scanEndpoint(row)
	if err != nil {
		notFound(w)
		return
	}
	ok(w, ep)
}

// UpdateEndpoint — PUT /api/endpoints/{id}
func (h *Handler) UpdateEndpoint(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req endpointCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "invalid request body")
		return
	}
	if req.URL != "" {
		if err := validateEndpointURL(req.URL); err != nil {
			badRequest(w, "invalid url: "+err.Error())
			return
		}
	}
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}
	headersJSON, _ := json.Marshal(req.Headers)

	row := h.PG.QueryRow(r.Context(), `
		UPDATE endpoints SET
		    name = $2, url = $3, method = $4, headers = $5, body = $6,
		    check_interval = $7, timeout = $8,
		    expected_status = $9, latency_threshold = $10,
		    follow_redirects = $11, enabled = $12
		WHERE id = $1
		RETURNING `+endpointSelectCols,
		id, req.Name, req.URL, req.Method, headersJSON, req.Body,
		req.CheckInterval, req.Timeout, req.ExpectedStatus, req.LatencyThreshold,
		req.FollowRedirects, req.Enabled,
	)
	ep, err := scanEndpoint(row)
	if err != nil {
		notFound(w)
		return
	}
	ok(w, ep)
}

// ToggleEndpoint — PATCH /api/endpoints/{id}/toggle
func (h *Handler) ToggleEndpoint(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}
	row := h.PG.QueryRow(r.Context(), `
		UPDATE endpoints SET enabled = NOT enabled WHERE id = $1
		RETURNING `+endpointSelectCols, id)
	ep, err := scanEndpoint(row)
	if err != nil {
		notFound(w)
		return
	}
	ok(w, ep)
}

// DeleteEndpoint — DELETE /api/endpoints/{id}
func (h *Handler) DeleteEndpoint(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}
	_, err := h.PG.Exec(r.Context(), `DELETE FROM endpoints WHERE id = $1`, id)
	if err != nil {
		internalError(w, err)
		return
	}
	noContent(w)
}

// CheckEndpointNow — POST /api/endpoints/{id}/check
func (h *Handler) CheckEndpointNow(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}

	var ep checker.Endpoint
	var headersJSON []byte
	err := h.PG.QueryRow(r.Context(), `
		SELECT id::text, name, url, method, headers, body,
		       check_interval, timeout,
		       COALESCE(expected_status, 0), COALESCE(latency_threshold, 0),
		       follow_redirects
		FROM endpoints WHERE id = $1
	`, id).Scan(
		&ep.ID, &ep.Name, &ep.URL, &ep.Method, &headersJSON, &ep.Body,
		&ep.CheckInterval, &ep.Timeout, &ep.ExpectedStatus, &ep.LatencyThreshold,
		&ep.FollowRedirects,
	)
	if err != nil {
		notFound(w)
		return
	}
	if len(headersJSON) > 0 {
		_ = json.Unmarshal(headersJSON, &ep.Headers)
	}

	event := h.Checker.ProbeOne(r.Context(), ep)
	ok(w, event)
}

// ListRules — GET /api/endpoints/{id}/rules
func (h *Handler) ListRules(w http.ResponseWriter, r *http.Request) {
	endpointID := chi.URLParam(r, "id")
	if h.PG == nil {
		ok(w, []any{})
		return
	}
	rows, err := h.PG.Query(r.Context(), `
		SELECT id::text, endpoint_id::text, type, threshold, consecutive_fails,
		       created_at
		FROM alert_rules WHERE endpoint_id = $1 ORDER BY created_at
	`, endpointID)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type ruleRow struct {
		ID               string `json:"id"`
		EndpointID       string `json:"endpoint_id"`
		Type             string `json:"type"`
		Threshold        *int   `json:"threshold,omitempty"`
		ConsecutiveFails *int   `json:"consecutive_fails,omitempty"`
		CreatedAt        string `json:"created_at"`
	}
	result := []ruleRow{}
	for rows.Next() {
		var rule ruleRow
		var createdAt time.Time
		if err := rows.Scan(&rule.ID, &rule.EndpointID, &rule.Type,
			&rule.Threshold, &rule.ConsecutiveFails, &createdAt); err != nil {
			internalError(w, err)
			return
		}
		rule.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		result = append(result, rule)
	}
	ok(w, result)
}

// CreateRule — POST /api/endpoints/{id}/rules
func (h *Handler) CreateRule(w http.ResponseWriter, r *http.Request) {
	endpointID := chi.URLParam(r, "id")
	var req alertRuleCreateRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "invalid request body")
		return
	}
	if req.Type == "" {
		badRequest(w, "type is required")
		return
	}
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}

	var id string
	var createdAt time.Time
	err := h.PG.QueryRow(r.Context(), `
		INSERT INTO alert_rules (endpoint_id, type, threshold, consecutive_fails)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text, created_at
	`, endpointID, req.Type, req.Threshold, req.ConsecutiveFails,
	).Scan(&id, &createdAt)
	if err != nil {
		internalError(w, err)
		return
	}
	created(w, map[string]any{
		"id":                id,
		"endpoint_id":       endpointID,
		"type":              req.Type,
		"threshold":         req.Threshold,
		"consecutive_fails": req.ConsecutiveFails,
		"created_at":        createdAt.UTC().Format(time.RFC3339),
	})
}

// DeleteRule — DELETE /api/endpoints/{id}/rules/{ruleID}
func (h *Handler) DeleteRule(w http.ResponseWriter, r *http.Request) {
	ruleID := chi.URLParam(r, "ruleID")
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}
	_, err := h.PG.Exec(r.Context(), `DELETE FROM alert_rules WHERE id = $1`, ruleID)
	if err != nil {
		internalError(w, err)
		return
	}
	noContent(w)
}

// GetHistory — GET /api/endpoints/{id}/history?limit=50&offset=0
func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	endpointID := chi.URLParam(r, "id")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit == 0 || limit > 200 {
		limit = 50
	}

	if h.PG == nil {
		ok(w, []any{})
		return
	}

	rows, err := h.PG.Query(r.Context(), `
		SELECT id, endpoint_id, is_up, status, status_code, latency_ms, error, checked_at
		FROM check_records
		WHERE endpoint_id = $1
		ORDER BY checked_at DESC
		LIMIT $2 OFFSET $3
	`, endpointID, limit, offset)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type record struct {
		ID         string `json:"id"`
		EndpointID string `json:"endpoint_id"`
		IsUp       bool   `json:"is_up"`
		Status     string `json:"status"`
		StatusCode int    `json:"status_code"`
		LatencyMs  int    `json:"latency_ms"`
		Error      string `json:"error"`
		CheckedAt  string `json:"checked_at"`
	}
	result := []record{}
	for rows.Next() {
		var rec record
		var checkedAt time.Time
		if err := rows.Scan(&rec.ID, &rec.EndpointID, &rec.IsUp, &rec.Status,
			&rec.StatusCode, &rec.LatencyMs, &rec.Error, &checkedAt); err != nil {
			internalError(w, err)
			return
		}
		rec.CheckedAt = checkedAt.UTC().Format(time.RFC3339)
		result = append(result, rec)
	}
	ok(w, result)
}

// GetStats — GET /api/endpoints/{id}/stats
func (h *Handler) GetStats(w http.ResponseWriter, r *http.Request) {
	endpointID := chi.URLParam(r, "id")

	type statsResponse struct {
		P50Latency  float64 `json:"p50_latency"`
		P95Latency  float64 `json:"p95_latency"`
		Incidents7d int64   `json:"incidents_7d"`
		ChecksToday int64   `json:"checks_today"`
	}

	if h.PG == nil {
		ok(w, statsResponse{})
		return
	}

	var stats statsResponse
	err := h.PG.QueryRow(r.Context(), `
		SELECT
		    COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms), 0),
		    COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0),
		    COUNT(*) FILTER (WHERE status IN ('down', 'slow')),
		    COUNT(*) FILTER (WHERE checked_at::date = CURRENT_DATE)
		FROM check_records
		WHERE endpoint_id = $1 AND checked_at >= NOW() - INTERVAL '7 days'
	`, endpointID).Scan(&stats.P50Latency, &stats.P95Latency, &stats.Incidents7d, &stats.ChecksToday)
	if err != nil {
		internalError(w, err)
		return
	}
	ok(w, stats)
}
