package handler

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// ── ListUsers ──────────────────────────────────────────────────────────────

func TestListUsers_NilDB_ReturnsEmptyArray(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/settings/users", nil)
	w := httptest.NewRecorder()
	h.ListUsers(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	assertEmptyArray(t, w.Body.Bytes())
}

// ── UpdateUserRole ─────────────────────────────────────────────────────────

func TestUpdateUserRole_InvalidRole_Returns400(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPut, "/", "id", "user-id-1")
	req = withBody(req, `{"role":"superuser"}`)
	w := httptest.NewRecorder()
	h.UpdateUserRole(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
	assertErrorField(t, w.Body.Bytes())
}

func TestUpdateUserRole_InvalidJSON_Returns400(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPut, "/", "id", "user-id-1")
	req = withBody(req, "bad json")
	w := httptest.NewRecorder()
	h.UpdateUserRole(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
}

func TestUpdateUserRole_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodPut, "/", "id", "user-id-1")
	req = withBody(req, `{"role":"viewer"}`)
	w := httptest.NewRecorder()
	h.UpdateUserRole(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ── RemoveUser ─────────────────────────────────────────────────────────────

func TestRemoveUser_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodDelete, "/", "id", "other-user-id")
	w := httptest.NewRecorder()
	h.RemoveUser(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

func TestRemoveUser_SelfDeletion_Returns400(t *testing.T) {
	h := newNilHandler()
	req := chiRequest(http.MethodDelete, "/", "id", "self-id")

	// Inject claims with the same ID into context (simulates Auth middleware)
	token, _ := IssueJWT("self-id", "self@example.com", "admin", "Self", "")
	claims, _ := ParseJWT(token)
	req = req.WithContext(context.WithValue(req.Context(), claimsKey, claims))

	w := httptest.NewRecorder()
	h.RemoveUser(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400 (cannot remove yourself), got %d", w.Code)
	}
}

// ── GetTelegram ────────────────────────────────────────────────────────────

func TestGetTelegram_NilDB_ReturnsDefault(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/settings/telegram", nil)
	w := httptest.NewRecorder()
	h.GetTelegram(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
}

// ── SaveTelegram ───────────────────────────────────────────────────────────

func TestSaveTelegram_InvalidJSON_Returns400(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodPut, "/api/settings/telegram",
		strings.NewReader("{not valid json"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.SaveTelegram(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("want 400, got %d", w.Code)
	}
}

func TestSaveTelegram_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodPut, "/api/settings/telegram", nil)
	req = withBody(req, `{"bot_token":"123:abc","chat_id":"-100123"}`)
	w := httptest.NewRecorder()
	h.SaveTelegram(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ── TestTelegram ───────────────────────────────────────────────────────────

func TestTestTelegram_NilDB_Returns500(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/settings/telegram/test", nil)
	w := httptest.NewRecorder()
	h.TestTelegram(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("want 500, got %d", w.Code)
	}
}

// ensure io is used (badBodyReader helper for potential reuse)
var _ io.Reader = strings.NewReader("")
