import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { settingsApi } from '../api/settings'
import { useAppStore } from '../store'
import type { UserRole } from '../types/api'
import styles from './Settings.module.css'

export function Settings() {
  const user = useAppStore((s) => s.user)

  // Password form
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  // Telegram form
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [telegramMsg, setTelegramMsg] = useState('')

  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['users'],
    queryFn: () => settingsApi.getUsers(),
  })

  const { data: telegram, refetch: refetchTelegram } = useQuery({
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

  const changePwMutation = useMutation({
    mutationFn: () => settingsApi.changePassword(currentPw, newPw),
    onSuccess: () => {
      setPwSuccess(true)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    },
    onError: () => setPwError('Incorrect current password'),
  })

  const saveTelegramMutation = useMutation({
    mutationFn: () => settingsApi.saveTelegram(botToken, chatId),
    onSuccess: () => { setTelegramMsg('Saved'); refetchTelegram() },
  })

  const testTelegramMutation = useMutation({
    mutationFn: () => settingsApi.testTelegram(),
    onSuccess: () => setTelegramMsg('Test message sent!'),
    onError: () => setTelegramMsg('Failed to send test message'),
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

  function handleChangePw(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return }
    changePwMutation.mutate()
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>

      {/* Profile */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Profile</h2>
        <div className={styles.sectionBody}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" value={user?.email ?? ''} readOnly style={{ opacity: 0.6 }} />
          </div>

          <form onSubmit={handleChangePw} className={styles.pwForm}>
            <h3 className={styles.subTitle}>Change password</h3>
            <div className={styles.pwGrid}>
              <div className="form-group">
                <label className="form-label">Current password</label>
                <input className="form-input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input className="form-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm new password</label>
                <input className="form-input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
              </div>
            </div>
            {pwError && <p className="form-error">{pwError}</p>}
            {pwSuccess && <p style={{ color: 'var(--green)', fontSize: 13 }}>Password changed successfully</p>}
            <button type="submit" className="btn btn-primary btn-sm" disabled={changePwMutation.isPending}>
              {changePwMutation.isPending ? <span className="spinner" /> : 'Update password'}
            </button>
          </form>
        </div>
      </section>

      {/* Telegram */}
      <section className={`card ${styles.section}`}>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>Telegram</h2>
          <span className={`${styles.telegramStatus} ${telegram?.configured ? styles.connected : styles.notConfigured}`}>
            {telegram?.configured ? '● Connected' : '○ Not configured'}
          </span>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.telegramGrid}>
            <div className="form-group">
              <label className="form-label">Bot Token</label>
              <input className="form-input" type="password" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="123456:ABC-DEF…" />
            </div>
            <div className="form-group">
              <label className="form-label">Chat ID</label>
              <input className="form-input" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="-1001234567890" />
            </div>
          </div>
          {telegramMsg && <p style={{ fontSize: 13, color: 'var(--green)' }}>{telegramMsg}</p>}
          <div className={styles.telegramActions}>
            <button className="btn btn-primary btn-sm" onClick={() => saveTelegramMutation.mutate()} disabled={saveTelegramMutation.isPending}>
              {saveTelegramMutation.isPending ? <span className="spinner" /> : 'Save'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => testTelegramMutation.mutate()} disabled={testTelegramMutation.isPending || !telegram?.configured}>
              Send test
            </button>
          </div>
        </div>
      </section>

      {/* Team members */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Team members</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.userCell}>
                      <span className={styles.avatar}>{u.email[0].toUpperCase()}</span>
                      <span>{u.email}</span>
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
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                    {new Date(u.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td>
                    {u.id !== user?.id && (
                      <button className="btn btn-danger btn-sm" onClick={() => removeUserMutation.mutate(u.id)}>
                        Remove
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
