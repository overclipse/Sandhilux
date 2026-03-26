#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
#  Sandhilux — interactive self-hosted deploy
#  Usage:  bash scripts/deploy.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── ANSI ──────────────────────────────────────────────────────────────────────
BOLD='\033[1m'; DIM='\033[2m'; RST='\033[0m'
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; MAG='\033[0;35m'

hide_cursor()    { printf '\033[?25l'; }
show_cursor()    { printf '\033[?25h'; }
cursor_up()      { printf "\033[%sA" "${1:-1}"; }
erase_to_end()   { printf '\033[J'; }
clear_line()     { printf '\033[2K\r'; }

trap 'show_cursor; stty echo 2>/dev/null || true; echo' EXIT INT TERM

# ── Helpers ───────────────────────────────────────────────────────────────────
blank()  { echo; }
hr()     { echo -e "  ${DIM}$(printf '─%.0s' {1..45})${RST}"; }
step()   { echo -e "\n  ${CYAN}${BOLD}◆  $*${RST}"; }
ok()     { echo -e "  ${GREEN}✓${RST}  $*"; }
warn()   { echo -e "  ${YELLOW}⚠${RST}  $*"; }
info()   { echo -e "  ${DIM}$*${RST}"; }
fail()   { echo -e "\n  ${RED}✗  $*${RST}\n"; show_cursor; exit 1; }

# ── Random secret generator ───────────────────────────────────────────────────
gen_secret() {
  # 32 bytes → 44 chars base64, URL-safe, no padding issues
  if command -v openssl &>/dev/null; then
    openssl rand -base64 32 | tr -d '\n/+=' | head -c 43
  else
    head -c 48 /dev/urandom | base64 | tr -d '\n/+=' | head -c 43
  fi
}

# 16 random lowercase+digit chars — safe for PG username/dbname
gen_name() {
  head -c 32 /dev/urandom | base64 | tr -d '\n/+=' | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9' | head -c 16
}

# ── Docker install ────────────────────────────────────────────────────────────
install_docker_linux() {
  if command -v apt-get &>/dev/null; then
    step "Installing Docker (apt)"
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
      | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif command -v dnf &>/dev/null; then
    step "Installing Docker (dnf)"
    sudo dnf -y -q install dnf-plugins-core
    sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
    sudo dnf -y -q install docker-ce docker-ce-cli containerd.io docker-compose-plugin
  elif command -v yum &>/dev/null; then
    step "Installing Docker (yum)"
    sudo yum install -y -q yum-utils
    sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    sudo yum install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
  else
    fail "Cannot install Docker automatically on this Linux distro.
        Please install manually: https://docs.docker.com/engine/install/"
  fi

  sudo systemctl enable --now docker 2>/dev/null || true
  # Allow current user to use docker without sudo (effective on next login)
  sudo usermod -aG docker "$USER" 2>/dev/null || true
  ok "Docker installed"
}

ensure_docker() {
  if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
    ok "Docker   ${DIM}$(docker --version | awk '{print $3}' | tr -d ',')${RST}"
    ok "Compose  ${DIM}$(docker compose version --short)${RST}"
    return 0
  fi

  local os
  os="$(uname -s)"

  if [[ "$os" == "Linux" ]]; then
    warn "Docker not found — installing automatically…"
    blank
    install_docker_linux

    # Re-exec script via newgrp docker so the docker group takes effect
    if ! docker ps &>/dev/null 2>&1; then
      if id -nG "$USER" | grep -qw docker; then
        warn "Docker group applied. Re-launching script with 'newgrp docker'…"
        exec newgrp docker -- bash "$0" "$@"
      else
        fail "Docker installed but socket not accessible. Try: sudo docker compose …"
      fi
    fi

  elif [[ "$os" == "Darwin" ]]; then
    fail "Docker not found. Please install Docker Desktop for Mac:
        https://www.docker.com/products/docker-desktop/
        Then re-run this script."

  else
    fail "Docker not found → https://docs.docker.com/get-docker/"
  fi

  # Final check
  docker compose version &>/dev/null \
    || fail "Docker Compose V2 not available after install. Update Docker."

  ok "Docker   ${DIM}$(docker --version | awk '{print $3}' | tr -d ',')${RST}"
  ok "Compose  ${DIM}$(docker compose version --short)${RST}"
}

