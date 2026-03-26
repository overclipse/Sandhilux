import { useQuery, useMutation } from '@tanstack/react-query'
import { settingsApi } from '../api/settings'
import { useAppStore } from '../store'
import { useT } from '../i18n'
import type { UserRole } from '../types/api'
import { ErrorBanner } from '../components/ErrorBanner'
import { getErrorMessage } from '../utils/error'
import styles from './Settings.module.css'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

export function Settings() {
  const t = useT()
  const user = useAppStore((s) => s.user)

  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: () => settingsApi.getVersion(),
    refetchInterval: 30_000,
  })

  const { data: users = [], refetch: refetchUsers, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: () => settingsApi.getUsers(),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      settingsApi.updateUserRole(userId, role),
    onSuccess: () => refetchUsers(),
  })

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) => settingsApi.removeUser(userId),
    onSuccess: () => refetchUsers(),
  })

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{t('settings.title')}</h1>

      {usersError && (
        <ErrorBanner
          message={getErrorMessage(usersError)}
          onRetry={() => refetchUsers()}
        />
      )}

      {/* Profile */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{t('settings.profile')}</h2>
        <div className={styles.sectionBody}>
          <div className={styles.profileRow}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} className={styles.profileAvatar} alt="" />
            ) : (
              <div className={styles.profileAvatarFallback}>
                {(user?.name || user?.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{user?.name || 'User'}</span>
              <span className={styles.profileEmail}>{user?.email}</span>
              <span className={styles.profileRole}>{user?.role}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Team members */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>{t('settings.team')}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('settings.user')}</th>
                <th>{t('settings.role')}</th>
                <th>{t('settings.joined')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      {u.avatar_url ? (
                        <img src={u.avatar_url} className={styles.avatar} alt="" />
                      ) : (
                        <span className={styles.avatarFallback}>{(u.name || u.email)[0].toUpperCase()}</span>
                      )}
                      <div className={styles.userCellMeta}>
                        {u.name && <span className={styles.userCellName}>{u.name}</span>}
                        <span>{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      className="form-input"
                      style={{ width: 110 }}
                      value={u.role}
                      onChange={(e) => updateRoleMutation.mutate({ userId: u.id, role: e.target.value as UserRole })}
                      disabled={u.id === user?.id}
                    >
                      <option value="admin">{t('settings.admin')}</option>
                      <option value="viewer">{t('settings.viewer')}</option>
                    </select>
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td>
                    {u.id !== user?.id && (
                      <button className="btn btn-danger btn-sm" onClick={() => removeUserMutation.mutate(u.id)}>
                        {t('settings.remove')}
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
        <h2 className={styles.sectionTitle}>{t('settings.system')}</h2>
        <div className={styles.sectionBody}>
          <div className={styles.sysCards}>
            <div className={styles.sysCard}>
              <span className={styles.sysCardIcon}>⬡</span>
              <span className={styles.sysCardLabel}>{t('settings.version')}</span>
              <span className={styles.sysCardValue}>
                <span className={styles.versionBadge}>v{version?.version ?? '…'}</span>
                {version?.commit && <span className={styles.versionCommit}>{version.commit}</span>}
              </span>
            </div>
            <div className={styles.sysCard}>
              <span className={styles.sysCardIcon}>⏱</span>
              <span className={styles.sysCardLabel}>{t('settings.uptime')}</span>
              <span className={styles.sysCardValue}>{version?.uptime ?? '…'}</span>
            </div>
            <div className={styles.sysCard}>
              <span className={styles.sysCardIcon}>⚙</span>
              <span className={styles.sysCardLabel}>{t('settings.runtime')}</span>
              <span className={styles.sysCardValue}>
                <span className={styles.runtimeBadge}>{version?.go_version ?? '…'}</span>
              </span>
            </div>
            <div className={styles.sysCard}>
              <span className={styles.sysCardIcon}>📦</span>
              <span className={styles.sysCardLabel}>{t('settings.buildTime')}</span>
              <span className={styles.sysCardValue}>{version ? fmtDate(version.build_time) : '…'}</span>
            </div>
          </div>
          <div className={styles.versionHint}>
            {t('settings.updateHint')}
            <code className={styles.updateCmd}>bash scripts/deploy.sh</code>
          </div>
        </div>
      </section>

    </div>
  )
}
