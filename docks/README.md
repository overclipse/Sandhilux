# Sandhilux — API Reference

Base URL: `http://localhost:8080`

---

## Общие правила

### Формат ошибок

Все ошибки возвращают JSON:
```json
{ "error": "описание ошибки" }
```

### HTTP статусы

| Код | Описание |
|-----|----------|
| `200` | OK — успешный запрос с телом |
| `201` | Created — ресурс создан |
| `204` | No Content — успешно, без тела (DELETE) |
| `400` | Bad Request — невалидный JSON или параметры |
| `401` | Unauthorized — токен отсутствует или истёк |
| `404` | Not Found — ресурс не найден |
| `500` | Internal Server Error — ошибка сервера |

### Авторизация

Все `/api/*` запросы (кроме `/api/auth/*`) требуют заголовок:
```
Authorization: Bearer <jwt_token>
```

---

## Auth

### `GET /api/auth/status`
Проверяет, нужна ли первоначальная настройка (нет ни одного пользователя).

**Response `200`:**
```json
{ "setup_required": true }
```

---

### `POST /api/auth/setup`
Создаёт первого администратора. Возвращает `403` если пользователь уже существует.

**Body:**
```json
{ "email": "admin@example.com", "password": "min8chars", "name": "Admin" }
```

**Response `200`:**
```json
{ "token": "<jwt>" }
```

**Ошибки:**
- `400` — email/password пустые или пароль короче 8 символов
- `403` — пользователь уже существует

---

### `POST /api/auth/login`
Email + пароль → JWT.

**Body:**
```json
{ "email": "admin@example.com", "password": "yourpassword" }
```

**Response `200`:**
```json
{ "token": "<jwt>" }
```

**Ошибки:**
- `401` — неверный email или пароль (одинаковый ответ для обоих случаев)

---

### `POST /api/auth/logout`
**Response:** `204 No Content`

---

### `GET /api/me`
Профиль текущего пользователя из JWT.

**Response `200`:**
```json
{
  "id": "uuid",
  "email": "user@gmail.com",
  "role": "admin",
  "name": "Pavel",
  "avatar_url": "https://..."
}
```

**Ошибки:**
- `401` — нет или невалидный Bearer токен

---

## Endpoints

### `GET /api/endpoints`
Список всех эндпоинтов.

