<div align="center">

# Sandhilux

**Self-hosted uptime monitoring & alerting**

Check your HTTP endpoints every minute. Get notified on Telegram the moment something breaks.

[![Go](https://img.shields.io/badge/Go-1.24-00ADD8?style=flat-square&logo=go&logoColor=white)](https://golang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

</div>

---

## What it does

- Monitors HTTP endpoints on a configurable schedule
- Tracks **uptime**, **P50 / P95 latency**, and **incident history**
- Fires **Telegram alerts** when endpoints go down, become slow, or return wrong status codes
- Streams live check results to the dashboard via **Server-Sent Events**
- Supports multiple users with **admin / viewer roles**

---

## Screenshots

> Dashboard · Endpoint detail · Alerts · Settings

---

## Quick start

```bash
git clone https://github.com/overclipse/Sandhilux.git
cd Sandhilux
bash scripts/deploy.sh
```

The script handles everything:

| Step | What happens |
|------|-------------|
| 1 | Installs Docker if missing *(Linux only — apt / dnf / yum)* |
| 2 | Generates `JWT_SECRET`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| 3 | Writes `.env` *(existing file is never overwritten)* |
| 4 | Builds images and starts containers |
| 5 | Prints the URL and first-run setup link |

Open `http://localhost:<port>` and create your admin account.

> Keep your `.env` file safe — it contains the database password.

---

## Manual setup

**Requirements:** Docker + Docker Compose V2

```bash
cp .env.example .env
# fill in JWT_SECRET, POSTGRES_USER, POSTGRES_PASSWORD
docker compose up -d
```

---

## Local development

```bash
# backend — requires Go 1.24+ and a running PostgreSQL instance
cp .env.example .env   # set DATABASE_URL, JWT_SECRET
go run ./cmd/api

# frontend — in a second terminal
cd web
npm install
npm run dev            # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `localhost:8080`.

---

## Configuration

All settings live in `.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ | — | Token signing key (`openssl rand -base64 32`) |
| `POSTGRES_USER` | ✅ | — | Database user |
| `POSTGRES_PASSWORD` | ✅ | — | Database password |
| `POSTGRES_DB` | ✅ | — | Database name |
| `PORT` | | `8080` | Host port exposed by Docker |
| `HTTP_ADDR` | | `:8080` | Server bind address |
| `CORS_ORIGIN` | | `http://localhost:5173` | Allowed CORS origin |

---

## API

All routes live under `/api`. Protected routes require `Authorization: Bearer <token>`.

<details>
<summary>Show all endpoints</summary>

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/auth/status` | — | Check if first-run setup is needed |
| `POST` | `/api/auth/setup` | — | Create the first admin account |
| `POST` | `/api/auth/login` | — | Login → JWT |
| `POST` | `/api/auth/register` | — | Register a viewer account |
| `POST` | `/api/auth/logout` | — | Logout |
| `GET` | `/api/me` | user | Current user profile |

### Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET / POST` | `/api/endpoints/` | user | List / create |
| `GET / PUT / DELETE` | `/api/endpoints/{id}` | user | Read / update / delete |
| `PATCH` | `/api/endpoints/{id}/toggle` | user | Enable or disable |
| `POST` | `/api/endpoints/{id}/check` | user | Run a check right now |
| `GET` | `/api/endpoints/{id}/history` | user | Paginated check log |
| `GET` | `/api/endpoints/{id}/stats` | user | P50, P95, incidents today |
| `GET / POST / DELETE` | `/api/endpoints/{id}/rules` | user | Alert rules CRUD |

### Metrics
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/metrics/overview` | user | Dashboard summary |
| `GET` | `/api/metrics/latency` | user | 24 h latency chart |
| `GET` | `/api/metrics/uptime` | user | 7-day uptime chart |
| `GET` | `/api/metrics/{id}` | user | Per-endpoint latency |
| `GET` | `/api/metrics/{id}/timeline` | user | Uptime timeline segments |
| `GET` | `/api/metrics/worst` | user | Worst performing endpoints |
| `GET` | `/api/metrics/incidents` | user | Recent incidents |

### Alerts & Settings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/alerts/` | user | Alert list |
| `PUT` | `/api/alerts/{id}/resolve` | user | Resolve an alert |
| `GET` | `/api/events` | user | SSE stream — live check events |
| `GET` | `/api/version` | user | App version, uptime, Go runtime |
| `GET / PUT / DELETE` | `/api/settings/users` | admin | User management |
| `GET / PUT` | `/api/settings/telegram` | admin | Telegram bot config |
| `POST` | `/api/settings/telegram/test` | admin | Send a test notification |

Auth routes are rate-limited to **10 requests / minute** per IP.

</details>

---

## Stack

| | |
|---|---|
| **Backend** | Go 1.24 · chi v5 · pgx/v5 · golang-jwt · bcrypt |
| **Frontend** | React 18 · TypeScript · Vite · Zustand · TanStack Query · Recharts |
| **Database** | PostgreSQL 16 — schema auto-migrated on startup |
| **Container** | Multi-stage Docker build — Node 22 → Go 1.24 → Alpine 3.21 |

---

## Project structure

```
├── cmd/api/                   entry point
├── internal/
│   ├── app/                   startup: DB, checker, broadcaster, HTTP server
│   ├── database/              connection pool + SQL migrations
│   ├── handler/               HTTP handlers + JWT helpers
│   ├── middleware/            auth, CORS, rate limiter, security headers
│   ├── router/                route wiring + SPA fallback
│   └── service/checker/       periodic HTTP prober + SSE broadcaster
├── scripts/
│   ├── deploy.sh              interactive self-hosted deploy
│   └── test_auth.sh           auth smoke tests
├── web/src/
│   ├── pages/                 Dashboard · Endpoints · Alerts · Settings · Login
│   ├── components/            MetricCard · EndpointRow · LatencyChart · UptimeTimeline …
│   ├── api/                   Axios API wrappers
│   ├── store/                 Zustand (auth · theme · locale)
│   ├── i18n/                  en / ru locale files
│   └── styles/                CSS variables · light theme · global utilities
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## License

MIT
