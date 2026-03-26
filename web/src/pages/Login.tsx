import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store";
import { authStatus, login, setup, register, decodeToken } from "../api/auth";
import { useT } from "../i18n";
import logoSrc from "../assets/logo.svg";
import styles from "./Login.module.css";

type Mode = "login" | "setup" | "register";

export function Login() {
  const t = useT();
  const navigate = useNavigate();
  const setAuth = useAppStore((s) => s.setAuth);

  const [mode, setMode] = useState<Mode | null>(null); // null = probing
  const [connectFailed, setConnectFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In mock/dev mode skip server probe entirely
    if (import.meta.env.VITE_USE_MOCK === 'true') {
      setMode("login");
      return;
    }

    let cancelled = false;
    setMode(null);
    setConnectFailed(false);

    const MAX_ATTEMPTS = 20;
    const DELAY_MS = 2000;

    const run = async () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        if (cancelled) return;
        try {
          const { setup_required } = await authStatus();
          if (!cancelled) setMode(setup_required ? "setup" : "login");
          return;
        } catch {
          if (i < MAX_ATTEMPTS - 1 && !cancelled) {
            await new Promise((r) => setTimeout(r, DELAY_MS));
          }
        }
      }
      if (!cancelled) setConnectFailed(true);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      let token: string;
      let refreshToken: string | undefined;
      if (mode === "setup") {
        const auth = await setup(username, password, name || undefined);
        token = auth.access_token || auth.token;
        refreshToken = auth.refresh_token;
      } else if (mode === "register") {
        const auth = await register(username, password, name || undefined);
        token = auth.access_token || auth.token;
        refreshToken = auth.refresh_token;
      } else {
        const auth = await login(username, password);
        token = auth.access_token || auth.token;
        refreshToken = auth.refresh_token;
      }
      const user = decodeToken(token);
      if (!user) throw new Error("invalid token");
      setAuth(token, user, refreshToken);
      navigate("/", { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      setError(msg || t("login.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  // ── Connecting / error state ──────────────────────────────
  if (mode === null) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <img src={logoSrc} className={styles.logoIcon} alt="Sandhilux" />
          <h1 className={styles.title}>Sandhilux</h1>
        </div>
        {connectFailed ? (
          <div className={styles.connectFailed}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{t("login.connectFailed")}</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setRetryKey((k) => k + 1)}
            >
              {t("login.retry")}
            </button>
          </div>
        ) : (
          <div className={styles.connecting}>
            <span className="spinner" />
            <span>{t("login.connecting")}</span>
          </div>
        )}
      </div>
    );
  }

  const isSetup = mode === "setup";
  const isRegister = mode === "register";

  // ── Login / Setup / Register form ─────────────────────────
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <img src={logoSrc} className={styles.logoIcon} alt="Sandhilux" />
        <h1 className={styles.title}>Sandhilux</h1>
        <p className={styles.subtitle}>
          {isSetup
            ? t("login.setupDesc")
            : isRegister
              ? t("login.registerDesc")
              : t("login.subtitle")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {(isSetup || isRegister) && (
          <div className="form-group">
            <label className="form-label">{t("login.name")}</label>
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("login.namePlaceholder")}
              autoComplete="name"
            />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">{t("login.username")}</label>
          <input
            className="form-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={isSetup || isRegister ? "admin" : "admin"}
            required
            autoComplete="username"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t("login.password")}</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              isSetup || isRegister ? t("login.passwordMinHint") : "••••••••"
            }
            required
            autoComplete={
              isSetup || isRegister ? "new-password" : "current-password"
            }
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ marginTop: 4 }}
        >
          {loading ? (
            <span className="spinner" />
          ) : isSetup ? (
            t("login.createAdmin")
          ) : isRegister ? (
            t("login.registerSubmit")
          ) : (
            t("login.signIn")
          )}
        </button>

        {/* Toggle register / login — only when setup is already done */}
        {!isSetup && (
          <p className={styles.switchMode}>
            {isRegister ? t("login.haveAccount") : t("login.noAccount")}{" "}
            <button
              type="button"
              className={styles.switchLink}
              onClick={() => {
                setMode(isRegister ? "login" : "register");
                setError("");
              }}
            >
              {isRegister ? t("login.signIn") : t("login.register")}
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
