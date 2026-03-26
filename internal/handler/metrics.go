package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// periodIntervals maps validated period strings to PostgreSQL INTERVAL values.
// Whitelist prevents SQL injection via the period query parameter.
var periodIntervals = map[string]string{
	"1h":  "1 hour",
	"24h": "24 hours",
	"7d":  "7 days",
	"30d": "30 days",
}

// dashboardPeriods — allowed periods for dashboard endpoints.
var dashboardPeriods = map[string]string{
	"24h": "24 hours",
	"7d":  "7 days",
	"30d": "30 days",
}

// parseDashboardPeriod returns the PG interval string for the given period param.
func parseDashboardPeriod(r *http.Request) string {
	if v, ok := dashboardPeriods[r.URL.Query().Get("period")]; ok {
		return v
	}
	return "24 hours"
}

// GetOverview — GET /api/metrics/overview?period=24h|7d|30d
func (h *Handler) GetOverview(w http.ResponseWriter, r *http.Request) {
	type overview struct {
		TotalEndpoints  int     `json:"total_endpoints"`
		OnlineEndpoints int     `json:"online_endpoints"`
		AvgUptime       float64 `json:"avg_uptime_24h"`
		AvgLatency      float64 `json:"avg_latency"`
		ActiveAlerts    int     `json:"active_alerts"`
		UptimeTrend     float64 `json:"uptime_trend"`
		LatencyTrend    float64 `json:"latency_trend"`
	}

	if h.PG == nil {
		ok(w, overview{})
		return
	}

	interval := parseDashboardPeriod(r)

	var res overview
	// Endpoint counts are period-independent
	err := h.PG.QueryRow(r.Context(), `
		SELECT
		    COUNT(*)                                    AS total,
		    COUNT(*) FILTER (WHERE status = 'up')      AS online
		FROM endpoints
		WHERE enabled = true
	`).Scan(&res.TotalEndpoints, &res.OnlineEndpoints)
	if err != nil {
		internalError(w, err)
		return
	}

	// Avg uptime & latency from check_records over the selected period
	_ = h.PG.QueryRow(r.Context(), fmt.Sprintf(`
		SELECT
		    COALESCE(AVG(is_up::int) * 100, 0),
		    COALESCE(AVG(latency_ms), 0)
		FROM check_records
		WHERE checked_at >= NOW() - INTERVAL '%s'
	`, interval)).Scan(&res.AvgUptime, &res.AvgLatency)

	_ = h.PG.QueryRow(r.Context(),
		`SELECT COUNT(*) FROM alerts WHERE status = 'active'`,
	).Scan(&res.ActiveAlerts)

	// Trends: current period vs previous period of the same length
	var prevUptime, currUptime float64
	_ = h.PG.QueryRow(r.Context(), fmt.Sprintf(`
		SELECT
		    COALESCE(AVG(CASE WHEN checked_at >= NOW() - INTERVAL '%[1]s' * 2
		                       AND checked_at <  NOW() - INTERVAL '%[1]s'
		                  THEN is_up::int END) * 100, 0),
		    COALESCE(AVG(CASE WHEN checked_at >= NOW() - INTERVAL '%[1]s'
		                  THEN is_up::int END) * 100, 0)
		FROM check_records
		WHERE checked_at >= NOW() - INTERVAL '%[1]s' * 2
	`, interval)).Scan(&prevUptime, &currUptime)
	res.UptimeTrend = currUptime - prevUptime

	var prevLatency, currLatency float64
	_ = h.PG.QueryRow(r.Context(), fmt.Sprintf(`
		SELECT
		    COALESCE(AVG(CASE WHEN checked_at >= NOW() - INTERVAL '%[1]s' * 2
		                       AND checked_at <  NOW() - INTERVAL '%[1]s'
		                  THEN latency_ms END), 0),
		    COALESCE(AVG(CASE WHEN checked_at >= NOW() - INTERVAL '%[1]s'
		                  THEN latency_ms END), 0)
		FROM check_records
		WHERE checked_at >= NOW() - INTERVAL '%[1]s' * 2
	`, interval)).Scan(&prevLatency, &currLatency)
	if prevLatency > 0 {
		res.LatencyTrend = ((currLatency - prevLatency) / prevLatency) * 100
	}

	ok(w, res)
}

