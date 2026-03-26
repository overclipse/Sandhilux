package handler

import (
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

type updateRoleRequest struct {
	Role string `json:"role"`
}

// ListUsers — GET /api/settings/users
func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		ok(w, []any{})
		return
	}

	rows, err := h.PG.Query(r.Context(), `
		SELECT id::text, email, name, avatar_url, role, created_at
		FROM users ORDER BY created_at ASC
	`)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	type userRow struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
		Role      string `json:"role"`
		CreatedAt string `json:"created_at"`
	}
	result := []userRow{}
	for rows.Next() {
		var u userRow
		var createdAt time.Time
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.AvatarURL, &u.Role, &createdAt); err != nil {
			internalError(w, err)
			return
		}
		u.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		result = append(result, u)
	}
	ok(w, result)
}

// UpdateUserRole — PUT /api/settings/users/{id}/role
func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req updateRoleRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "invalid request body")
		return
	}
	if req.Role != "admin" && req.Role != "viewer" {
		badRequest(w, "role must be admin or viewer")
		return
	}
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}

	tag, err := h.PG.Exec(r.Context(),
		`UPDATE users SET role = $2 WHERE id = $1`, id, req.Role)
	if err != nil {
		internalError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		notFound(w)
		return
	}
	ok(w, map[string]any{"id": id, "role": req.Role})
}

// RemoveUser — DELETE /api/settings/users/{id}
func (h *Handler) RemoveUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if claims := claimsFromCtx(r.Context()); claims != nil && claims.UserID == id {
		badRequest(w, "cannot remove yourself")
		return
	}
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}
	_, err := h.PG.Exec(r.Context(), `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		internalError(w, err)
		return
	}
	noContent(w)
}

// ChangePassword — PUT /api/settings/password
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromCtx(r.Context())
	if claims == nil {
		unauthorized(w)
		return
	}
	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "invalid request body")
		return
	}
	if req.CurrentPassword == "" || req.NewPassword == "" {
		badRequest(w, "current_password and new_password are required")
		return
	}
	if len(req.NewPassword) < 8 {
		badRequest(w, "new_password must be at least 8 characters")
		return
	}
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}

	var currentHash string
	if err := h.PG.QueryRow(r.Context(), `SELECT password_hash FROM users WHERE id = $1`, claims.UserID).Scan(&currentHash); err != nil {
		unauthorized(w)
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(currentHash), []byte(req.CurrentPassword)); err != nil {
		unauthorized(w)
		return
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		internalError(w, fmt.Errorf("hash password: %w", err))
		return
	}

	if _, err := h.PG.Exec(r.Context(), `UPDATE users SET password_hash = $2 WHERE id = $1`, claims.UserID, string(newHash)); err != nil {
		internalError(w, err)
		return
	}
	noContent(w)
}
