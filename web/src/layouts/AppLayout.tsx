import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, Navigate, useNavigate } from "react-router-dom";
import { useAppStore } from "../store";
import { useSSE } from "../hooks/useSSE";
import { useAuth } from "../hooks/useAuth";
import { useT } from "../i18n";
import logoSrc from "../assets/logo.svg";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  const t = useT();
  const activeAlertsCount = useAppStore((s) => s.activeAlertsCount);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const setCollapsed = useAppStore((s) => s.setSidebarCollapsed);
  const { user, isAuthenticated, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useSSE();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  function navClass({ isActive }: { isActive: boolean }) {
    return `${styles.navItem} ${isActive ? styles.navActive : ""}`;
  }

  useEffect(() => {
    if (!langOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!langRef.current?.contains(event.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [langOpen]);

  return (
    <div className={styles.layout}>
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}
      >
        <div className={styles.logo} onClick={() => navigate("/")}>
          <img src={logoSrc} className={styles.logoIcon} alt="Sandhilux" />
          <span className={styles.logoText}>Sandhilux</span>
        </div>

        <nav className={styles.nav}>
          <NavLink
            to="/"
            end
            className={navClass}
            data-tooltip={t("nav.dashboard")}
          >
            <svg
              className={styles.navSvg}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span className={styles.navLabel}>{t("nav.dashboard")}</span>
          </NavLink>
          <NavLink
            to="/endpoints"
            className={navClass}
            data-tooltip={t("nav.endpoints")}
          >
            <svg
              className={styles.navSvg}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            <span className={styles.navLabel}>{t("nav.endpoints")}</span>
          </NavLink>
          <NavLink
            to="/alerts"
            className={navClass}
            data-tooltip={t("nav.alerts")}
          >
            <svg
              className={styles.navSvg}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className={styles.navLabel}>{t("nav.alerts")}</span>
            {activeAlertsCount > 0 && (
              <span className={styles.badge}>{activeAlertsCount}</span>
            )}
          </NavLink>
          {isAdmin && (
            <NavLink
              to="/settings"
              className={navClass}
              data-tooltip={t("nav.settings")}
            >
              <svg
                className={styles.navSvg}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className={styles.navLabel}>{t("nav.settings")}</span>
            </NavLink>
          )}
        </nav>

        {/* Controls: theme, locale, collapse */}
        <div className={styles.controls}>
          <button
            className={styles.controlBtn}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <div className={styles.langWrap} ref={langRef}>
            <button
              className={`${styles.controlBtn} ${styles.langBtn}`}
              onClick={() => setLangOpen((v) => !v)}
              title="Language"
            >
              <span className={styles.langCode}>LG</span>
            </button>
            {langOpen && (
              <div className={styles.langMenu}>
                <button
                  className={`${styles.langMenuItem} ${locale === "en" ? styles.langMenuItemActive : ""}`}
                  onClick={() => {
                    setLocale("en");
                    setLangOpen(false);
                  }}
                >
                  EN English
                </button>
                <button
                  className={`${styles.langMenuItem} ${locale === "ru" ? styles.langMenuItemActive : ""}`}
                  onClick={() => {
                    setLocale("ru");
                    setLangOpen(false);
                  }}
                >
                  RU Русский
                </button>
                <div className={styles.langMenuHint}>More languages soon</div>
              </div>
            )}
          </div>
          <button
            className={`${styles.controlBtn} ${styles.collapseBtn}`}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={collapsed ? { transform: "rotate(180deg)" } : undefined}
            >
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
        </div>

        <div className={styles.userSection}>
          <div className={styles.userInfo}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} className={styles.avatar} alt="" />
            ) : (
              <div className={styles.avatarFallback}>
                {(user?.name || user?.email || "?")[0].toUpperCase()}
              </div>
            )}
            <div className={styles.userMeta}>
              <span className={styles.userName}>{user?.name || "User"}</span>
              <span className={styles.userEmail}>{user?.email}</span>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={logout}
            title={t("nav.signOut")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