// GetDashboardLatency — GET /api/metrics/latency?period=24h|7d|30d
func (h *Handler) GetDashboardLatency(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		ok(w, []any{})
		return
	}

	interval := parseDashboardPeriod(r)

	// Choose bucket granularity: 24h→hour, 7d→4h, 30d→day
	var trunc string
	switch interval {
	case "7 days":
		trunc = "hour"
	case "30 days":
		trunc = "day"
	default:
		trunc = "hour"
	}

	rows, err := h.PG.Query(r.Context(), fmt.Sprintf(`
		SELECT date_trunc('%s', checked_at) AS bucket, AVG(latency_ms) AS avg_latency
		FROM check_records
		WHERE checked_at >= NOW() - INTERVAL '%s'
		GROUP BY bucket
		ORDER BY bucket ASC
	`, trunc, interval))
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type point struct {
		Time    string  `json:"time"`
		Latency float64 `json:"latency"`
	}
	result := []point{}
	for rows.Next() {
		var p point
		var t time.Time
		if err := rows.Scan(&t, &p.Latency); err != nil {
			internalError(w, err)
			return
		}
		p.Time = t.UTC().Format(time.RFC3339)
		result = append(result, p)
	}
	ok(w, result)
}

// GetDashboardUptime — GET /api/metrics/uptime?period=7d|30d
func (h *Handler) GetDashboardUptime(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		ok(w, []any{})
		return
	}

	interval := parseDashboardPeriod(r)

	rows, err := h.PG.Query(r.Context(), fmt.Sprintf(`
		SELECT checked_at::date AS day, AVG(is_up::int) * 100 AS uptime_pct
		FROM check_records
		WHERE checked_at >= NOW() - INTERVAL '%s'
		GROUP BY day
		ORDER BY day ASC
	`, interval))
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type point struct {
		Date   string  `json:"date"`
		Uptime float64 `json:"uptime"`
	}
	result := []point{}
	for rows.Next() {
		var p point
		var d time.Time
		if err := rows.Scan(&d, &p.Uptime); err != nil {
			internalError(w, err)
			return
		}
		p.Date = d.UTC().Format("2006-01-02")
		result = append(result, p)
	}
	ok(w, result)
}

// GetWorstEndpoints — GET /api/metrics/worst?period=24h&limit=5
// Returns endpoints with the lowest uptime in the given period.
func (h *Handler) GetWorstEndpoints(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		ok(w, []any{})
		return
	}

	interval := parseDashboardPeriod(r)

	rows, err := h.PG.Query(r.Context(), fmt.Sprintf(`
		SELECT e.id, e.name, e.url, e.status,
		       COALESCE(AVG(cr.is_up::int) * 100, 100) AS uptime
		FROM endpoints e
		LEFT JOIN check_records cr
		    ON cr.endpoint_id = e.id AND cr.checked_at >= NOW() - INTERVAL '%s'
		WHERE e.enabled = true
		GROUP BY e.id, e.name, e.url, e.status
		ORDER BY uptime ASC
		LIMIT 5
	`, interval))
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type item struct {
		ID     string  `json:"id"`
		Name   string  `json:"name"`
		URL    string  `json:"url"`
		Status string  `json:"status"`
		Uptime float64 `json:"uptime"`
	}
	result := []item{}
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ID, &it.Name, &it.URL, &it.Status, &it.Uptime); err != nil {
			internalError(w, err)
			return
		}
		result = append(result, it)
	}
	ok(w, result)
}

// GetRecentIncidents — GET /api/metrics/incidents?limit=5
// Returns the most recent alerts (resolved or active).
func (h *Handler) GetRecentIncidents(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		ok(w, []any{})
		return
	}

	rows, err := h.PG.Query(r.Context(), `
		SELECT id, endpoint_id, endpoint_name, type, status, message,
		       created_at, resolved_at
		FROM alerts
		ORDER BY created_at DESC
		LIMIT 10
	`)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type incident struct {
		ID           string  `json:"id"`
		EndpointID   string  `json:"endpoint_id"`
		EndpointName string  `json:"endpoint_name"`
		Type         string  `json:"type"`
		Status       string  `json:"status"`
		Message      string  `json:"message"`
		CreatedAt    string  `json:"created_at"`
		ResolvedAt   *string `json:"resolved_at"`
	}
	result := []incident{}
	for rows.Next() {
		var it incident
		var createdAt time.Time
		var resolvedAt *time.Time
		if err := rows.Scan(&it.ID, &it.EndpointID, &it.EndpointName,
			&it.Type, &it.Status, &it.Message, &createdAt, &resolvedAt); err != nil {
			internalError(w, err)
			return
		}
		it.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if resolvedAt != nil {
			s := resolvedAt.UTC().Format(time.RFC3339)
			it.ResolvedAt = &s
		}
		result = append(result, it)
	}
	ok(w, result)
}

