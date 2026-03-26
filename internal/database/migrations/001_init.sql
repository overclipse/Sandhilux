-- ============================================================
-- PostgreSQL schema for Sandhilux
-- Запускается при старте через //go:embed, должна быть идемпотентной
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
-- Email + password auth. First user becomes admin.
-- No external OAuth dependencies — fully self-hosted.
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    name          TEXT NOT NULL DEFAULT '',
    avatar_url    TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'viewer'
                       CHECK (role IN ('admin', 'viewer')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Endpoints ────────────────────────────────────────────────
-- Мониторируемые URL. user_id — кто создал (для аудита),
-- ON DELETE SET NULL чтобы удаление юзера не уничтожало эндпоинты.
-- Поля uptime_24h / avg_latency — кеш, пересчитываются чекером.
CREATE TABLE IF NOT EXISTS endpoints (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    name              TEXT NOT NULL,
    url               TEXT NOT NULL,
    method            TEXT NOT NULL DEFAULT 'GET',
    headers           JSONB NOT NULL DEFAULT '{}',
    body              TEXT NOT NULL DEFAULT '',
    check_interval    INT  NOT NULL DEFAULT 60,
    timeout           INT  NOT NULL DEFAULT 10,
    expected_status   INT,
    latency_threshold INT,
    follow_redirects  BOOLEAN NOT NULL DEFAULT false,
    enabled           BOOLEAN NOT NULL DEFAULT true,
    status            TEXT NOT NULL DEFAULT 'up'
                           CHECK (status IN ('up', 'down', 'slow')),
    uptime_24h        DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    avg_latency       INT NOT NULL DEFAULT 0,
    last_checked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Incremental column additions (safe to re-run) ──────────────────────────
-- ALTER TABLE … ADD COLUMN IF NOT EXISTS works on existing tables where
-- CREATE TABLE IF NOT EXISTS won't add new columns.
ALTER TABLE endpoints ADD COLUMN IF NOT EXISTS follow_redirects BOOLEAN NOT NULL DEFAULT false;

-- Чекер делает SELECT ... WHERE enabled = true каждый тик.
-- Partial index: только enabled-строки попадают в индекс, ~50% меньше.
CREATE INDEX IF NOT EXISTS idx_endpoints_enabled
    ON endpoints(id) WHERE enabled = true;

-- Фильтрация по статусу на дашборде.
CREATE INDEX IF NOT EXISTS idx_endpoints_status
    ON endpoints(status);

-- ── Alert rules ──────────────────────────────────────────────
-- Правила когда создавать алерт: down (N фейлов подряд),
-- latency_gt (порог мс), status_code (неожиданный код).
CREATE TABLE IF NOT EXISTS alert_rules (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id       UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    type              TEXT NOT NULL CHECK (type IN ('down', 'latency_gt', 'status_code')),
    threshold         INT,
    consecutive_fails INT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_endpoint_id
    ON alert_rules(endpoint_id);

-- ── Alerts ───────────────────────────────────────────────────
-- Сработавшие алерты. endpoint_name дублируется намеренно —
-- если эндпоинт удалят, в истории останется имя.
CREATE TABLE IF NOT EXISTS alerts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id    UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    endpoint_name  TEXT NOT NULL,
    type           TEXT NOT NULL CHECK (type IN ('down', 'slow', 'status')),
    status         TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'resolved')),
    message        TEXT NOT NULL DEFAULT '',
    rule_type      TEXT NOT NULL DEFAULT '',
    rule_detail    TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ
);

-- Композитный индекс: GET /api/alerts?status=active — самый частый запрос.
-- (status, created_at DESC) покрывает фильтр + сортировку без filesort.
CREATE INDEX IF NOT EXISTS idx_alerts_status_created
    ON alerts(status, created_at DESC);

-- Алерты по конкретному эндпоинту (детальная страница).
CREATE INDEX IF NOT EXISTS idx_alerts_endpoint_id
    ON alerts(endpoint_id);

-- ── View: endpoints_due ───────────────────────────────────────
-- Эндпоинты у которых пришло время следующей проверки.
-- Чекер делает SELECT * FROM endpoints_due вместо сырого запроса.
-- CREATE OR REPLACE — идемпотентно, можно перезапускать.
CREATE OR REPLACE VIEW endpoints_due AS
SELECT id, name, url, method, headers, body,
       check_interval, timeout,
       COALESCE(expected_status, 0) AS expected_status,
       COALESCE(latency_threshold, 0) AS latency_threshold,
       follow_redirects
FROM endpoints
WHERE enabled = true
  AND last_checked_at + (check_interval || ' seconds')::interval < now();

-- ── Check records ────────────────────────────────────────────
-- Time-series: результаты каждой HTTP-проверки.
-- Заменяет ClickHouse — работает на любой платформе.
CREATE TABLE IF NOT EXISTS check_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES endpoints(id) ON DELETE CASCADE,
    is_up       BOOLEAN NOT NULL,
    status      TEXT NOT NULL DEFAULT 'up',
    status_code INT NOT NULL DEFAULT 0,
    latency_ms  INT NOT NULL DEFAULT 0,
    error       TEXT NOT NULL DEFAULT '',
    checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Основной индекс: запросы по эндпоинту за период (метрики, графики).
CREATE INDEX IF NOT EXISTS idx_check_records_endpoint_checked
    ON check_records(endpoint_id, checked_at DESC);

-- Для агрегатов по всем эндпоинтам (дашборд).
CREATE INDEX IF NOT EXISTS idx_check_records_checked_at
    ON check_records(checked_at DESC);

-- ── Function: fn_update_endpoint_check ───────────────────────
-- Обновляет кеш-поля эндпоинта после проверки, включая uptime_24h.
CREATE OR REPLACE FUNCTION fn_update_endpoint_check(
    p_id          UUID,
    p_status      TEXT,
    p_avg_latency INT,
    p_checked_at  TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_uptime DOUBLE PRECISION;
BEGIN
    SELECT COALESCE(AVG(is_up::int) * 100, 100.0)
    INTO v_uptime
    FROM check_records
    WHERE endpoint_id = p_id
      AND checked_at >= NOW() - INTERVAL '24 hours';

    UPDATE endpoints
    SET status          = p_status,
        avg_latency     = p_avg_latency,
        last_checked_at = p_checked_at,
        uptime_24h      = v_uptime
    WHERE id = p_id;
END;
$$;
