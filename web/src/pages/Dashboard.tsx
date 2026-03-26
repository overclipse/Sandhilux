import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Refresh01Icon, Add01Icon } from "@hugeicons/core-free-icons";
import { metricsApi } from "../api/metrics";
import type { DashboardPeriod } from "../api/metrics";
import { endpointsApi } from "../api/endpoints";
import { useAppStore } from "../store";
import { MetricCard } from "../components/MetricCard";
import { EndpointRow } from "../components/EndpointRow";
import { LatencyChart } from "../components/LatencyChart";
import { UptimeChart } from "../components/UptimeChart";
import { StatusDot } from "../components/StatusDot";
import { RoleGuard } from "../components/RoleGuard";
import { ErrorBanner } from "../components/ErrorBanner";
import { getErrorMessage } from "../utils/error";
import { useT } from "../i18n";
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
  styles,
}: {
  fresh: boolean;
  label: string;
  updatedAt: number | null;
  styles: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—";
  return (
    <div className={styles.freshnessWrap}>
      <button
        className={`${styles.freshnessDot} ${fresh ? styles.fresh : styles.stale}`}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        aria-label="данных"
      />
      {open && (
        <div className={styles.freshnessPopover}>
          <span className={`${styles.freshnessPopDot} ${fresh ? styles.fresh : styles.stale}`} />
          <span className={styles.freshnessPopLabel}>{label}</span>
          <span className={styles.freshnessPopTime}>{time}</span>
        </div>
      )}
    </div>
  );
}

type HealthFilter = "all" | "healthy" | "slow" | "down" | "paused";