# strip ANSI for length calculation
strip_ansi() { echo -e "$1" | sed 's/\x1b\[[0-9;]*m//g'; }
visible_len() { local s; s=$(strip_ansi "$1"); echo ${#s}; }

# ── Port utilities ─────────────────────────────────────────────────────────────
CANDIDATES=(8080 8081 8082 8083 8090 8091 3000 3001 4000 4001 5001 9080 7000 7001)
PORT_STATUS=()

is_port_free() {
  if command -v nc &>/dev/null; then
    ! nc -z 127.0.0.1 "$1" 2>/dev/null
  else
    ! (echo >/dev/tcp/127.0.0.1/"$1") 2>/dev/null
  fi
}

scan_ports() {
  PORT_STATUS=()
  local i
  for i in "${!CANDIDATES[@]}"; do
    is_port_free "${CANDIDATES[$i]}" && PORT_STATUS[$i]="free" || PORT_STATUS[$i]="busy"
  done
}

port_status() {
  local p="$1" i
  for i in "${!CANDIDATES[@]}"; do
    if [[ "${CANDIDATES[$i]}" == "$p" ]]; then
      echo "${PORT_STATUS[$i]:-busy}"
      return
    fi
  done
  echo "busy"
}

first_free_port() {
  local i
  for i in "${!CANDIDATES[@]}"; do
    [[ "${PORT_STATUS[$i]:-}" == "free" ]] && { echo "${CANDIDATES[$i]}"; return; }
  done
  local r
  while true; do
    r=$(( (RANDOM * RANDOM) % 50000 + 10000 ))
    is_port_free "$r" && { echo "$r"; return; }
  done
}

# ── Arrow-key menu ────────────────────────────────────────────────────────────
arrow_menu() {
  local __res="$1"; local title="$2"; shift 2
  local items=("$@")
  local n=${#items[@]}
  local sel=0

  hide_cursor
  stty -echo 2>/dev/null || true

  _render_menu() {
    for i in "${!items[@]}"; do
      if [[ $i -eq $sel ]]; then
        echo -e "  ${CYAN}${BOLD}  ❯  ${items[$i]}${RST}"
      else
        echo -e "  ${DIM}     ${items[$i]}${RST}"
      fi
    done
    echo -e "\n  ${DIM}↑ ↓  Navigate    Enter  Select    q  Quit${RST}"
  }

  local hint_lines=2
  local total=$(( n + hint_lines ))

  echo -e "$title"
  blank
  _render_menu

  while true; do
    local key seq
    IFS= read -rsn1 key 2>/dev/null || true

    case "$key" in
      $'\x1b')
        read -rsn2 -t 0.05 seq 2>/dev/null || true
        case "$seq" in
          '[A') [[ $sel -gt 0 ]]        && (( sel-- )) || true ;;
          '[B') [[ $sel -lt $((n-1)) ]] && (( sel++ )) || true ;;
        esac
        cursor_up $total
        erase_to_end
        _render_menu
        ;;
      '') # Enter
        cursor_up $total
        erase_to_end
        stty echo 2>/dev/null || true
        show_cursor
        printf -v "$__res" '%d' "$sel"
        return 0
        ;;
      q|Q) show_cursor; stty echo 2>/dev/null || true; blank; exit 0 ;;
    esac
  done
}

# ── Spinner ───────────────────────────────────────────────────────────────────
SPIN_PID=""
start_spinner() {
  hide_cursor
  ( local f=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏') i=0
    while true; do
      printf "\r  ${CYAN}${f[$((i%10))]}${RST}  ${DIM}$*${RST}"
      (( i++ )) || true; sleep 0.1
    done
  ) &
  SPIN_PID=$!
}
stop_spinner() {
  [[ -n "$SPIN_PID" ]] && { kill "$SPIN_PID" 2>/dev/null || true; wait "$SPIN_PID" 2>/dev/null || true; SPIN_PID=""; }
  clear_line; show_cursor
}

