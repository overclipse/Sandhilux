package handler

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

type alertRow struct {
	ID           string  `json:"id"`
	EndpointID   string  `json:"endpoint_id"`
	EndpointName string  `json:"endpoint_name"`
	Type         string  `json:"type"`
	Status       string  `json:"status"`
	Message      string  `json:"message"`
	RuleType     string  `json:"rule_type"`
	RuleDetail   string  `json:"rule_detail"`
	CreatedAt    string  `json:"created_at"`
	ResolvedAt   *string `json:"resolved_at,omitempty"`
}

// ListAlerts — GET /api/alerts?status=active&type=down&endpoint_id=...
func (h *Handler) ListAlerts(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		ok(w, []any{})
		return
	}

	q := r.URL.Query()
	status := q.Get("status")
	alertType := q.Get("type")
	endpointID := q.Get("endpoint_id")

	rows, err := h.PG.Query(r.Context(), `
		SELECT id::text, endpoint_id::text, endpoint_name, type, status,
		       message, rule_type, rule_detail, created_at, resolved_at
		FROM alerts
		WHERE ($1 = '' OR status = $1)
		  AND ($2 = '' OR type   = $2)
		  AND ($3 = '' OR endpoint_id = $3::uuid)
		ORDER BY created_at DESC
		LIMIT 200
	`, status, alertType, endpointID)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	result := []alertRow{}
	for rows.Next() {
		var a alertRow
		var createdAt time.Time
		var resolvedAt *time.Time
		if err := rows.Scan(
			&a.ID, &a.EndpointID, &a.EndpointName, &a.Type, &a.Status,
			&a.Message, &a.RuleType, &a.RuleDetail,
			&createdAt, &resolvedAt,
		); err != nil {
			internalError(w, err)
			return
		}
		a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if resolvedAt != nil {
			s := resolvedAt.UTC().Format(time.RFC3339)
			a.ResolvedAt = &s
		}
		result = append(result, a)
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}
	ok(w, result)
}

// ResolveAlert — PUT /api/alerts/{id}/resolve
func (h *Handler) ResolveAlert(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}

	var a alertRow
	var createdAt time.Time
	var resolvedAt *time.Time
	err := h.PG.QueryRow(r.Context(), `
		UPDATE alerts
		SET status = 'resolved', resolved_at = now()
		WHERE id = $1
		RETURNING id::text, endpoint_id::text, endpoint_name, type, status,
		          message, rule_type, rule_detail, created_at, resolved_at
	`, id).Scan(
		&a.ID, &a.EndpointID, &a.EndpointName, &a.Type, &a.Status,
		&a.Message, &a.RuleType, &a.RuleDetail,
		&createdAt, &resolvedAt,
	)
	if err != nil {
		notFound(w)
		return
	}
	a.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	if resolvedAt != nil {
		s := resolvedAt.UTC().Format(time.RFC3339)
		a.ResolvedAt = &s
	}
	ok(w, a)
}
