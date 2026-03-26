package router_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"overclipse/Sandhilux/internal/handler"
	"overclipse/Sandhilux/internal/router"
	"overclipse/Sandhilux/internal/service/checker"
)

// newTestServer creates a fully wired router with nil DB connections.
func newTestServer() http.Handler {
	source := make(chan checker.CheckEvent, 1)
	bc := checker.NewBroadcaster(source)
	chk := checker.New(nil)
	h := handler.New(nil, chk, bc)
	return router.New(h)
}

func issueToken(t *testing.T, userID, role string) string {
	t.Helper()
	tok, err := handler.IssueJWT(userID, userID+"@example.com", role, userID, "")
	if err != nil {
		t.Fatalf("IssueJWT: %v", err)
	}
	return tok
}

// ── Public routes ──────────────────────────────────────────────────────────

func TestRouter_Me_WithoutToken_Returns401(t *testing.T) {
	srv := httptest.NewServer(newTestServer())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/me")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("/api/me without token: want 401, got %d", resp.StatusCode)
	}
}

func TestRouter_Me_WithValidToken_Returns200(t *testing.T) {
	srv := httptest.NewServer(newTestServer())
	defer srv.Close()

	token := issueToken(t, "user-1", "admin")
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("/api/me with token: want 200, got %d", resp.StatusCode)
	}
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if body["id"] != "user-1" {
		t.Errorf("me.id: want user-1, got %v", body["id"])
	}
}

// ── Protected routes require JWT ───────────────────────────────────────────

var protectedGET = []string{
	"/api/endpoints/",
	"/api/metrics/overview",
	"/api/metrics/latency",
	"/api/metrics/uptime",
	"/api/alerts/",
	"/api/settings/users",
	"/api/settings/telegram",
}

func TestRouter_ProtectedRoutes_WithoutToken_Return401(t *testing.T) {
	srv := httptest.NewServer(newTestServer())
	defer srv.Close()

	for _, path := range protectedGET {
		t.Run(path, func(t *testing.T) {
			resp, err := http.Get(srv.URL + path)
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()
			if resp.StatusCode != http.StatusUnauthorized {
				t.Errorf("%s without token: want 401, got %d", path, resp.StatusCode)
			}
		})
	}
}

func TestRouter_ProtectedRoutes_WithValidToken_Return2xx(t *testing.T) {
	srv := httptest.NewServer(newTestServer())
	defer srv.Close()

	token := issueToken(t, "user-1", "admin")

	for _, path := range protectedGET {
		t.Run(path, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodGet, srv.URL+path, nil)
			req.Header.Set("Authorization", "Bearer "+token)

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()

			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				t.Errorf("%s with token: want 2xx, got %d", path, resp.StatusCode)
			}
		})
	}
}

// ── RBAC: settings require admin ──────────────────────────────────────────

func TestRouter_Settings_ViewerRole_Returns403(t *testing.T) {
	srv := httptest.NewServer(newTestServer())
	defer srv.Close()

	token := issueToken(t, "viewer-1", "viewer")

	for _, path := range []string{"/api/settings/users", "/api/settings/telegram"} {
		t.Run(path, func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodGet, srv.URL+path, nil)
			req.Header.Set("Authorization", "Bearer "+token)

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			resp.Body.Close()

			if resp.StatusCode != http.StatusForbidden {
				t.Errorf("%s viewer: want 403, got %d", path, resp.StatusCode)
			}
		})
	}
}

// ── Register is public ──────────────────────────────────────────────────

func TestRouter_Register_IsPublic(t *testing.T) {
	srv := httptest.NewServer(newTestServer())
	defer srv.Close()

	// No auth needed — register should return 4xx (400 bad body), not 401
	resp, err := http.Post(srv.URL+"/api/auth/register", "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		t.Error("/api/auth/register should be public (no auth required)")
	}
}

// ── SSE requires auth ────────────────────────────────────────────────────

func TestRouter_SSE_WithoutToken_Returns401(t *testing.T) {
	srv := httptest.NewServer(newTestServer())
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/api/events")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("/api/events without token: want 401, got %d", resp.StatusCode)
	}
}

// ── OPTIONS preflight (CORS) ───────────────────────────────────────────────

func TestRouter_OptionsPreflightReturns204(t *testing.T) {
	srv := httptest.NewServer(newTestServer())
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodOptions, srv.URL+"/api/endpoints/", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "GET")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("OPTIONS preflight: want 204, got %d", resp.StatusCode)
	}
	if resp.Header.Get("Access-Control-Allow-Origin") == "" {
		t.Error("OPTIONS preflight: missing Access-Control-Allow-Origin header")
	}
}
