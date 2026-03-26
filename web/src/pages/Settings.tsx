import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { settingsApi } from "../api/settings";
import { useAppStore } from "../store";
import { useT } from "../i18n";
import type { UserRole } from "../types/api";
import { ErrorBanner } from "../components/ErrorBanner";
import { getErrorMessage } from "../utils/error";
import styles from "./Settings.module.css";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function Settings() {
  const t = useT();
  const user = useAppStore((s) => s.user);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);

  const { data: version } = useQuery({
    queryKey: ["version"],
    queryFn: () => settingsApi.getVersion(),
    refetchInterval: 30_000,
  });

  const {
    data: users = [],
    refetch: refetchUsers,
    error: usersError,
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => settingsApi.getUsers(),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      settingsApi.updateUserRole(userId, role),
    onSuccess: () => refetchUsers(),
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => settingsApi.removeUser(userId),
    onSuccess: () => refetchUsers(),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () => settingsApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      setPasswordSaved(true);
    },
    onError: (err) => {
      setPasswordSaved(false);
      setPasswordError(getErrorMessage(err));
    },
  });

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSaved(false);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(t("settings.passwordFillAll"));
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError(t("settings.passwordMin"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.passwordMismatch"));
      return;
    }
    setPasswordError("");
    changePasswordMutation.mutate();
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t("settings.title")}</h1>

      {usersError && (
        <ErrorBanner
          message={getErrorMessage(usersError)}
          onRetry={() => refetchUsers()}
        />
      )}

      {/* Profile */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{t("settings.profile")}</h2>
        <div className={styles.sectionBody}>
          <div className={styles.profileRow}>
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                className={styles.profileAvatar}
                alt=""
              />
            ) : (
              <div className={styles.profileAvatarFallback}>
                {(user?.name || user?.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{user?.name || "User"}</span>
              <span className={styles.profileEmail}>{user?.email}</span>
              <span className={styles.profileRole}>{user?.role}</span>
            </div>
          </div>
        </div>
      </section>

      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{t("settings.passwordTitle")}</h2>
        <form className={styles.passwordForm} onSubmit={handlePasswordSubmit}>
          <div className={styles.passwordGrid}>
            <div className="form-group">
              <label className="form-label">
                {t("settings.currentPassword")}
              </label>
              <input
                className="form-input"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t("settings.newPassword")}</label>
              <input
                className="form-input"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                {t("settings.confirmPassword")}
              </label>
              <input
                className="form-input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.passwordFooter}>
            <span className={styles.passwordHint}>
              {t("settings.passwordHint")}
            </span>
            <button
              className="btn btn-primary btn-sm"
              type="submit"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? (
                <span className="spinner" />
              ) : (
                t("settings.passwordSave")
              )}
            </button>
          </div>
          {passwordError && <div className="form-error">{passwordError}</div>}
          {passwordSaved && (
            <div className={styles.savedMessage}>
              {t("settings.passwordSaved")}
            </div>
          )}
        </form>
      </section>

      {/* Team members */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{t("settings.team")}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("settings.user")}</th>
                <th>{t("settings.role")}</th>
                <th>{t("settings.joined")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          className={styles.avatar}
                          alt=""
                        />
                      ) : (
                        <span className={styles.avatarFallback}>
                          {(u.name || u.email)[0].toUpperCase()}
                        </span>
                      )}
                      <div className={styles.userCellMeta}>
                        {u.name && (
                          <span className={styles.userCellName}>{u.name}</span>
                        )}
                        <span>{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ width: 110 }}
                      value={u.role}
                      onChange={(e) =>
                        updateRoleMutation.mutate({
                          userId: u.id,
                          role: e.target.value as UserRole,
                        })
                      }
                      disabled={
                        u.id === user?.id || updateRoleMutation.isPending
                      }
                    >
                      <option value="admin">{t("settings.admin")}</option>
                      <option value="viewer">{t("settings.viewer")}</option>
                    </select>
                  </td>
                  <td style={{ color: "var(--text-3)", fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td>
                    {u.id !== user?.id && (
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={removeUserMutation.isPending}
                        onClick={() => {
                          if (!confirm(t("settings.confirmRemoveUser"))) return;
                          removeUserMutation.mutate(u.id);
                        }}
                      >
                        {removeUserMutation.isPending ? (
                          <span className="spinner" />
                        ) : (
                          t("settings.remove")
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {/* System */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{t("settings.system")}</h2>
        <div className={styles.sectionBody}>
          <div className={styles.sysCards}>
            <div className={styles.sysCard}>
              <span className={styles.sysCardIcon}>⬡</span>
              <span className={styles.sysCardLabel}>
                {t("settings.version")}
              </span>
              <span className={styles.sysCardValue}>
                <span className={styles.versionBadge}>
                  v{version?.version ?? "…"}
                </span>
                {version?.commit && (
                  <span className={styles.versionCommit}>{version.commit}</span>
                )}
              </span>
            </div>
            <div className={styles.sysCard}>
              <span className={styles.sysCardIcon}>⏱</span>
              <span className={styles.sysCardLabel}>
                {t("settings.uptime")}
              </span>
              <span className={styles.sysCardValue}>
                {version?.uptime ?? "…"}
              </span>
            </div>
            <div className={styles.sysCard}>
              <span className={styles.sysCardIcon}>⚙</span>
              <span className={styles.sysCardLabel}>
                {t("settings.runtime")}
              </span>
              <span className={styles.sysCardValue}>
                <span className={styles.runtimeBadge}>
                  {version?.go_version ?? "…"}
                </span>
              </span>
            </div>
            <div className={styles.sysCard}>
              <span className={styles.sysCardIcon}>📦</span>
              <span className={styles.sysCardLabel}>
                {t("settings.buildTime")}
              </span>
              <span className={styles.sysCardValue}>
                {version ? fmtDate(version.build_time) : "…"}
              </span>
            </div>
          </div>
          <div className={styles.versionHint}>
            {t("settings.updateHint")}
            <code className={styles.updateCmd}>bash scripts/deploy.sh</code>
          </div>
        </div>
      </section>
    </div>
  );
}