**Response `200`:** `[]Endpoint`
```json
[
  {
    "id": "uuid",
    "name": "My API",
    "url": "https://api.example.com/health",
    "method": "GET",
    "headers": {},
    "body": "",
    "check_interval": 60,
    "timeout": 10,
    "expected_status": 200,
    "latency_threshold": 2000,
    "enabled": true,
    "status": "up",
    "uptime_24h": 99.9,
    "avg_latency": 145,
    "last_checked_at": "2026-03-15T12:00:00Z",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

`status` — `"up" | "down" | "slow"`

---

### `POST /api/endpoints`
Создать эндпоинт.

**Body:**
```json
{
  "name": "My API",
  "url": "https://api.example.com/health",
  "method": "GET",
  "headers": { "Authorization": "Bearer token" },
  "body": "",
  "check_interval": 60,
  "timeout": 10,
  "expected_status": 200,
  "latency_threshold": 2000,
  "enabled": true
}
```

`name` и `url` — обязательные. `headers` — объект, остальные опциональны.

**Response `201`:** `Endpoint`

**Ошибки:**
- `400` — `name` или `url` пустые / невалидный JSON

---

### `GET /api/endpoints/{id}`
**Response `200`:** `Endpoint`

**Ошибки:**
- `404` — эндпоинт не найден

---

### `PUT /api/endpoints/{id}`
Обновить эндпоинт. Тело — как у POST.

**Response `200`:** `Endpoint`

**Ошибки:** `400`, `404`

---

### `DELETE /api/endpoints/{id}`
**Response `204`**

**Ошибки:** `404`

---

### `POST /api/endpoints/{id}/check`
Принудительно запустить проверку прямо сейчас.

**Response `200`:**
```json
{
  "id": "uuid",
  "endpoint_id": "uuid",
  "is_up": true,
  "status": "up",
  "status_code": 200,
  "latency_ms": 120,
  "error": "",
  "checked_at": "2026-03-15T12:00:00Z"
}
```

---

### `GET /api/endpoints/{id}/rules`
**Response `200`:** `[]AlertRule`
```json
[
  {
    "id": "uuid",
    "endpoint_id": "uuid",
    "type": "down",
    "threshold": null,
    "consecutive_fails": 3,
    "notify_telegram": true,
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

`type` — `"down" | "latency_gt" | "status_code"`

---

### `POST /api/endpoints/{id}/rules`
**Body:**
```json
{
  "type": "latency_gt",
  "threshold": 2000,
  "consecutive_fails": null,
  "notify_telegram": false
}
```

- `type: "down"` → заполни `consecutive_fails` (сколько провалов подряд)
- `type: "latency_gt"` → заполни `threshold` (мс)
- `type: "status_code"` → заполни `threshold` (ожидаемый статус код)

**Response `201`:** `AlertRule`

**Ошибки:**
- `400` — `type` пустой

---

### `DELETE /api/endpoints/{id}/rules/{ruleID}`
**Response `204`**

---

### `GET /api/endpoints/{id}/history?limit=50&offset=0`
История проверок из ClickHouse.

**Query params:**
- `limit` — default 50
- `offset` — default 0

**Response `200`:** `[]CheckRecord`
```json
[
  {
    "id": "uuid",
    "endpoint_id": "uuid",
    "is_up": true,
    "status": "up",
    "status_code": 200,
    "latency_ms": 120,
    "error": "",
    "checked_at": "2026-03-15T12:00:00Z"
  }
]
```

---

### `GET /api/endpoints/{id}/stats`
**Response `200`:**
```json
{
  "p50_latency": 120,
  "p95_latency": 450,
  "incidents_7d": 2,
  "checks_today": 1440
}
```

---

## Metrics

### `GET /api/metrics/overview?period=24h`
Сводка для дашборда.

**Query:** `period` — `"1h" | "24h" | "7d" | "30d"` (default `24h`)

**Response `200`:**
```json
{
  "total_endpoints": 12,
  "online_endpoints": 11,
  "avg_uptime_24h": 99.5,
  "avg_latency": 178,
  "active_alerts": 1,
  "uptime_trend": 0.3,
  "latency_trend": -12.0
}
```

`uptime_trend` / `latency_trend` — дельта относительно предыдущего периода.

---

### `GET /api/metrics/latency`
Агрегированная задержка, последние 24ч.

**Response `200`:** `[]LatencyPoint`
```json
[{ "time": "2026-03-15T10:00:00Z", "latency": 145, "status_code": 200 }]
```

---

### `GET /api/metrics/uptime`
Аптайм по дням, последние 7 дней.

**Response `200`:** `[]DailyUptime`
```json
[{ "date": "2026-03-15", "uptime": 99.8 }]
```

---

### `GET /api/metrics/{id}?period=24h`
Задержка по конкретному эндпоинту.

**Query:** `period` — `"1h" | "24h" | "7d" | "30d"`

**Response `200`:** `[]LatencyPoint`

---

### `GET /api/metrics/{id}/uptime`
Аптайм по дням для конкретного эндпоинта (7 дней).

**Response `200`:** `[]DailyUptime`

---

## Alerts

### `GET /api/alerts?status=active&period=7d&type=down&endpoint_id=uuid`
**Query (все опциональны):**
- `status` — `"active" | "resolved"` (без параметра — все)
- `period` — `"today" | "7d" | "30d"`
- `type` — `"down" | "slow" | "status"`
- `endpoint_id` — UUID

**Response `200`:** `[]Alert`
```json
[
  {
    "id": "uuid",
    "endpoint_id": "uuid",
    "endpoint_name": "My API",
    "type": "down",
    "status": "active",
    "message": "Endpoint is down",
    "rule_type": "down",
    "rule_detail": "3 consecutive failures",
    "telegram_sent": true,
    "created_at": "2026-03-15T10:00:00Z",
    "resolved_at": null
  }
]
```

---

### `PUT /api/alerts/{id}/resolve`
**Response `200`:** `Alert` с `status: "resolved"` и `resolved_at`

**Ошибки:** `404`

---

## Settings

### `GET /api/settings/users`
**Response `200`:** `[]User`
```json
[
  {
    "id": "uuid",
    "email": "user@gmail.com",
    "role": "admin",
    "name": "Pavel",
    "avatar_url": "https://...",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

---

### `PUT /api/settings/users/{id}/role`
**Body:**
```json
{ "role": "viewer" }
```

**Response `200`:** `User`

**Ошибки:**
- `400` — роль не `"admin"` / `"viewer"`, или попытка изменить свою роль
- `404`

---

### `DELETE /api/settings/users/{id}`
**Response `204`**

**Ошибки:**
- `400` — нельзя удалить себя
- `404`

---

### `GET /api/settings/telegram`
**Response `200`:**
```json
{
  "bot_token": "123456:ABC***",
  "chat_id": "-1001234567890",
  "configured": true
}
```

---

### `PUT /api/settings/telegram`
**Body:**
```json
{ "bot_token": "123456:ABCDEF", "chat_id": "-1001234567890" }
```

**Response `200`:** `TelegramSettings`

---

### `POST /api/settings/telegram/test`
**Response `200`:** `{ "ok": true }`

**Ошибки:**
- `400` — Telegram не настроен
- `500` — ошибка отправки

---

## SSE (Server-Sent Events)

### `GET /api/events?token=<jwt>`
Стрим реальновременных событий. Токен передаётся через query param, т.к. `EventSource` не поддерживает заголовки.

**Content-Type:** `text/event-stream`

**Типы событий:**

```
data: {"type":"check_result","data":{
  "endpoint_id":"uuid",
  "is_up":true,
  "latency_ms":120,
  "status_code":200,
  "status":"up",
  "checked_at":"2026-03-15T12:00:00Z"
}}

data: {"type":"alert_created","data":{...Alert...}}

data: {"type":"alert_resolved","data":{"alert_id":"uuid"}}

data: {"type":"endpoint_status","data":{"endpoint_id":"uuid","is_up":false}}
```

`: heartbeat` — каждые 30 сек для поддержания соединения.

---

## TypeScript типы

```typescript
type EndpointStatus  = 'up' | 'down' | 'slow'
type UserRole        = 'admin' | 'viewer'
type AlertType       = 'down' | 'slow' | 'status'
type AlertStatus     = 'active' | 'resolved'
type AlertRuleType   = 'down' | 'latency_gt' | 'status_code'

interface User {
  id: string;  email: string;  role: UserRole
  name?: string;  avatar_url?: string;  created_at: string
}
interface Endpoint {
  id: string;  name: string;  url: string;  method: string
  headers?: Record<string, string>;  body?: string
  check_interval: number;  timeout: number
  expected_status?: number;  latency_threshold?: number;  enabled: boolean
  status: EndpointStatus;  uptime_24h: number;  avg_latency: number
  last_checked_at: string;  created_at: string
}
interface AlertRule {
  id: string;  endpoint_id: string;  type: AlertRuleType
  threshold?: number;  consecutive_fails?: number
  notify_telegram: boolean;  created_at: string
}
interface Alert {
  id: string;  endpoint_id: string;  endpoint_name: string
  type: AlertType;  status: AlertStatus;  message: string
  rule_type: string;  rule_detail: string;  telegram_sent: boolean
  created_at: string;  resolved_at?: string
}
interface CheckRecord {
  id: string;  endpoint_id: string;  is_up: boolean
  status: EndpointStatus;  status_code: number;  latency_ms: number
  error?: string;  checked_at: string
}
interface MetricsOverview {
  total_endpoints: number;  online_endpoints: number
  avg_uptime_24h: number;  avg_latency: number;  active_alerts: number
  uptime_trend: number;  latency_trend: number
}
interface LatencyPoint  { time: string; latency: number; status_code: number }
interface DailyUptime   { date: string; uptime: number }
interface TelegramSettings { bot_token: string; chat_id: string; configured: boolean }
```

---

## Обработка ошибок на фронтенде

### Структура ответа с ошибкой
```json
{ "error": "текст ошибки" }
```

### Axios interceptor (уже реализован в `api/client.ts`)
```typescript
// 401 → автоматически очищает auth и редиректит на /login
client.interceptors.response.use(res => res, error => {
  if (error.response?.status === 401) {
    useAppStore.getState().clearAuth()
    window.location.href = '/login'
  }
  return Promise.reject(error)
})
```

### getErrorMessage (реализован в `utils/error.ts`)
```typescript
function getErrorMessage(err: unknown): string {
  const e = err as AxiosError<{ error?: string }>
  if (e.response?.data?.error) return e.response.data.error      // ответ сервера
  if (e.code === 'ERR_NETWORK')  return 'Сервер недоступен'       // нет соединения
  return e.message ?? 'Что-то пошло не так'
}
```

### Паттерн использования с react-query
```typescript
const { data, error, refetch } = useQuery({
  queryKey: ['endpoints'],
  queryFn: endpointsApi.list,
})

// в JSX:
{error && <ErrorBanner message={getErrorMessage(error)} onRetry={() => refetch()} />}
```

### Коды ошибок которые нужно обрабатывать явно
| Код | Что делать на фронтенде |
|-----|------------------------|
| `400` | Показать текст из `error` поля в форме / баннере |
| `401` | Обрабатывается автоматически в interceptor → редирект на `/login` |
| `404` | Показать "не найдено", редирект или пустое состояние |
| `500` | Показать `ErrorBanner` с текстом из `error` и кнопкой Retry |
| network error | `ERR_NETWORK` → "Сервер недоступен. Проверьте что бэкенд запущен." |
