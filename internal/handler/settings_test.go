package handler

import (
	"context"
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

// ensure strings is used
var _ = strings.NewReader("")
