package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

// sentinel handler that records whether it was called
func okSentinel(called *bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*called = true
		w.WriteHeader(http.StatusOK)
	})
}

// ── Auth middleware ────────────────────────────────────────────────────────

func TestAuth_NoAuthorizationHeader(t *testing.T) {
	var called bool
	mw := Auth(okSentinel(&called))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("want 401, got %d", w.Code)
	}
	if called {
		t.Error("next handler must not be called on missing auth")
	}
}

func TestAuth_WrongScheme(t *testing.T) {
	var called bool
	mw := Auth(okSentinel(&called))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Basic dXNlcjpwYXNz")
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("want 401, got %d", w.Code)
	}
	if called {
		t.Error("next handler must not be called on wrong scheme")
	}
}

func TestAuth_InvalidToken(t *testing.T) {
	var called bool
	mw := Auth(okSentinel(&called))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer garbage.token.here")
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("want 401, got %d", w.Code)
	}
	if called {
		t.Error("next handler must not be called on invalid token")
	}
}

func TestAuth_ValidToken_CallsNext(t *testing.T) {
	token, _ := IssueJWT("u-1", "user@example.com", "admin", "User", "")
	var called bool
	mw := Auth(okSentinel(&called))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	if !called {
		t.Error("next handler was not called with valid token")
	}
}

func TestAuth_ValidToken_StoresClaimsInContext(t *testing.T) {
	token, _ := IssueJWT("u-99", "ctx@example.com", "viewer", "Viewer", "")

	var gotClaims *JWTClaims
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotClaims = claimsFromCtx(r.Context())
		w.WriteHeader(http.StatusOK)
	})
	mw := Auth(next)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if gotClaims == nil {
		t.Fatal("claims not stored in context")
	}
	if gotClaims.UserID != "u-99" {
		t.Errorf("UserID: want u-99, got %q", gotClaims.UserID)
	}
	if gotClaims.Role != "viewer" {
		t.Errorf("Role: want viewer, got %q", gotClaims.Role)
	}
}

// ── AdminOnly middleware ───────────────────────────────────────────────────

func TestAdminOnly_NoClaimsInContext(t *testing.T) {
	var called bool
	mw := AdminOnly(okSentinel(&called))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("want 403, got %d", w.Code)
	}
	if called {
		t.Error("next must not be called without claims")
	}
}

func TestAdminOnly_ViewerRole_Forbidden(t *testing.T) {
	var called bool
	mw := AdminOnly(okSentinel(&called))

	ctx := context.WithValue(context.Background(), claimsKey, &JWTClaims{Role: "viewer"})
	req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("want 403, got %d", w.Code)
	}
	if called {
		t.Error("next must not be called for viewer role")
	}
}

func TestAdminOnly_AdminRole_PassesThrough(t *testing.T) {
	var called bool
	mw := AdminOnly(okSentinel(&called))

	ctx := context.WithValue(context.Background(), claimsKey, &JWTClaims{Role: "admin"})
	req := httptest.NewRequest(http.MethodGet, "/", nil).WithContext(ctx)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}
	if !called {
		t.Error("next was not called for admin role")
	}
}

// ── claimsFromCtx ─────────────────────────────────────────────────────────

func TestClaimsFromCtx_EmptyContext(t *testing.T) {
	if c := claimsFromCtx(context.Background()); c != nil {
		t.Errorf("expected nil claims for empty context, got %+v", c)
	}
}

func TestClaimsFromCtx_WrongType(t *testing.T) {
	ctx := context.WithValue(context.Background(), claimsKey, "not-claims")
	if c := claimsFromCtx(ctx); c != nil {
		t.Errorf("expected nil for wrong type in context, got %+v", c)
	}
}
