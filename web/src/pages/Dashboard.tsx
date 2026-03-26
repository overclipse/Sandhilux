import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Refresh01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { metricsApi } from "../api/metrics";
import type { DashboardPeriod } from "../api/metrics";
import { endpointsApi } from "../api/endpoints";
import { useAppStore } from "../store";
import { MetricCard } from "../components/MetricCard";
import { LatencyChart } from "../components/LatencyChart";
import { UptimeChart } from "../components/UptimeChart";
import { StatusDot } from "../components/StatusDot";
import { RoleGuard } from "../components/RoleGuard";
import { ErrorBanner } from "../components/ErrorBanner";
import { getErrorMessage } from "../utils/error";
import { useT } from "../i18n";
import type { EndpointStatus } from "../types/api";
import styles from "./Dashboard.module.css";

function formatDuration(start: string, end?: string): string {
  const ms =
    (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

const PERIODS: DashboardPeriod[] = ["24h", "7d", "30d"];

function FreshnessDot({
  fresh,
  label,
  updatedAt,
  styles: s,
}: {
  fresh: boolean;
  label: string;
  updatedAt: number | null;
  styles: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—";
  return (
    <div className={s.freshnessWrap}>
      <button
        className={`${s.freshnessDot} ${fresh ? s.fresh : s.stale}`}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-label="freshness"
      />
      {open && (
        <div className={s.freshnessPopover}>
          <span className={`${s.freshnessPopDot} ${fresh ? s.fresh : s.stale}`} />
          <span className={s.freshnessPopLabel}>{label}</span>
          <span className={s.freshnessPopTime}>{time}</span>
        </div>
      )}
    </div>
  );
}

interface ProblemItem {
  id: string;
  endpointId: string;
  name: string;
  status: EndpointStatus;
  uptime?: number;
  incidentType?: string;
  duration?: string;
  isOngoing: boolean;
}

export function Dashboard() {
  const t = useT();
  const navigate = useNavigate();
  const setEndpoints = useAppStore((s) => s.setEndpoints);
  const endpoints = useAppStore((s) => s.endpoints);

  const [period, setPeriod] = useState<DashboardPeriod>("24h");
  const [autoRefreshSec, setAutoRefreshSec] = useState<0 | 5 | 10>(0);
  const [nowTs, setNowTs] = useState(Date.now());

  const {
    data: overview,
    refetch: refetchOverview,
    isFetching,
    isLoading: overviewLoading,
    error: overviewError,
    dataUpdatedAt: overviewUpdatedAt,
  } = useQuery({
    queryKey: ["overview", period],
    queryFn: () => metricsApi.overview(period),
  });

  const {
    data: latencyData = [],
    error: latencyError,
    refetch: refetchLatency,
    dataUpdatedAt: latencyUpdatedAt,
  } = useQuery({
    queryKey: ["dashboard-latency", period],
    queryFn: () => metricsApi.dashboardLatency(period),
  });

  const {
    data: uptimeData = [],
    error: uptimeError,
    refetch: refetchUptime,
    dataUpdatedAt: uptimeUpdatedAt,
  } = useQuery({
    queryKey: ["dashboard-uptime", period],
    queryFn: () => metricsApi.dashboardUptime(period),
  });

  const {
    data: worstData = [],
    refetch: refetchWorst,
    dataUpdatedAt: worstUpdatedAt,
  } = useQuery({
    queryKey: ["dashboard-worst", period],
    queryFn: () => metricsApi.worst(period),
  });

  const {
    data: incidentsData = [],
    refetch: refetchIncidents,
    dataUpdatedAt: incidentsUpdatedAt,
  } = useQuery({
    queryKey: ["dashboard-incidents"],
    queryFn: () => metricsApi.incidents(),
  });

  const {
    error: endpointsError,
    refetch: refetchEndpoints,
    dataUpdatedAt: endpointsUpdatedAt,
  } = useQuery({
    queryKey: ["endpoints"],
    queryFn: async () => {
      const data = await endpointsApi.list();
      setEndpoints(data);
      return data;
    },
  });

  const refreshAll = () => {
    refetchOverview();
    refetchEndpoints();
    refetchLatency();
    refetchUptime();
    refetchWorst();
    refetchIncidents();
  };

  useEffect(() => {
    if (autoRefreshSec === 0) return;
    const timer = window.setInterval(refreshAll, autoRefreshSec * 1000);
    return () => window.clearInterval(timer);
  }, [
    autoRefreshSec,
    period,
    refetchOverview,
    refetchEndpoints,
    refetchLatency,
    refetchUptime,
    refetchWorst,
    refetchIncidents,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const firstError =
    overviewError || endpointsError || latencyError || uptimeError;

  const latestUpdatedAt = Math.max(
    overviewUpdatedAt || 0,
    endpointsUpdatedAt || 0,
    latencyUpdatedAt || 0,
    uptimeUpdatedAt || 0,
    worstUpdatedAt || 0,
    incidentsUpdatedAt || 0,
  );

  const freshness = useMemo(() => {
    if (!latestUpdatedAt) {
      return { label: t("dashboard.freshUnknown"), fresh: false };
    }
    const ageSec = Math.floor((nowTs - latestUpdatedAt) / 1000);
    const threshold = autoRefreshSec > 0 ? autoRefreshSec * 2 + 1 : 30;
    if (ageSec <= threshold) {
      return { label: t("dashboard.fresh"), fresh: true };
    }
    return { label: t("dashboard.stale"), fresh: false };
  }, [latestUpdatedAt, nowTs, autoRefreshSec, t]);

  // ── Worst endpoint ────────────────────────────────
  const worstEndpoint =
    worstData.length > 0
      ? [...worstData].sort((a, b) => a.uptime - b.uptime)[0]
      : null;

  // ── Chart stats ───────────────────────────────────
  const sortedLatencies = [...latencyData]
    .map((p) => p.latency)
    .sort((a, b) => a - b);
  const p50Latency =
    sortedLatencies.length > 0
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.5)]
      : undefined;
  const p95Latency =
    sortedLatencies.length > 0
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)]
      : undefined;

  // ── Merged problem list (worst + incidents, deduplicated) ──
  const mergedProblems = useMemo<ProblemItem[]>(() => {
    const map = new Map<string, ProblemItem>();

    worstData
      .filter((w) => w.uptime < 100)
      .forEach((w) => {
        map.set(w.id, {
          id: w.id,
          endpointId: w.id,
          name: w.name,
          status: w.status,
          uptime: w.uptime,
          isOngoing: false,
        });
      });

    const incidents = Array.isArray(incidentsData) ? incidentsData : [];
    incidents
      .slice()
      .sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (a.status !== "active" && b.status === "active") return 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      })
      .slice(0, 10)
      .forEach((inc) => {
        const existing = map.get(inc.endpoint_id);
        if (existing) {
          existing.incidentType = inc.type;
          existing.duration = formatDuration(
            inc.created_at,
            inc.resolved_at ?? undefined,
          );
          existing.isOngoing = inc.status === "active";
        } else {
          map.set(inc.endpoint_id, {
            id: inc.id,
            endpointId: inc.endpoint_id,
            name: inc.endpoint_name,
            status: inc.type === "down" ? "down" : "slow",
            incidentType: inc.type,
            duration: formatDuration(
              inc.created_at,
              inc.resolved_at ?? undefined,
            ),
            isOngoing: inc.status === "active",
          });
        }
      });

    return Array.from(map.values())
      .sort((a, b) => {
        if (a.isOngoing && !b.isOngoing) return -1;
        if (!a.isOngoing && b.isOngoing) return 1;
        if (a.status === "down" && b.status !== "down") return -1;
        if (a.status !== "down" && b.status === "down") return 1;
        return (a.uptime ?? 100) - (b.uptime ?? 100);
      })
      .slice(0, 7);
  }, [worstData, incidentsData]);

  // ── Regressions (exclude already-shown problems) ──
  const problemIds = new Set(mergedProblems.map((p) => p.endpointId));
  const regressions = endpoints
    .map((ep) => {
      const worst = worstData.find((w) => w.id === ep.id);
      const uptimePenalty = Math.max(0, 100 - (worst?.uptime ?? ep.uptime_24h));
      const latencyPenalty = ep.latency_threshold
        ? Math.max(
            0,
            (ep.avg_latency - ep.latency_threshold) / ep.latency_threshold,
          ) * 100
        : ep.avg_latency > 800
          ? (ep.avg_latency - 800) / 8
          : 0;
      const statusPenalty = !ep.enabled
        ? 0
        : ep.status === "down"
          ? 120
          : ep.status === "slow"
            ? 60
            : 0;
      const score = Math.round(uptimePenalty + latencyPenalty + statusPenalty);
      return { ...ep, score };
    })
    .filter((ep) => ep.score > 0 && !problemIds.has(ep.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // ── Active alerts count ───────────────────────────
  const activeAlerts = overview?.active_alerts ?? 0;

  return (
    <div className={styles.page}>
      {/* ── TOPBAR ────────────────────────────────── */}
      <div className={styles.topbar}>
        <div className={styles.titleWrap}>
          <h1 className={styles.pageTitle}>{t("dashboard.title")}</h1>
          <FreshnessDot
            fresh={freshness.fresh}
            label={freshness.label}
            updatedAt={latestUpdatedAt}
            styles={styles}
          />
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.periodGroup}>
            {PERIODS.map((p) => (
              <button
                key={p}
                className={`${styles.periodBtn} ${period === p ? styles.periodActive : ""}`}
                onClick={() => setPeriod(p)}
              >
                {t(`dashboard.period.${p}`)}
              </button>
            ))}
          </div>
          <div className={styles.autoRefreshGroup}>
            {[0, 5, 10].map((v) => (
              <button
                key={v}
                className={`${styles.autoBtn} ${autoRefreshSec === v ? styles.autoBtnActive : ""}`}
                onClick={() => setAutoRefreshSec(v as 0 | 5 | 10)}
              >
                {v === 0 ? t("dashboard.autoOff") : `${v}s`}
              </button>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={refreshAll}
            disabled={isFetching}
          >
            {isFetching ? (
              <span className="spinner" />
            ) : (
              <HugeiconsIcon icon={Refresh01Icon} size={14} strokeWidth={2} />
            )}{" "}
            {t("dashboard.refresh")}
          </button>
          <RoleGuard role="admin">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate("/endpoints/new")}
            >
              <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />{" "}
              {t("dashboard.addEndpoint")}
            </button>
          </RoleGuard>
        </div>
      </div>

      {firstError && (
        <ErrorBanner
          message={getErrorMessage(firstError)}
          onRetry={refreshAll}
        />
      )}

      {/* ── SECTION 1: Critical ───────────────────── */}
      <div className={styles.criticalRow}>
        <div
          className={`card ${styles.criticalCard} ${
            activeAlerts > 0 ? styles.criticalCardDanger : styles.criticalCardOk
          }`}
        >
          <span className={styles.criticalLabel}>
            {t("dashboard.activeAlerts")}
          </span>
          <span
            className={`${styles.criticalValue} ${
              activeAlerts > 0 ? styles.criticalValueDanger : ""
            }`}
          >
            {activeAlerts}
          </span>
          {activeAlerts > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/alerts")}
            >
              {t("dashboard.allIncidents")}
            </button>
          )}
        </div>

        <div
          className={`card ${styles.criticalCard} ${
            worstEndpoint && worstEndpoint.uptime < 90
              ? styles.criticalCardDanger
              : styles.criticalCardOk
          }`}
        >
          <span className={styles.criticalLabel}>
            {t("dashboard.worstEndpoint")}
          </span>
          <span className={styles.criticalValue}>
            {worstEndpoint ? worstEndpoint.name : "—"}
          </span>
          {worstEndpoint && (
            <span
              className={`${styles.criticalMeta} ${
                worstEndpoint.uptime < 95 ? styles.criticalMetaDanger : ""
              }`}
            >
              {worstEndpoint.uptime.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* ── SECTION 2: Key metrics ────────────────── */}
      <div className={styles.metricsRow}>
        {overviewLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="card skeleton-card skeleton"
              style={{ minHeight: 96 }}
            />
          ))
        ) : (
          <>
            <MetricCard
              label={t("dashboard.avgUptime")}
              value={overview ? `${overview.avg_uptime_24h.toFixed(1)}%` : "—"}
              trend={overview?.uptime_trend}
            />
            <MetricCard
              label={t("dashboard.avgLatency")}
              value={
                overview ? `${Math.round(overview.avg_latency)}ms` : "—"
              }
              trend={overview?.latency_trend}
            />
            <MetricCard
              label={t("dashboard.totalEndpoints")}
              value={overview?.total_endpoints ?? "—"}
            />
          </>
        )}
      </div>

      {/* ── SECTION 3: Charts ─────────────────────── */}
      <div className={styles.chartsRow}>
        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>
              {t("dashboard.latencyTitle")}
            </span>
            {latencyData.length > 0 && (
              <span className={styles.chartStat}>
                {t("dashboard.avg")}{" "}
                <strong>
                  {Math.round(
                    latencyData.reduce((s, p) => s + p.latency, 0) /
                      latencyData.length,
                  )}
                  ms
                </strong>{" "}
                · {t("dashboard.p50")}{" "}
                <strong>{Math.round(p50Latency ?? 0)}ms</strong> ·{" "}
                {t("dashboard.p95")}{" "}
                <strong>{Math.round(p95Latency ?? 0)}ms</strong>
              </span>
            )}
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            {latencyData.length > 0 ? (
              <LatencyChart data={latencyData} threshold={250} />
            ) : (
              <div className={styles.chartEmpty}>
                <span>{t("dashboard.noLatency")}</span>
                <span className={styles.chartEmptySub}>
                  {t("dashboard.noLatencySub")}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>
              {t("dashboard.uptimeTitle")}
            </span>
            {uptimeData.length > 0 && (
              <span className={styles.chartStat}>
                {t("dashboard.avg")}{" "}
                <strong>
                  {(
                    uptimeData.reduce((s, p) => s + p.uptime, 0) /
                    uptimeData.length
                  ).toFixed(1)}
                  %
                </strong>{" "}
                · SLA <strong>99%</strong>
              </span>
            )}
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            {uptimeData.length > 0 ? (
              <UptimeChart data={uptimeData} slaTarget={99} />
            ) : (
              <div className={styles.chartEmpty}>
                <span>{t("dashboard.noUptime")}</span>
                <span className={styles.chartEmptySub}>
                  {t("dashboard.noUptimeSub")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Problem services ───────────── */}
      <h2 className={styles.sectionHeading}>{t("dashboard.priorities")}</h2>
      <div className="card">
        <div className={styles.chartHeader}>
          <span className={styles.sectionTitle}>
            {t("dashboard.problemServices")}
          </span>
          {mergedProblems.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate("/alerts")}
            >
              {t("dashboard.allIncidents")}
            </button>
          )}
        </div>
        <div className={styles.problemList}>
          {mergedProblems.length > 0 ? (
            mergedProblems.map((item) => (
              <div
                key={item.id}
                className={styles.problemItem}
                onClick={() => navigate(`/endpoints/${item.endpointId}`)}
              >
                <StatusDot status={item.status} size={7} />
                <span className={styles.problemName}>{item.name}</span>
                {item.uptime !== undefined && (
                  <span className={styles.problemUptime}>
                    {item.uptime.toFixed(1)}%
                  </span>
                )}
                {item.incidentType && (
                  <span
                    className={`badge badge-${item.incidentType === "down" ? "down" : "slow"}`}
                    style={{ fontSize: 10 }}
                  >
                    {item.incidentType.toUpperCase()}
                  </span>
                )}
                {item.duration && (
                  <span className={styles.problemDuration}>{item.duration}</span>
                )}
                {item.isOngoing && (
                  <span className={styles.problemOngoing}>
                    {t("dashboard.ongoing")}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className={styles.problemEmpty}>
              {t("dashboard.allGood")}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 5: Degradations (only unique) ─── */}
      {regressions.length > 0 && (
        <>
          <h2 className={styles.sectionHeading}>
            {t("dashboard.regressions")}
          </h2>
          <div className={`card ${styles.degradationCard}`}>
            {regressions.map((ep) => (
              <div
                key={ep.id}
                className={styles.degradationItem}
                onClick={() => navigate(`/endpoints/${ep.id}`)}
              >
                <StatusDot
                  status={ep.enabled ? ep.status : "slow"}
                  size={7}
                />
                <span className={styles.degradationName}>{ep.name}</span>
                <span className={styles.degradationMeta}>
                  {ep.avg_latency}ms · {ep.uptime_24h.toFixed(1)}%
                </span>
                <span className={styles.degradationScore}>
                  RISK {ep.score}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