// GetEndpointTimeline — GET /api/metrics/{id}/timeline?period=24h
// Returns status segments for an endpoint (up/down/slow intervals).
func (h *Handler) GetEndpointTimeline(w http.ResponseWriter, r *http.Request) {
	endpointID := chi.URLParam(r, "id")

	interval, valid := periodIntervals[r.URL.Query().Get("period")]
	if !valid {
		interval = "24 hours"
	}

	if h.PG == nil {
		ok(w, []any{})
		return
	}

	rows, err := h.PG.Query(r.Context(), fmt.Sprintf(`
		SELECT checked_at, status
		FROM check_records
		WHERE endpoint_id = $1 AND checked_at >= NOW() - INTERVAL '%s'
		ORDER BY checked_at ASC
	`, interval), endpointID)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type segment struct {
		Start  string `json:"start"`
		End    string `json:"end"`
		Status string `json:"status"`
	}

	var segments []segment
	var curStatus string
	var segStart, segEnd time.Time

	for rows.Next() {
		var t time.Time
		var status string
		if err := rows.Scan(&t, &status); err != nil {
			internalError(w, err)
			return
		}
		if curStatus == "" {
			curStatus = status
			segStart = t
			segEnd = t
			continue
		}
		if status != curStatus {
			segments = append(segments, segment{
				Start:  segStart.UTC().Format(time.RFC3339),
				End:    segEnd.UTC().Format(time.RFC3339),
				Status: curStatus,
			})
			curStatus = status
			segStart = t
		}
		segEnd = t
	}
	// Close last segment
	if curStatus != "" {
		segments = append(segments, segment{
			Start:  segStart.UTC().Format(time.RFC3339),
			End:    segEnd.UTC().Format(time.RFC3339),
			Status: curStatus,
		})
	}
	if segments == nil {
		segments = []segment{}
	}

	ok(w, segments)
}

// GetEndpointLatency — GET /api/metrics/{id}?period=24h
// Returns latency time-series for a single endpoint.
func (h *Handler) GetEndpointLatency(w http.ResponseWriter, r *http.Request) {
	endpointID := chi.URLParam(r, "id")

	interval, valid := periodIntervals[r.URL.Query().Get("period")]
	if !valid {
		interval = "24 hours"
	}

	if h.PG == nil {
		ok(w, []any{})
		return
	}

	rows, err := h.PG.Query(r.Context(), fmt.Sprintf(`
		SELECT checked_at, latency_ms, status_code
		FROM check_records
		WHERE endpoint_id = $1 AND checked_at >= NOW() - INTERVAL '%s'
		ORDER BY checked_at ASC
	`, interval), endpointID)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type point struct {
		Time       string `json:"time"`
		Latency    int    `json:"latency"`
		StatusCode int    `json:"status_code"`
	}
	result := []point{}
	for rows.Next() {
		var p point
		var t time.Time
		if err := rows.Scan(&t, &p.Latency, &p.StatusCode); err != nil {
			internalError(w, err)
			return
		}
		p.Time = t.UTC().Format(time.RFC3339)
		result = append(result, p)
	}
	ok(w, result)
}

// GetEndpointUptime — GET /api/metrics/{id}/uptime?period=7d
// Returns daily uptime % for a single endpoint.
func (h *Handler) GetEndpointUptime(w http.ResponseWriter, r *http.Request) {
	endpointID := chi.URLParam(r, "id")

	interval, valid := periodIntervals[r.URL.Query().Get("period")]
	if !valid {
		interval = "7 days"
	}

	if h.PG == nil {
		ok(w, []any{})
		return
	}

	rows, err := h.PG.Query(r.Context(), fmt.Sprintf(`
		SELECT checked_at::date AS day, AVG(is_up::int) * 100 AS uptime_pct
		FROM check_records
		WHERE endpoint_id = $1 AND checked_at >= NOW() - INTERVAL '%s'
		GROUP BY day
		ORDER BY day ASC
	`, interval), endpointID)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type point struct {
		Date   string  `json:"date"`
		Uptime float64 `json:"uptime"`
	}
	result := []point{}
	for rows.Next() {
		var p point
		var d time.Time
		if err := rows.Scan(&d, &p.Uptime); err != nil {
			internalError(w, err)
			return
		}
		p.Date = d.UTC().Format("2006-01-02")
		result = append(result, p)
	}
	ok(w, result)
}
