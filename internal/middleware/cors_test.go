package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"overclipse/Sandhilux/internal/middleware"
)

func nextOK() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestCORS_SetsCORSHeaders(t *testing.T) {
	t.Setenv("CORS_ORIGIN", "http://localhost:5173")

	mw := middleware.CORS(nextOK())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("want 200, got %d", w.Code)
	}

	headers := map[string]string{
		"Access-Control-Allow-Origin":  "http://localhost:5173",
		"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	}
	for header, want := range headers {
		if got := w.Header().Get(header); got != want {
			t.Errorf("%s: want %q, got %q", header, want, got)
		}
	}
}

func TestCORS_OptionsPreflightReturns204AndDoesNotCallNext(t *testing.T) {
	t.Setenv("CORS_ORIGIN", "http://localhost:5173")

	var nextCalled bool
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
	})
	mw := middleware.CORS(next)

	req := httptest.NewRequest(http.MethodOptions, "/api/endpoints/", nil)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("OPTIONS: want 204, got %d", w.Code)
	}
	if nextCalled {
		t.Error("next handler must not be called on OPTIONS preflight")
	}
}

func TestCORS_DefaultOrigin_WhenEnvNotSet(t *testing.T) {
	t.Setenv("CORS_ORIGIN", "") // override to empty

	mw := middleware.CORS(nextOK())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	origin := w.Header().Get("Access-Control-Allow-Origin")
	if origin != "http://localhost:5173" {
		t.Errorf("default origin: want http://localhost:5173, got %q", origin)
	}
}

func TestCORS_AllowsCredentials(t *testing.T) {
	mw := middleware.CORS(nextOK())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Errorf("Access-Control-Allow-Credentials: want true, got %q", got)
	}
}

func TestCORS_AuthorizationHeaderInAllowedHeaders(t *testing.T) {
	mw := middleware.CORS(nextOK())
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()
	mw.ServeHTTP(w, req)

	allowedHeaders := w.Header().Get("Access-Control-Allow-Headers")
	if allowedHeaders == "" {
		t.Fatal("Access-Control-Allow-Headers is empty")
	}

	for _, h := range []string{"Authorization", "Content-Type"} {
		found := false
		for _, part := range splitComma(allowedHeaders) {
			if part == h {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Access-Control-Allow-Headers missing %q (got: %q)", h, allowedHeaders)
		}
	}
}

func splitComma(s string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			part := s[start:i]
			// trim spaces
			for len(part) > 0 && part[0] == ' ' {
				part = part[1:]
			}
			for len(part) > 0 && part[len(part)-1] == ' ' {
				part = part[:len(part)-1]
			}
			if part != "" {
				result = append(result, part)
			}
			start = i + 1
		}
	}
	return result
}
