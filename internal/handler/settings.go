package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

type updateRoleRequest struct {
	Role string `json:"role"`
}

type telegramSettingsRequest struct {
	BotToken string `json:"bot_token"`
	ChatID   string `json:"chat_id"`
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

// GetTelegram — GET /api/settings/telegram
func (h *Handler) GetTelegram(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		ok(w, map[string]any{"bot_token": "", "chat_id": "", "configured": false})
		return
	}

	var botToken, chatID string
	err := h.PG.QueryRow(r.Context(),
		`SELECT bot_token, chat_id FROM telegram_settings WHERE id = 1`,
	).Scan(&botToken, &chatID)
	if err != nil {
		internalError(w, err)
		return
	}
	maskedToken := ""
	if len(botToken) > 8 {
		maskedToken = botToken[:4] + "****" + botToken[len(botToken)-4:]
	} else if botToken != "" {
		maskedToken = "****"
	}
	ok(w, map[string]any{
		"bot_token":  maskedToken,
		"chat_id":    chatID,
		"configured": botToken != "" && chatID != "",
	})
}

// SaveTelegram — PUT /api/settings/telegram
func (h *Handler) SaveTelegram(w http.ResponseWriter, r *http.Request) {
	var req telegramSettingsRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "invalid request body")
		return
	}
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}

	_, err := h.PG.Exec(r.Context(), `
		UPDATE telegram_settings SET bot_token = $1, chat_id = $2, updated_at = now()
		WHERE id = 1
	`, req.BotToken, req.ChatID)
	if err != nil {
		internalError(w, err)
		return
	}
	ok(w, map[string]any{
		"bot_token":  req.BotToken,
		"chat_id":    req.ChatID,
		"configured": req.BotToken != "" && req.ChatID != "",
	})
}

// TestTelegram — POST /api/settings/telegram/test
func (h *Handler) TestTelegram(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		internalError(w, errNoDB)
		return
	}

	var botToken, chatID string
	err := h.PG.QueryRow(r.Context(),
		`SELECT bot_token, chat_id FROM telegram_settings WHERE id = 1`,
	).Scan(&botToken, &chatID)
	if err != nil || botToken == "" || chatID == "" {
		badRequest(w, "telegram not configured")
		return
	}

	body, _ := json.Marshal(map[string]string{
		"chat_id": chatID,
		"text":    "Sandhilux: test message",
	})
	resp, err := http.Post(
		fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken),
		"application/json",
		bytes.NewReader(body),
	)
	if err != nil {
		internalError(w, fmt.Errorf("telegram request failed: %w", err))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var tgErr map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&tgErr)
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"ok":    false,
			"error": tgErr,
		})
		return
	}
	ok(w, map[string]bool{"ok": true})
}
