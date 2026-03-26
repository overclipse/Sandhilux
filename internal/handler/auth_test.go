package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestMain(m *testing.M) {
	os.Setenv("JWT_SECRET", "test-secret-for-unit-tests")
	os.Exit(m.Run())
}

// ── JWT unit tests ─────────────────────────────────────────────────────────

func TestIssueJWT_ContainsExpectedClaims(t *testing.T) {
	token, err := IssueJWT("user-1", "test@example.com", "admin", "Alice", "https://example.com/avatar.png")
	if err != nil {
		t.Fatalf("IssueJWT: %v", err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}

	claims, err := ParseJWT(token)
	if err != nil {
		t.Fatalf("ParseJWT: %v", err)
	}
	if claims.UserID != "user-1" {
		t.Errorf("UserID: want user-1, got %q", claims.UserID)
	}
	if claims.Email != "test@example.com" {
		t.Errorf("Email: want test@example.com, got %q", claims.Email)
	}
	if claims.Role != "admin" {
		t.Errorf("Role: want admin, got %q", claims.Role)
	}
	if claims.Name != "Alice" {
		t.Errorf("Name: want Alice, got %q", claims.Name)
	}
}

func TestParseJWT_InvalidSignature(t *testing.T) {
	claims := JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		UserID: "u", Email: "e@e.com", Role: "viewer",
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	wrongSecret := []byte("totally-different-secret-key-xyz")
	signed, _ := tok.SignedString(wrongSecret)

	if _, err := ParseJWT(signed); err == nil {
		t.Error("expected error for token signed with wrong key, got nil")
	}
}

func TestParseJWT_ExpiredToken(t *testing.T) {
	claims := JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
		},
		UserID: "u", Email: "e@e.com", Role: "viewer",
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, _ := tok.SignedString(jwtSecret())

	if _, err := ParseJWT(signed); err == nil {
		t.Error("expected error for expired token, got nil")
	}
}

func TestParseJWT_MalformedToken(t *testing.T) {
	if _, err := ParseJWT("not.a.jwt"); err == nil {
		t.Error("expected error for malformed token, got nil")
	}
	if _, err := ParseJWT(""); err == nil {
		t.Error("expected error for empty token, got nil")
	}
}

// ── Handler tests ──────────────────────────────────────────────────────────

func newNilHandler() *Handler {
	return &Handler{}
}

func TestMe_MissingAuthHeader(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	w := httptest.NewRecorder()
	h.Me(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("want 401, got %d", w.Code)
	}
}

func TestMe_InvalidToken(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set("Authorization", "Bearer invalid.token.here")
	w := httptest.NewRecorder()
	h.Me(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("want 401, got %d", w.Code)
	}
}

func TestMe_ValidToken_ReturnsUserInfo(t *testing.T) {
	token, _ := IssueJWT("user-42", "alice@example.com", "admin", "Alice", "https://pic.example.com")

	h := newNilHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	h.Me(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body["id"] != "user-42" {
		t.Errorf("id: want user-42, got %v", body["id"])
	}
	if body["role"] != "admin" {
		t.Errorf("role: want admin, got %v", body["role"])
	}
	if body["email"] != "alice@example.com" {
		t.Errorf("email: want alice@example.com, got %v", body["email"])
	}
}

func TestLogout_ReturnsNoContent(t *testing.T) {
	h := newNilHandler()
	req := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	w := httptest.NewRecorder()
	h.Logout(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("want 204, got %d", w.Code)
	}
}
