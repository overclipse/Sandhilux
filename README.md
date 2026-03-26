# Sandhilux

Self-hosted uptime monitoring and alerting platform. Periodically checks HTTP endpoints, records latency and uptime metrics, and notifies you via Telegram when services go down or become slow.

![Go](https://img.shields.io/badge/Go-1.24-00ADD8?logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)

---

## Features

- **Endpoint monitoring** — HTTP checks with configurable method, headers, and body
- **Real-time dashboard** — SSE-powered live updates, latency and uptime charts
- **Alert rules** — trigger on consecutive failures, latency threshold, or status code mismatch
- **Telegram notifications** — instant alerts when rules fire, with test button
- **Check history** — paginated log with latency bar, status filter, CSV export
- **P50 / P95 latency** — per-endpoint stats with incident count
- **RBAC** — admin and viewer roles, user management panel
- **i18n** — English and Russian UI
- **Light / dark theme** — persisted in localStorage

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.24, [chi v5](https://github.com/go-chi/chi), pgx/v5, golang-jwt/v5, bcrypt |
| Frontend | React 18, TypeScript, Vite, Zustand, TanStack Query, Recharts |
| Database | PostgreSQL 16 (auto-migrated on startup) |
| Container | Multi-stage Docker build — Node 22 → Go 1.24 → Alpine 3.21 |

---

## Quick start

### One-command deploy (Linux / macOS)

```bash
git clone https://github.com/overclipse/Sandhilux.git
cd Sandhilux
bash scripts/deploy.sh
```

The script will:
1. Install Docker automatically if it is not present (Linux only — `apt` / `dnf` / `yum`)
2. Generate a random `JWT_SECRET`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`
3. Write a `.env` file (existing `.env` is never overwritten)
4. Build images and start containers
5. Print the local URL and first-run setup instructions

> **Keep your `.env` file safe.** Losing the `POSTGRES_PASSWORD` requires a database reset.

---

### Manual setup

**Prerequisites:** Docker + Docker Compose V2

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET, POSTGRES_USER, POSTGRES_PASSWORD
docker compose up -d
```

App is available at `http://localhost:8080`.

---

### Local development (without Docker)

**Backend**

```bash
# Requires Go 1.24+ and a running PostgreSQL instance
cp .env.example .env
# Edit DATABASE_URL to point to your local Postgres
go run ./cmd/api
```

**Frontend**

```bash
cd web
npm install
npm run dev   # Vite dev server on http://localhost:5173
```

The Vite proxy forwards `/api/*` to `http://localhost:8080`.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | HS256 signing key — `openssl rand -base64 32` |
| `POSTGRES_USER` | Yes | PostgreSQL username |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password |
| `POSTGRES_DB` | Yes | PostgreSQL database name |
| `PORT` | No | Host port exposed by Docker Compose (default `8080`) |
| `HTTP_ADDR` | No | Server bind address (default `:8080`) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default `http://localhost:5173`) |

All variables are read from `.env` at startup (via `godotenv`).

---

## API overview

All routes are under `/api`. Protected routes require `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/auth/status` | — | Setup required? |
| `POST` | `/api/auth/setup` | — | Create first admin account |
| `POST` | `/api/auth/login` | — | Login → JWT |
| `POST` | `/api/auth/register` | — | Register viewer account |
| `GET` | `/api/me` | user | Current user profile |
| `GET` | `/api/events` | user | SSE stream (real-time checks & alerts) |
| `GET/POST` | `/api/endpoints/` | user | List / create endpoints |
| `GET/PUT/DELETE` | `/api/endpoints/{id}` | user | Read / update / delete |
| `PATCH` | `/api/endpoints/{id}/toggle` | user | Enable / disable |
| `POST` | `/api/endpoints/{id}/check` | user | Run check now |
| `GET` | `/api/endpoints/{id}/history` | user | Paginated check log |
| `GET` | `/api/endpoints/{id}/stats` | user | P50, P95, incidents |
| `GET/POST/DELETE` | `/api/endpoints/{id}/rules` | user | Alert rules CRUD |
| `GET` | `/api/metrics/overview` | user | Dashboard summary |
| `GET` | `/api/metrics/latency` | user | 24h latency chart |
| `GET` | `/api/metrics/uptime` | user | 7-day uptime chart |
| `GET` | `/api/alerts/` | user | Alert list |
| `PUT` | `/api/alerts/{id}/resolve` | user | Resolve alert |
| `GET/PUT/DELETE` | `/api/settings/users` | admin | User management |
| `GET/PUT` | `/api/settings/telegram` | admin | Telegram config |
| `POST` | `/api/settings/telegram/test` | admin | Send test notification |

Auth-related routes are rate-limited to **10 requests per minute** per IP.

---

## Project structure

```
├── cmd/api/              entry point
├── internal/
│   ├── app/              startup: DB, checker, SSE broadcaster, HTTP server
│   ├── database/         PostgreSQL pool + auto-migrations
│   ├── handler/          HTTP handlers + JWT helpers
│   ├── middleware/        auth, CORS, rate limiter, security headers
│   ├── router/           chi router wiring + SPA fallback
│   └── service/checker/  periodic HTTP prober + SSE broadcaster
├── scripts/
│   ├── deploy.sh         interactive self-hosted deploy
│   └── test_auth.sh      smoke tests for auth endpoints
├── web/
│   └── src/
│       ├── pages/        Dashboard, Endpoints, Alerts, Settings, Login
│       ├── components/   MetricCard, EndpointRow, LatencyChart, UptimeTimeline …
│       ├── api/          Axios wrappers
│       ├── store/        Zustand store (auth, theme, locale)
│       ├── i18n/         en / ru locale files
│       └── styles/       CSS variables, light theme, global utilities
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## First login

On the first visit the setup form appears. Create an admin account — username and password only, no email required.

Additional users can self-register as **viewer** via the login page toggle, or an admin can create them in **Settings → Users**.

---

## License

MIT
