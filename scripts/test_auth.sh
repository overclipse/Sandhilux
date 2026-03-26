#!/usr/bin/env bash
# External auth flow tests — run against a live API at localhost:8080
# Usage: bash scripts/test_auth.sh

set -euo pipefail

API="http://localhost:8080"
PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

echo "=== Auth flow tests against $API ==="
echo ""

# ── 1. GET /api/auth/google → should redirect to Google ──────────────────
echo "[1] GET /api/auth/google → 307 redirect to accounts.google.com"
RESP=$(curl -s -o /dev/null -w '%{http_code}|%{redirect_url}' "$API/api/auth/google" 2>&1)
CODE=$(echo "$RESP" | cut -d'|' -f1)
LOCATION=$(echo "$RESP" | cut -d'|' -f2)
if [[ "$CODE" == "307" ]] && [[ "$LOCATION" == *"accounts.google.com"* ]]; then
  ok "redirect to Google ($CODE)"
else
  fail "expected 307 to Google, got $CODE → $LOCATION"
fi

# Also check oauth_state cookie is set
COOKIE_HDR=$(curl -s -D- -o /dev/null "$API/api/auth/google" 2>&1 | grep -i 'set-cookie.*oauth_state' || true)
if [[ -n "$COOKIE_HDR" ]]; then
  ok "oauth_state cookie set"
else
  fail "oauth_state cookie not set"
fi

# ── 2. GET /api/auth/exchange WITHOUT cookie → 401 ───────────────────────
echo ""
echo "[2] GET /api/auth/exchange without cookie → 401"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API/api/auth/exchange")
if [[ "$CODE" == "401" ]]; then
  ok "no cookie → 401"
else
  fail "expected 401, got $CODE"
fi

# ── 3. GET /api/auth/exchange WITH valid auth_code cookie → 200 ──────────
echo ""
echo "[3] GET /api/auth/exchange with valid JWT cookie → 200 + token"
# We can't do the real Google flow, but we can simulate by testing the endpoint
# directly. First we need a valid JWT — we'll use /api/me to verify.
# For this test we need the API's JWT_SECRET — skip if unknown.
echo "  (skipped — requires real Google OAuth flow to get auth_code cookie)"
echo "  To test manually:"
echo "    1. Open http://localhost:5173/login in browser"
echo "    2. Open DevTools > Network tab"
echo "    3. Click 'Sign in with Google'"
echo "    4. After Google redirects back, watch for:"
echo "       - GET /api/auth/google/callback → should set auth_code cookie"
echo "       - GET /api/auth/exchange → should return {\"token\": \"...\"}"
echo "    5. Check if auth_code cookie has Path=/api/auth/exchange"

# ── 4. GET /api/me without token → 401 ──────────────────────────────────
echo ""
echo "[4] GET /api/me without token → 401"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API/api/me")
if [[ "$CODE" == "401" ]]; then
  ok "no token → 401"
else
  fail "expected 401, got $CODE"
fi

# ── 5. GET /api/me with invalid token → 401 ─────────────────────────────
echo ""
echo "[5] GET /api/me with invalid token → 401"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer invalid.token.here" "$API/api/me")
if [[ "$CODE" == "401" ]]; then
  ok "bad token → 401"
else
  fail "expected 401, got $CODE"
fi

# ── 6. CORS preflight ────────────────────────────────────────────────────
echo ""
echo "[6] OPTIONS /api/auth/exchange → CORS headers present"
CORS_RESP=$(curl -s -D- -o /dev/null \
  -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" \
  "$API/api/auth/exchange" 2>&1)
if echo "$CORS_RESP" | grep -qi 'access-control-allow-credentials: true'; then
  ok "Allow-Credentials: true"
else
  fail "missing Access-Control-Allow-Credentials header"
fi
if echo "$CORS_RESP" | grep -qi 'access-control-allow-origin'; then
  ok "Allow-Origin header present"
else
  fail "missing Access-Control-Allow-Origin header"
fi

# ── 7. Test wrong path /auth/exchange (the frontend bug) ─────────────────
echo ""
echo "[7] GET /auth/exchange (without /api prefix) → should be 404"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API/auth/exchange")
if [[ "$CODE" == "404" ]]; then
  ok "/auth/exchange (no /api) → 404 — confirms frontend BUG: must use /api/auth/exchange"
else
  fail "expected 404 for /auth/exchange, got $CODE"
fi

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
