import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { endpointsApi } from "../api/endpoints";
import { useAppStore } from "../store";
import { useT } from "../i18n";
import { EndpointRow } from "../components/EndpointRow";
import { RoleGuard } from "../components/RoleGuard";
import { ErrorBanner } from "../components/ErrorBanner";
import { getErrorMessage } from "../utils/error";
import type { EndpointStatus } from "../types/api";
import styles from "./Endpoints.module.css";

type Filter = "all" | EndpointStatus;

export function Endpoints() {
  const t = useT();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const endpoints = useAppStore((s) => s.endpoints);
  const setEndpoints = useAppStore((s) => s.setEndpoints);

  const { error, refetch, isLoading } = useQuery({
    queryKey: ["endpoints"],
    queryFn: async () => {
      const data = await endpointsApi.list();
      setEndpoints(data);
      return data;
    },
  });

  const filtered = endpoints.filter((ep) => {
    if (filter !== "all" && ep.status !== filter) return false;
    if (
      search &&
      !ep.name.toLowerCase().includes(search.toLowerCase()) &&
      !ep.url.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const filters: Filter[] = ["all", "up", "down", "slow"];

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.pageTitle}>{t("endpoints.title")}</h1>
        <RoleGuard role="admin">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/endpoints/new")}
          >
            {t("endpoints.add")}
          </button>
        </RoleGuard>
      </div>

      {error && (
        <ErrorBanner
          message={getErrorMessage(error)}
          onRetry={() => refetch()}
        />
      )}

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {filters.map((f) => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all"
                ? t("endpoints.all")
                : f === "up"
                  ? t("endpoints.up")
                  : f === "down"
                    ? t("endpoints.down")
                    : t("endpoints.slow")}
              <span className={styles.filterCount}>
                {f === "all"
                  ? endpoints.length
                  : endpoints.filter((e) => e.status === f).length}
              </span>
            </button>
          ))}
        </div>
        <input
          className={`form-input ${styles.search} ${styles.searchField}`}
          placeholder={t("endpoints.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={`card ${styles.tableCard}`}>
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
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td colSpan={7} style={{ padding: "12px 16px" }}>
                      <div className="skeleton skeleton-row" />
                    </td>
                  </tr>
                ))}
              {!isLoading &&
                filtered.map((ep, i) => (
                  <EndpointRow key={ep.id} endpoint={ep} index={i} />
                ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign: "center",
                      color: "var(--text-3)",
                      padding: "32px",
                    }}
                  >
                    {t("endpoints.noMatch")}
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