# ── sed helper ────────────────────────────────────────────────────────────────
sed_inplace() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# ── .env setup ────────────────────────────────────────────────────────────────
setup_env() {
  local port="$1"

  if [[ ! -f .env ]]; then
    # ── Generate all credentials from scratch ───────────────────────────
    local jwt_secret pg_user pg_password pg_db

    jwt_secret=$(gen_secret)
    pg_user="slx_$(gen_name | head -c 12)"
    pg_password=$(gen_secret)
    pg_db="sandhilux"

    cat > .env <<EOF
# ── Sandhilux configuration ──────────────────────────────────
# Auto-generated on $(date -u '+%Y-%m-%d %H:%M UTC')
# KEEP THIS FILE SECRET — do not commit to version control.

HTTP_ADDR=:8080
PORT=${port}
CORS_ORIGIN=http://localhost:${port}

# JWT secret — change invalidates all active sessions
JWT_SECRET=${jwt_secret}

# PostgreSQL credentials
POSTGRES_USER=${pg_user}
POSTGRES_PASSWORD=${pg_password}
POSTGRES_DB=${pg_db}
EOF

    ok ".env created with generated credentials"
    blank
    echo -e "  ${YELLOW}${BOLD}Generated credentials (saved to .env):${RST}"
    echo -e "  ${DIM}PostgreSQL user:    ${RST}${BOLD}${pg_user}${RST}"
    echo -e "  ${DIM}PostgreSQL pass:    ${RST}${BOLD}${pg_password}${RST}"
    echo -e "  ${DIM}JWT secret:        ${RST}${DIM}(hidden)${RST}"
    blank
    warn "Back up your .env file — losing it requires DB reset."
    blank

  else
    # ── Existing .env — fill in any missing keys ─────────────────────────
    local changed=false

    if ! grep -q "^JWT_SECRET=" .env; then
      echo "JWT_SECRET=$(gen_secret)" >> .env
      ok "JWT_SECRET generated and added to .env"
      changed=true
    fi
    if ! grep -q "^POSTGRES_USER=" .env; then
      echo "POSTGRES_USER=slx_$(gen_name | head -c 12)" >> .env
      ok "POSTGRES_USER generated and added to .env"
      changed=true
    fi
    if ! grep -q "^POSTGRES_PASSWORD=" .env; then
      echo "POSTGRES_PASSWORD=$(gen_secret)" >> .env
      ok "POSTGRES_PASSWORD generated and added to .env"
      changed=true
    fi
    if ! grep -q "^POSTGRES_DB=" .env; then
      echo "POSTGRES_DB=sandhilux" >> .env
      ok "POSTGRES_DB added to .env"
      changed=true
    fi
    $changed || info ".env already has all required keys"
  fi

  # ── Update PORT ──────────────────────────────────────────────────────────
  if grep -q "^PORT=" .env; then
    sed_inplace "s|^PORT=.*|PORT=${port}|" .env
  else
    echo "PORT=${port}" >> .env
  fi
  if grep -q "^CORS_ORIGIN=" .env; then
    sed_inplace "s|^CORS_ORIGIN=.*|CORS_ORIGIN=http://localhost:${port}|" .env
  fi

  ok "Port ${BOLD}${CYAN}${port}${RST} saved to .env"
}

# ── LAN IP ────────────────────────────────────────────────────────────────────
get_lan_ip() {
  if command -v ipconfig &>/dev/null; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo ""
  elif command -v hostname &>/dev/null; then
    hostname -I 2>/dev/null | awk '{print $1}' || echo ""
  else
    echo ""
  fi
}

# ════════════════════════════════════════════════════════════════════════════════
#  ACTIONS
# ════════════════════════════════════════════════════════════════════════════════

