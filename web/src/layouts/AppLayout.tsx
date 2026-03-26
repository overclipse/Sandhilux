import { useEffect, useRef, useState } from "react";
import { Outlet, NavLink, Navigate, useNavigate } from "react-router-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardBrowsingIcon,
  Globe02Icon,
  Alert01Icon,
  Settings01Icon,
  Sun01Icon,
  Moon01Icon,
  SidebarLeftIcon,
  Logout01Icon,
} from "@hugeicons/core-free-icons";
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
          <NavLink to="/" end className={navClass} data-tooltip={t("nav.dashboard")}>
            <HugeiconsIcon icon={DashboardBrowsingIcon} className={styles.navSvg} size={20} strokeWidth={1.8} />
            <span className={styles.navLabel}>{t("nav.dashboard")}</span>
          </NavLink>
          <NavLink to="/endpoints" className={navClass} data-tooltip={t("nav.endpoints")}>
            <HugeiconsIcon icon={Globe02Icon} className={styles.navSvg} size={20} strokeWidth={1.8} />
            <span className={styles.navLabel}>{t("nav.endpoints")}</span>
          </NavLink>
          <NavLink to="/alerts" className={navClass} data-tooltip={t("nav.alerts")}>
            <HugeiconsIcon icon={Alert01Icon} className={styles.navSvg} size={20} strokeWidth={1.8} />
            <span className={styles.navLabel}>{t("nav.alerts")}</span>
            {activeAlertsCount > 0 && (
              <span className={styles.badge}>{activeAlertsCount}</span>
            )}
          </NavLink>
          {isAdmin && (
            <NavLink to="/settings" className={navClass} data-tooltip={t("nav.settings")}>
              <HugeiconsIcon icon={Settings01Icon} className={styles.navSvg} size={20} strokeWidth={1.8} />
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
            <HugeiconsIcon
              icon={theme === "dark" ? Sun01Icon : Moon01Icon}
              size={18}
              strokeWidth={1.8}
            />
          </button>
          <div className={styles.langWrap} ref={langRef}>
            <button
              className={`${styles.controlBtn} ${styles.langBtn}`}
              onClick={() => setLangOpen((v) => !v)}
              title="Language"
              aria-label="Language"
              aria-haspopup="menu"
              aria-expanded={langOpen}
            >
              <span className={styles.langCode}>LG</span>
            </button>
            {langOpen && (
              <div
                className={styles.langMenu}
                role="menu"
                aria-label="Language menu"
              >
                <button
                  className={`${styles.langMenuItem} ${locale === "en" ? styles.langMenuItemActive : ""}`}
                  onClick={() => {
                    setLocale("en");
                    setLangOpen(false);
                  }}
                  role="menuitemradio"
                  aria-checked={locale === "en"}
                >
                  EN English
                </button>
                <button
                  className={`${styles.langMenuItem} ${locale === "ru" ? styles.langMenuItemActive : ""}`}
                  onClick={() => {
                    setLocale("ru");
                    setLangOpen(false);
                  }}
                  role="menuitemradio"
                  aria-checked={locale === "ru"}
                >
                  RU Русский
                </button>
                <div className={styles.langMenuHint}>Default: EN</div>
              </div>
            )}
          </div>
          <button
            className={`${styles.controlBtn} ${styles.collapseBtn}`}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand" : "Collapse"}
          >
            <HugeiconsIcon
              icon={SidebarLeftIcon}
              size={18}
              strokeWidth={1.8}
              style={collapsed ? { transform: "rotate(180deg)" } : undefined}
            />
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
            <HugeiconsIcon icon={Logout01Icon} size={16} strokeWidth={1.8} />
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
