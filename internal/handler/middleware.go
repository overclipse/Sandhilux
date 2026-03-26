package handler

import (
	"context"
	"net/http"
)

type contextKey string

const claimsKey contextKey = "claims"

// Auth is an HTTP middleware that validates the JWT Bearer token.
// Checks Authorization header first, falls back to ?token= query param (for SSE EventSource).
// Stores *JWTClaims in context on success, otherwise returns 401.
func Auth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var tokenStr string
		authHeader := r.Header.Get("Authorization")
		if len(authHeader) >= 8 && authHeader[:7] == "Bearer " {
			tokenStr = authHeader[7:]
		} else if t := r.URL.Query().Get("token"); t != "" {
			tokenStr = t
		}
		if tokenStr == "" {
			unauthorized(w)
			return
		}
		claims, err := ParseJWT(tokenStr)
		if err != nil {
			unauthorized(w)
			return
		}
		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// AdminOnly requires the authenticated user to have role="admin".
func AdminOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := claimsFromCtx(r.Context())
		if claims == nil || claims.Role != "admin" {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

// claimsFromCtx extracts JWT claims placed by Auth middleware.
func claimsFromCtx(ctx context.Context) *JWTClaims {
	c, _ := ctx.Value(claimsKey).(*JWTClaims)
	return c
}
