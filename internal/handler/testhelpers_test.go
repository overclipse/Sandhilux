package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/go-chi/chi/v5"
)

// chiRequest creates a request with chi URL parameters injected into context.
func chiRequest(method, url, paramKey, paramVal string) *http.Request {
	req := httptest.NewRequest(method, url, nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(paramKey, paramVal)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

// withBody replaces the request body with the provided JSON string
// and sets the Content-Type header.
func withBody(r *http.Request, body string) *http.Request {
	r2 := r.Clone(r.Context())
	r2.Body = http.NoBody
	req := httptest.NewRequest(r.Method, r.URL.String(), strings.NewReader(body))
	req = req.WithContext(r.Context())
	req.Header.Set("Content-Type", "application/json")
	return req
}

// withAuth adds a valid JWT Bearer header to the request.
func withAuth(r *http.Request, userID, role string) *http.Request {
	token, _ := IssueJWT(userID, userID+"@example.com", role, userID, "")
	r2 := r.Clone(r.Context())
	r2.Header = r.Header.Clone()
	r2.Header.Set("Authorization", "Bearer "+token)
	return r2
}
