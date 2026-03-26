import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { settingsApi } from '../api/settings'
import { useAppStore } from '../store'
import { useT } from '../i18n'
import type { UserRole } from '../types/api'
import { ErrorBanner } from '../components/ErrorBanner'
import { getErrorMessage } from '../utils/error'
import styles from './Settings.module.css'

export function Settings() {
  const t = useT()
  const user = useAppStore((s) => s.user)

  // Telegram form
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [telegramMsg, setTelegramMsg] = useState('')

  const { data: users = [], refetch: refetchUsers, error: usersError } = useQuery({
    queryKey: ['users'],
    queryFn: () => settingsApi.getUsers(),
  })

  const { data: telegram, refetch: refetchTelegram, error: telegramError } = useQuery({
    queryKey: ['telegram'],
    queryFn: () => settingsApi.getTelegram(),
  })

  // Pre-fill Telegram form when data loads
  useEffect(() => {
    if (telegram?.configured) {
      setBotToken(telegram.bot_token)
      setChatId(telegram.chat_id)
    }
  }, [telegram])

  const saveTelegramMutation = useMutation({
    mutationFn: () => settingsApi.saveTelegram(botToken, chatId),
    onSuccess: () => { setTelegramMsg(t('settings.saved')); refetchTelegram() },
  })

  const testTelegramMutation = useMutation({
    mutationFn: () => settingsApi.testTelegram(),
    onSuccess: () => setTelegramMsg(t('settings.testSent')),
    onError: () => setTelegramMsg(t('settings.testFailed')),
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

      {(usersError || telegramError) && (
        <ErrorBanner
          message={getErrorMessage(usersError || telegramError)}
          onRetry={() => { refetchUsers(); refetchTelegram() }}
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

      {/* Telegram */}
      <section className={`card ${styles.section}`}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>{t('settings.telegram')}</h2>
          <span className={`${styles.telegramStatus} ${telegram?.configured ? styles.connected : styles.notConfigured}`}>
            {telegram?.configured ? '● ' + t('settings.connected') : '○ ' + t('settings.notConfigured')}
          </span>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.telegramGrid}>
            <div className="form-group">
              <label className="form-label">{t('settings.botToken')}</label>
              <input className="form-input" type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="123456:ABC-DEF…" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('settings.chatId')}</label>
              <input className="form-input" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234567890" />
            </div>
          </div>
          {telegramMsg && <p style={{ fontSize: 13, color: 'var(--green)' }}>{telegramMsg}</p>}
          <div className={styles.telegramActions}>
            <button className="btn btn-primary btn-sm" onClick={() => saveTelegramMutation.mutate()} disabled={saveTelegramMutation.isPending}>
              {saveTelegramMutation.isPending ? <span className="spinner" /> : t('settings.save')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => testTelegramMutation.mutate()} disabled={testTelegramMutation.isPending || !telegram?.configured}>
              {t('settings.sendTest')}
            </button>
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
    </div>
  )
}