action_deploy() {
  local update="${1:-false}"
  local port=""

  # ── git pull (update only) ────────────────────────────────
  if $update; then
    step "Pulling latest code"
    local before_commit
    before_commit=$(git rev-parse HEAD 2>/dev/null || echo "")

    if git pull --ff-only 2>&1; then
      local after_commit
      after_commit=$(git rev-parse HEAD 2>/dev/null || echo "")

      if [[ -n "$before_commit" && "$before_commit" != "$after_commit" ]]; then
        ok "Updated  ${DIM}${before_commit:0:7} → ${after_commit:0:7}${RST}"
        blank
        echo -e "  ${BOLD}Changelog:${RST}"
        git log --oneline "${before_commit}..HEAD" 2>/dev/null \
          | while IFS= read -r line; do
              echo -e "  ${DIM}·  ${RST}${line}"
            done
        blank
      else
        ok "Already up to date"
      fi
    else
      warn "git pull failed — building from current code"
    fi
  fi

  # ── port selection — skip if updating with existing .env ──
  if $update && [[ -f .env ]]; then
    port=$(grep "^PORT=" .env 2>/dev/null | cut -d= -f2 || echo "")
    port="${port:-8080}"
    ok "Port: ${BOLD}${CYAN}${port}${RST}  ${DIM}(from .env)${RST}"
  else
    step "Scanning ports"
    start_spinner "scanning…"
    scan_ports
    stop_spinner

    local auto
    auto=$(first_free_port)

    local items=()
    items+=("${BOLD}Auto${RST}  →  ${CYAN}${BOLD}:${auto}${RST}  ${DIM}(recommended)${RST}")
    for p in "${CANDIDATES[@]}"; do
      if [[ "$(port_status "$p")" == "free" ]]; then
        items+=("${p}   ${GREEN}free${RST}")
      else
        items+=("${DIM}${p}   busy${RST}")
      fi
    done
    items+=("${BOLD}⌨   Enter custom…${RST}")

    blank
    local pidx=0
    arrow_menu pidx \
      "  ${BOLD}Select port to expose Sandhilux on:${RST}" \
      "${items[@]}"

    local last=$(( ${#items[@]} - 1 ))
    if   [[ $pidx -eq 0 ]];      then port="$auto"
    elif [[ $pidx -eq $last ]];  then
      blank
      printf "  ${BOLD}Port number:${RST} "
      read -r port
      is_port_free "$port" || warn "Port $port appears busy — continuing anyway"
    else
      port="${CANDIDATES[$((pidx-1))]}"
    fi

    ok "Port: ${BOLD}${CYAN}${port}${RST}"
  fi

  # ── env ───────────────────────────────────────────────────
  step "Configuring environment"
  setup_env "$port"

  # ── build ─────────────────────────────────────────────────
  step "Building images"
  info "First run downloads ~500 MB and compiles the app (2-4 min)"
  blank
  PORT="$port" docker compose build 2>&1 | while IFS= read -r line; do
    if   [[ "$line" == *"Step "* || "$line" == *"--->"* ]]; then info "$line"
    elif [[ "$line" == *"Successfully"* || "$line" == *"built"* ]]; then ok "$line"
    elif [[ "$line" == *"rror"* ]]; then echo -e "  ${RED}$line${RST}"
    else info "$line"
    fi
  done

  step "Starting services"
  PORT="$port" docker compose up -d
  blank

  # ── wait for API ─────────────────────────────────────────
  step "Waiting for API"
  info "Order: Postgres → API (up to 2 min)"
  blank

  local url="http://localhost:${port}/api/auth/status"
  local elapsed=0 code=""
  printf "  "
  while true; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    if [[ "$code" == "200" ]]; then blank; ok "API is ready"; break; fi
    if [[ $elapsed -ge 150 ]]; then blank; warn "API slow to start. Check: ${BOLD}docker compose logs api${RST}"; break; fi
    printf "${CYAN}·${RST}"; sleep 3; (( elapsed += 3 )) || true
  done

  # ── first-run detection ────────────────────────────────────
  local setup=false
  local resp
  resp=$(curl -sf "$url" 2>/dev/null || echo '{}')
  echo "$resp" | grep -q '"setup_required":true' && setup=true

  local lan_ip
  lan_ip=$(get_lan_ip)

  # ── result ─────────────────────────────────────────────────
  local w=47
  blank
  echo -e "  ${BOLD}${GREEN}╔$(printf '═%.0s' $(seq 1 $w))╗${RST}"
  printf   "  ${BOLD}${GREEN}║${RST}  ${BOLD}%-${w}s${GREEN}${BOLD}║${RST}\n" "🚀  Launch complete!"
  echo -e  "  ${BOLD}${GREEN}╚$(printf '═%.0s' $(seq 1 $w))╝${RST}"
  blank
  echo -e  "  ${BOLD}Local   ${RST}${DIM}→${RST}  ${CYAN}${BOLD}http://localhost:${port}${RST}"
  if [[ -n "$lan_ip" ]]; then
    echo -e "  ${BOLD}Network ${RST}${DIM}→${RST}  ${CYAN}${BOLD}http://${lan_ip}:${port}${RST}  ${DIM}(LAN)${RST}"
  fi
  blank

  if $setup; then
    echo -e "  ${YELLOW}${BOLD}⚑  First run — create your admin account${RST}"
    echo -e "  Open the URL above and fill in the setup form."
    blank
    echo -e "  ${DIM}Via API (alternative):${RST}"
    echo -e "  ${DIM}  curl -s -X POST http://localhost:${port}/api/auth/setup \\${RST}"
    echo -e "  ${DIM}    -H 'Content-Type: application/json' \\${RST}"
    echo -e "  ${DIM}    -d '{\"username\":\"admin\",\"password\":\"yourpass\",\"name\":\"Admin\"}' | jq .${RST}"
  else
    echo -e "  ${GREEN}✓${RST}  ${BOLD}Application running. Sign in at the URL above.${RST}"
  fi

  blank; hr
  info "docker compose logs -f api    ← live API logs"
  info "bash scripts/deploy.sh        ← this menu"
  blank
}

action_stop() {
  step "Stopping services"
  if docker compose ps --quiet 2>/dev/null | grep -q .; then
    docker compose down
    ok "All services stopped  ${DIM}(data preserved in volumes)${RST}"
  else
    warn "No running services found"
  fi
  info "To delete all data:  ${BOLD}docker compose down -v${RST}"
  blank
}

action_logs() {
  blank
  info "Streaming last 60 lines then live  ${DIM}(Ctrl+C to exit)${RST}"
  blank
  docker compose logs -f --tail=60
}

action_status() {
  step "Container status"
  docker compose ps
  blank

  local port=""
  [[ -f .env ]] && port=$(grep "^PORT=" .env 2>/dev/null | cut -d= -f2 || echo "")
  port="${port:-8080}"

  local url="http://localhost:${port}/api/auth/status"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [[ "$code" == "200" ]]; then
    ok "API responding  →  ${CYAN}http://localhost:${port}${RST}"
    local resp
    resp=$(curl -sf "$url" 2>/dev/null || echo '{}')
    if echo "$resp" | grep -q '"setup_required":true'; then
      warn "Admin account not created yet — open the URL to set it up"
    else
      ok "Application is fully operational"
    fi
  else
    warn "API not responding (HTTP ${code})"
    info "Run:  ${BOLD}docker compose logs --tail=30 api${RST}"
  fi
  blank
}

# ════════════════════════════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

# ── Version ───────────────────────────────────────────────────────────────────
APP_VERSION="$(cat VERSION 2>/dev/null || echo 'dev')"
APP_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo '')"
APP_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"

clear

# ── Banner ────────────────────────────────────────────────────────────────────
blank
echo -e "  ${BOLD}${BLUE}╔═══════════════════════════════════════════════╗${RST}"
echo -e "  ${BOLD}${BLUE}║                                               ║${RST}"
echo -e "  ${BOLD}${BLUE}║   ${CYAN}▲ ${BOLD}S A N D H I L U X${BLUE}                        ║${RST}"
echo -e "  ${BOLD}${BLUE}║   ${DIM}Self-hosted uptime monitoring & alerts${BLUE}    ║${RST}"
echo -e "  ${BOLD}${BLUE}║                                               ║${RST}"
echo -e "  ${BOLD}${BLUE}╚═══════════════════════════════════════════════╝${RST}"
blank
echo -e "  ${DIM}Version  ${RST}${BOLD}v${APP_VERSION}${RST}${DIM}  ·  ${APP_COMMIT}  ·  ${APP_BRANCH}${RST}"
blank

# ── Ensure Docker is available (install if needed on Linux) ───────────────────
step "Checking prerequisites"
ensure_docker
blank

# ── Main menu ─────────────────────────────────────────────────────────────────
CHOICE=0
arrow_menu CHOICE \
  "  ${BOLD}What would you like to do?${RST}" \
  "🚀  Deploy / Rebuild         ${DIM}build images and start${RST}" \
  "🔄  Update                   ${DIM}git pull + rebuild${RST}" \
  "⏹   Stop                     ${DIM}stop all containers${RST}" \
  "📋  Logs                     ${DIM}stream live output${RST}" \
  "ℹ   Status                   ${DIM}container health + URL${RST}" \
  "✕   Exit"

case $CHOICE in
  0) action_deploy false ;;
  1) action_deploy true  ;;
  2) action_stop         ;;
  3) action_logs         ;;
  4) action_status       ;;
  5) blank; echo -e "  ${DIM}Bye.${RST}"; blank; exit 0 ;;
esac
