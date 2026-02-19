import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import api from '../api/client'
import './Settings.css'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ru', label: 'Русский' },
]

export default function Settings() {
  const { user, logout, setUser } = useAuth()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [replaysPath, setReplaysPath]   = useState('')
  const [editingPath, setEditingPath]   = useState(false)
  const [pathInput, setPathInput]       = useState('')
  const [pathSaved, setPathSaved]       = useState(false)
  const [nick, setNick]                 = useState(user?.nick || '')
  const [photo, setPhoto]               = useState(user?.photo || '')
  const [profileSaved, setProfileSaved] = useState(false)
  const [rank, setRank]                 = useState(null)
  const [bannedAccs, setBannedAccs]     = useState([])

  useEffect(() => {
    if (window.electron) {
      window.electron.getSettings().then(s => {
        setReplaysPath(s.replaysPath || '')
        setPathInput(s.replaysPath || '')
      })
    }
    api.get('/users/me/profile').then(res => {
      setRank(res.data)
      setBannedAccs(res.data.banned_accs || [])
    }).catch(console.error)
  }, [])

  const savePath = async () => {
    if (window.electron) await window.electron.saveSettings({ replaysPath: pathInput })
    setReplaysPath(pathInput)
    setEditingPath(false)
    setPathSaved(true)
    setTimeout(() => setPathSaved(false), 2000)
  }

  const selectFolder = async () => {
    if (!window.electron) return
    const folder = await window.electron.selectFolder()
    if (folder) setPathInput(folder)
  }

  const saveProfile = async () => {
    try {
      await api.patch('/users/me', { nick: nick || undefined, photo: photo || undefined })
      setUser(u => ({ ...u, nick, photo }))
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch (e) {
      alert(e.response?.data?.detail || 'Error')
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const changeLanguage = (code) => {
    i18n.changeLanguage(code)
    localStorage.setItem('language', code)
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-sub">{t('settings.subtitle')}</p>
        </div>
      </div>

      <div className="settings-grid">

        {/* Profile */}
        <div className="settings-card">
          <div className="settings-card-title mono">{t('settings.profile_title')}</div>
          <div className="settings-profile-top">
            {user?.photo
              ? <img src={user.photo} alt="" className="settings-avatar" />
              : <div className="settings-avatar-placeholder">{user?.nick?.[0]?.toUpperCase()}</div>
            }
            <div>
              <div className="settings-nick">{user?.nick}</div>
              <div className="settings-rank mono">{rank?.rank || t('settings.unranked')} · LVL {user?.user_lvl}</div>
            </div>
          </div>
          <div className="settings-field">
            <label className="field-label">{t('settings.username')}</label>
            <input className="settings-input" value={nick} onChange={e => setNick(e.target.value)} placeholder="nickname" />
          </div>
          <div className="settings-field">
            <label className="field-label">{t('settings.photo')}</label>
            <input className="settings-input" value={photo} onChange={e => setPhoto(e.target.value)} placeholder="https://..." />
          </div>
          {rank?.badges?.length > 0 && (
            <div className="settings-field">
              <label className="field-label">{t('settings.badges')}</label>
              <div className="profile-badges">
                {rank.badges.map((b,i) => <div key={i} className="profile-badge">{b.rank_name}</div>)}
              </div>
            </div>
          )}
          <button className="btn-primary" onClick={saveProfile}>
            {profileSaved ? t('settings.saved') : t('settings.save')}
          </button>
        </div>

        {/* Replays Path */}
        <div className="settings-card">
          <div className="settings-card-title mono">{t('settings.path_title')}</div>
          <p className="settings-desc">{t('settings.path_desc')}</p>
          <div className="settings-field">
            <label className="field-label">{t('settings.path_label')}</label>
            {editingPath ? (
              <div className="path-edit-row">
                <input className="settings-input" value={pathInput} onChange={e => setPathInput(e.target.value)} placeholder="C:\Program Files\..." />
                {window.electron && <button className="btn-ghost small" onClick={selectFolder}>{t('settings.browse')}</button>}
              </div>
            ) : (
              <div className="path-display mono">
                {replaysPath || <span style={{color:'var(--text-dim)'}}>{t('settings.not_set')}</span>}
              </div>
            )}
          </div>
          <div className="settings-actions">
            {editingPath ? (
              <>
                <button className="btn-ghost" onClick={() => { setEditingPath(false); setPathInput(replaysPath) }}>{t('settings.cancel')}</button>
                <button className="btn-primary" onClick={savePath}>{pathSaved ? t('settings.saved') : t('settings.save')}</button>
              </>
            ) : (
              <button className="btn-ghost" onClick={() => setEditingPath(true)}>{t('settings.edit')}</button>
            )}
          </div>
        </div>

        {/* Language */}
        <div className="settings-card">
          <div className="settings-card-title mono">{t('settings.language_title')}</div>
          <div className="lang-group">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                className={`lang-btn ${i18n.language === lang.code ? 'active' : ''}`}
                onClick={() => changeLanguage(lang.code)}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Banned From You */}
        <div className="settings-card full-width">
          <div className="settings-card-title mono">{t('settings.banned_title')} ({bannedAccs.length})</div>
          <p className="settings-desc">{t('settings.banned_desc')}</p>
          {bannedAccs.length === 0 ? (
            <div className="mono" style={{color:'var(--text-dim)',fontSize:13}}>{t('settings.banned_empty')}</div>
          ) : (
            <div className="banned-list">
              {bannedAccs.map(acc => (
                <div key={acc.steam_url} className="banned-row">
                  <a href={acc.steam_url} target="_blank" rel="noreferrer" className="suspect-url">{acc.steam_url}</a>
                  <span className="banned-count">{acc.bans} {t('settings.bans')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout */}
        <div className="settings-card logout-card">
          <div className="settings-card-title mono">{t('settings.session_title')}</div>
          <button className="btn-logout" onClick={handleLogout}>{t('settings.logout')}</button>
        </div>

      </div>
    </div>
  )
}