export function Dashboard() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const endpoints = useAppStore((s) => s.endpoints);
  const setEndpoints = useAppStore((s) => s.setEndpoints);

  const [period, setPeriod] = useState<DashboardPeriod>("24h");
  const [autoRefreshSec, setAutoRefreshSec] = useState<0 | 5 | 10>(0);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
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

  const toggleMutation = useMutation({
    mutationFn: (id: string) => endpointsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["endpoints"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => endpointsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["endpoints"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const handleToggle = (id: string) => toggleMutation.mutate(id);
  const handleDelete = (id: string) => {
    const ep = endpoints.find((e) => e.id === id);
    if (!confirm(t("common.confirmDelete", { name: ep?.name ?? "endpoint" }))) {
      return;
    }
    deleteMutation.mutate(id);
  };

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
    const timer = window.setInterval(() => {
      refreshAll();
    }, autoRefreshSec * 1000);
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

  const healthyCount = endpoints.filter(
    (e) => e.enabled && e.status === "up",
  ).length;
  const slowCount = endpoints.filter(
    (e) => e.enabled && e.status === "slow",
  ).length;
  const downCount = endpoints.filter(
    (e) => e.enabled && e.status === "down",
  ).length;
  const pausedCount = endpoints.filter((e) => !e.enabled).length;

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

  const periodMs =
    period === "24h"
      ? 24 * 60 * 60 * 1000
      : period === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
  const sinceTs = Date.now() - periodMs;
  const prevSinceTs = sinceTs - periodMs;

  const newIncidentsCount = incidentsData.filter(
    (inc) => new Date(inc.created_at).getTime() >= sinceTs,
  ).length;
  const prevNewIncidentsCount = incidentsData.filter((inc) => {
    const ts = new Date(inc.created_at).getTime();
    return ts >= prevSinceTs && ts < sinceTs;
  }).length;

  const resolvedIncidentsCount = incidentsData.filter(
    (inc) => inc.resolved_at && new Date(inc.resolved_at).getTime() >= sinceTs,
  ).length;
  const prevResolvedIncidentsCount = incidentsData.filter((inc) => {
    if (!inc.resolved_at) return false;
    const ts = new Date(inc.resolved_at).getTime();
    return ts >= prevSinceTs && ts < sinceTs;
  }).length;

  const worstEndpoint =
    worstData.length > 0
      ? [...worstData].sort((a, b) => a.uptime - b.uptime)[0]
      : null;
  const prevWorstUptime =
    worstData.length > 1
      ? [...worstData].sort((a, b) => b.uptime - a.uptime)[0]?.uptime
      : undefined;

  const filteredEndpoints = endpoints.filter((ep) => {
    if (healthFilter === "all") return true;
    if (healthFilter === "paused") return !ep.enabled;
    if (healthFilter === "healthy") return ep.enabled && ep.status === "up";
    return ep.enabled && ep.status === healthFilter;
  });
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
    .filter((ep) => ep.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const latencySparkline =
    latencyData.length > 1 ? latencyData.map((p) => p.latency) : undefined;
  const uptimeSparkline =
    uptimeData.length > 1 ? uptimeData.map((p) => p.uptime) : undefined;
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

  const uptimeColor = (v?: number) => {
    if (!v) return "default" as const;
    return v < 95
      ? ("red" as const)
      : v >= 99
        ? ("green" as const)
        : ("default" as const);
  };

  const latencyColor = (v?: number) => {
    if (!v) return "default" as const;
    return v > 1000
      ? ("red" as const)
      : v > 500
        ? ("yellow" as const)
        : ("default" as const);
  };

  return (
    <div className={styles.page}>
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
            {isFetching ? <span className="spinner" /> : <HugeiconsIcon icon={Refresh01Icon} size={14} strokeWidth={2} />}
            {" "}{t("dashboard.refresh")}
          </button>
          <RoleGuard role="admin">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate("/endpoints/new")}
            >
              <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
              {" "}{t("dashboard.addEndpoint")}
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

      <div className={styles.healthStrip}>
        {[
          {
            key: "healthy",
            label: t("dashboard.healthy"),
            value: healthyCount,
          },
          { key: "slow", label: t("dashboard.slow"), value: slowCount },
          { key: "down", label: t("dashboard.down"), value: downCount },
          { key: "paused", label: t("dashboard.paused"), value: pausedCount },
        ].map((it) => (
          <button
            key={it.key}
            className={`${styles.healthChip} ${healthFilter === it.key ? styles.healthChipActive : ""}`}
            onClick={() =>
              setHealthFilter((prev) =>
                prev === it.key ? "all" : (it.key as HealthFilter),
              )
            }
          >
            <span>{it.label}</span>
            <strong>{it.value}</strong>
          </button>
        ))}
      </div>

      <div className={styles.cards}>
        {overviewLoading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="card skeleton-card skeleton"
              style={{ minHeight: 100 }}
            />
          ))
        ) : (
          <>
            <MetricCard
              label={t("dashboard.totalEndpoints")}
              value={overview?.total_endpoints ?? "—"}
              color={downCount > 0 ? "red" : "default"}
            />
            <MetricCard
              label={t("dashboard.avgUptime")}
              value={overview ? `${overview.avg_uptime_24h.toFixed(1)}%` : "—"}
              trend={overview?.uptime_trend}
              color={uptimeColor(overview?.avg_uptime_24h)}
              sparkline={uptimeSparkline}
            />
            <MetricCard
              label={t("dashboard.avgLatency")}
              value={overview ? `${Math.round(overview.avg_latency)}ms` : "—"}
              trend={overview?.latency_trend}
              color={latencyColor(overview?.avg_latency)}
              sparkline={latencySparkline}
            />
            <MetricCard
              label={t("dashboard.activeAlerts")}
              value={overview?.active_alerts ?? "—"}
              color={overview && overview.active_alerts > 0 ? "red" : "default"}
            />
            <MetricCard
              label={t("dashboard.newIncidents")}
              value={newIncidentsCount}
              trend={newIncidentsCount - prevNewIncidentsCount}
              color={newIncidentsCount > 0 ? "yellow" : "default"}
            />
            <MetricCard
              label={t("dashboard.resolvedIncidents")}
              value={resolvedIncidentsCount}
              trend={resolvedIncidentsCount - prevResolvedIncidentsCount}
              color={resolvedIncidentsCount > 0 ? "green" : "default"}
            />
            <MetricCard
              label={t("dashboard.worstEndpoint")}
              value={
                worstEndpoint
                  ? `${worstEndpoint.name} (${worstEndpoint.uptime.toFixed(1)}%)`
                  : "—"
              }
              trend={
                worstEndpoint && prevWorstUptime !== undefined
                  ? Math.round(worstEndpoint.uptime - prevWorstUptime)
                  : undefined
              }
              color={
                worstEndpoint && worstEndpoint.uptime < 95 ? "red" : "default"
              }
            />
          </>
        )}
      </div>

      <h2 className={styles.blockTitle}>{t("dashboard.trends")}</h2>
      <div className={styles.charts}>
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
              <LatencyChart data={latencyData} />
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
              <UptimeChart data={uptimeData} />
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

      <h2 className={styles.blockTitle}>{t("dashboard.priorities")}</h2>
      <div className={styles.charts}>
        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>{t("dashboard.worst")}</span>
          </div>
          <div className={styles.worstList}>
            {worstData.length > 0
              ? worstData
                  .filter((w) => w.uptime < 100)
                  .slice(0, 5)
                  .map((w) => (
                    <div
                      key={w.id}
                      className={styles.worstItem}
                      onClick={() => navigate(`/endpoints/${w.id}`)}
                    >
                      <StatusDot status={w.status} size={7} />
                      <span className={styles.worstName}>{w.name}</span>
                      <span
                        className={styles.worstUptime}
                        style={{
                          color:
                            w.uptime < 95
                              ? "var(--red)"
                              : w.uptime < 99
                                ? "var(--yellow)"
                                : "var(--text-2)",
                        }}
                      >
                        {w.uptime.toFixed(1)}%
                      </span>
                    </div>
                  ))
              : null}
            {worstData.length === 0 ||
            worstData.every((w) => w.uptime >= 100) ? (
              <div className={styles.worstEmpty}>{t("dashboard.allGood")}</div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className={styles.chartHeader}>
            <span className={styles.sectionTitle}>
              {t("dashboard.incidents")}
            </span>
            {incidentsData.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate("/alerts")}
              >
                {t("dashboard.allIncidents")}
              </button>
            )}
          </div>
          <div className={styles.incidentList}>
            {incidentsData.length > 0 ? (
              incidentsData
                .slice()
                .sort((a, b) => {
                  if (a.status === "active" && b.status !== "active") return -1;
                  if (a.status !== "active" && b.status === "active") return 1;
                  if (a.type === "down" && b.type !== "down") return -1;
                  if (a.type !== "down" && b.type === "down") return 1;
                  return (
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                  );
                })
                .slice(0, 5)
                .map((inc) => (
                  <div key={inc.id} className={styles.incidentItem}>
                    <StatusDot
                      status={
                        inc.type === "down"
                          ? "down"
                          : inc.type === "slow"
                            ? "slow"
                            : "down"
                      }
                      size={7}
                    />
                    <span className={styles.incidentName}>
                      {inc.endpoint_name}
                    </span>
                    <span
                      className={`badge badge-${inc.type === "down" ? "down" : "slow"}`}
                      style={{ fontSize: 10 }}
                    >
                      {inc.type.toUpperCase()}
                    </span>
                    <span className={styles.incidentDuration}>
                      {formatDuration(
                        inc.created_at,
                        inc.resolved_at ?? undefined,
                      )}
                    </span>
                    <span className={styles.incidentTime}>
                      {inc.status === "active"
                        ? t("dashboard.ongoing")
                        : new Date(inc.created_at).toLocaleDateString()}
                    </span>
                    <div className={styles.incidentActions}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          navigate(`/endpoints/${inc.endpoint_id}`)
                        }
                      >
                        {t("dashboard.openEndpoint")}
                      </button>
                    </div>
                  </div>
                ))
            ) : (
              <div className={styles.worstEmpty}>
                {t("dashboard.noIncidents")}
              </div>
            )}
          </div>
        </div>
      </div>

      <h2 className={styles.blockTitle}>{t("dashboard.regressions")}</h2>
      <div className={`card ${styles.regressionCard}`}>
        {regressions.length === 0 ? (
          <div className={styles.worstEmpty}>
            {t("dashboard.noRegressions")}
          </div>
        ) : (
          regressions.map((ep) => (
            <div
              key={ep.id}
              className={styles.regressionItem}
              onClick={() => navigate(`/endpoints/${ep.id}`)}
            >
              <StatusDot status={ep.enabled ? ep.status : "slow"} size={7} />
              <span className={styles.regressionName}>{ep.name}</span>
              <span className={styles.regressionMeta}>
                {ep.avg_latency}ms · {ep.uptime_24h.toFixed(1)}%
              </span>
              <span className={styles.regressionScore}>RISK {ep.score}</span>
            </div>
          ))
        )}
      </div>

      <h2 className={styles.blockTitle}>{t("dashboard.actions")}</h2>
      <div className={`card ${styles.actionsPanel}`}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={refreshAll}
          disabled={isFetching}
        >
          {isFetching ? <span className="spinner" /> : "↻"}{" "}
          {t("dashboard.refresh")}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/alerts")}
        >
          {t("dashboard.allIncidents")}
        </button>
        <RoleGuard role="admin">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/endpoints/new")}
          >
            {t("dashboard.addEndpoint")}
          </button>
        </RoleGuard>
      </div>

      <h2 className={styles.blockTitle}>{t("dashboard.table")}</h2>
      <div className={`card ${styles.tableCard}`}>
        <div className={styles.tableHeader}>
          <span className={styles.sectionTitle}>
            {t("dashboard.endpoints")}
          </span>
          <span className={styles.tableCount}>
            {filteredEndpoints.length} {t("dashboard.total")}
          </span>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th />
                <th>{t("table.nameUrl")}</th>
                <th>{t("table.uptime")}</th>
                <th>{t("table.latency")}</th>
                <th>{t("table.lastCheck")}</th>
                <th>{t("table.interval")}</th>
                <th>{t("table.status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredEndpoints.map((ep, i) => (
                <EndpointRow
                  key={ep.id}
                  endpoint={ep}
                  index={i}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))}
              {filteredEndpoints.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles.emptyRow}>
                    <div className={styles.emptyState}>
                      <span className={styles.emptyIcon}>📡</span>
                      <span>{t("dashboard.noEndpoints")}</span>
                      <RoleGuard role="admin">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate("/endpoints/new")}
                        >
                          {t("dashboard.addFirst")}
                        </button>
                      </RoleGuard>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
