package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// JWTClaims are the claims embedded in our access token.
type JWTClaims struct {
	jwt.RegisteredClaims
	UserID    string `json:"user_id"`
	Email     string `json:"email"`
	Role      string `json:"role"`
	AvatarURL string `json:"avatar_url,omitempty"`
	Name      string `json:"name,omitempty"`
}

func jwtSecret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		log.Fatal("FATAL: JWT_SECRET is not set. Refusing to start.")
	}
	return []byte(s)
}

// IssueJWT creates a signed JWT for the given user.
func IssueJWT(userID, email, role, name, avatarURL string) (string, error) {
	claims := JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "sandhilux",
		},
		UserID:    userID,
		Email:     email,
		Role:      role,
		AvatarURL: avatarURL,
		Name:      name,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret())
}

// ParseJWT validates and parses a JWT string.
func ParseJWT(tokenStr string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &JWTClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return jwtSecret(), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

// AuthStatus godoc
//
// GET /api/auth/status — returns {"setup_required": bool}.
func (h *Handler) AuthStatus(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		internalError(w, fmt.Errorf("database not connected"))
		return
	}
	var count int
	_ = h.PG.QueryRow(r.Context(), `SELECT COUNT(*) FROM users`).Scan(&count)
	ok(w, map[string]bool{"setup_required": count == 0})
}

// Setup godoc
//
// POST /api/auth/setup — creates the first admin account.
// Returns 403 Forbidden once any user exists.
func (h *Handler) Setup(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		internalError(w, fmt.Errorf("database not connected"))
		return
	}

	var count int
	_ = h.PG.QueryRow(r.Context(), `SELECT COUNT(*) FROM users`).Scan(&count)
	if count > 0 {
		forbidden(w)
		return
	}

	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodySize)).Decode(&body); err != nil {
		badRequest(w, "invalid JSON")
		return
	}
	if body.Email == "" || body.Password == "" {
		badRequest(w, "email and password are required")
		return
	}
	if len(body.Password) < 8 {
		badRequest(w, "password must be at least 8 characters")
		return
	}
	if body.Name == "" {
		body.Name = body.Email
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		internalError(w, fmt.Errorf("hash password: %w", err))
		return
	}

	var userID string
	err = h.PG.QueryRow(r.Context(), `
		INSERT INTO users (email, password_hash, name, role)
		VALUES ($1, $2, $3, 'admin')
		RETURNING id::text
	`, body.Email, string(hash), body.Name).Scan(&userID)
	if err != nil {
		internalError(w, fmt.Errorf("create user: %w", err))
		return
	}

	token, err := IssueJWT(userID, body.Email, "admin", body.Name, "")
	if err != nil {
		internalError(w, fmt.Errorf("issue JWT: %w", err))
		return
	}
	ok(w, map[string]string{"token": token})
}

// Login godoc
//
// POST /api/auth/login — email + password → JWT.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodySize)).Decode(&body); err != nil {
		badRequest(w, "invalid JSON")
		return
	}
	if body.Email == "" || body.Password == "" {
		badRequest(w, "email and password are required")
		return
	}

	if h.PG == nil {
		internalError(w, fmt.Errorf("database not connected"))
		return
	}

	var userID, role, name, avatarURL, hash string
	err := h.PG.QueryRow(r.Context(), `
		SELECT id::text, role, name, avatar_url, password_hash
		FROM users WHERE email = $1
	`, body.Email).Scan(&userID, &role, &name, &avatarURL, &hash)
	if err != nil {
		// Same error for wrong email or wrong password — avoid user enumeration
		unauthorized(w)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)); err != nil {
		unauthorized(w)
		return
	}

	token, err := IssueJWT(userID, body.Email, role, name, avatarURL)
	if err != nil {
		internalError(w, fmt.Errorf("issue JWT: %w", err))
		return
	}
	ok(w, map[string]string{"token": token})
}

// Me godoc
//
// GET /api/me — returns current user profile from JWT.
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
		unauthorized(w)
		return
	}
	claims, err := ParseJWT(authHeader[7:])
	if err != nil {
		unauthorized(w)
		return
	}
	ok(w, map[string]any{
		"id":         claims.UserID,
		"email":      claims.Email,
		"role":       claims.Role,
		"name":       claims.Name,
		"avatar_url": claims.AvatarURL,
	})
}

// Register godoc
//
// POST /api/auth/register — creates a new viewer account.
// Username (stored in email column) + password + optional display name.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if h.PG == nil {
		internalError(w, fmt.Errorf("database not connected"))
		return
	}

	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodySize)).Decode(&body); err != nil {
		badRequest(w, "invalid JSON")
		return
	}
	if body.Username == "" || body.Password == "" {
		badRequest(w, "username and password are required")
		return
	}
	if len(body.Username) < 3 {
		badRequest(w, "username must be at least 3 characters")
		return
	}
	if len(body.Password) < 8 {
		badRequest(w, "password must be at least 8 characters")
		return
	}
	if body.Name == "" {
		body.Name = body.Username
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		internalError(w, fmt.Errorf("hash password: %w", err))
		return
	}

	var userID string
	err = h.PG.QueryRow(r.Context(), `
		INSERT INTO users (email, password_hash, name, role)
		VALUES ($1, $2, $3, 'viewer')
		RETURNING id::text
	`, body.Username, string(hash), body.Name).Scan(&userID)
	if err != nil {
		// Duplicate username
		badRequest(w, "username already taken")
		return
	}

	token, err := IssueJWT(userID, body.Username, "viewer", body.Name, "")
	if err != nil {
		internalError(w, fmt.Errorf("issue JWT: %w", err))
		return
	}
	ok(w, map[string]string{"token": token})
}

// Logout godoc
//
// POST /api/auth/logout
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	noContent(w)
}
