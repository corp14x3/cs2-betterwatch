import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import './Settings.css'

export default function Settings() {
  const { user, logout, setUser } = useAuth()
  const navigate = useNavigate()

  const [replaysPath, setReplaysPath]   = useState('')
  const [editingPath, setEditingPath]   = useState(false)
  const [pathInput, setPathInput]       = useState('')
  const [pathSaved, setPathSaved]       = useState(false)

  const [nick, setNick]         = useState(user?.nick || '')
  const [photo, setPhoto]       = useState(user?.photo || '')
  const [profileSaved, setProfileSaved] = useState(false)

  const [rank, setRank]         = useState(null)
  const [bannedAccs, setBannedAccs] = useState([])

  // Ayarları yükle
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

  // Replays path kaydet
  const savePath = async () => {
    if (window.electron) {
      await window.electron.saveSettings({ replaysPath: pathInput })
    }
    setReplaysPath(pathInput)
    setEditingPath(false)
    setPathSaved(true)
    setTimeout(() => setPathSaved(false), 2000)
  }

  // Klasör seç
  const selectFolder = async () => {
    if (!window.electron) return
    const folder = await window.electron.selectFolder()
    if (folder) { setPathInput(folder) }
  }

  // Profil güncelle
  const saveProfile = async () => {
    try {
      await api.patch('/users/me', { nick: nick || undefined, photo: photo || undefined })
      setUser(u => ({ ...u, nick, photo }))
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch (e) {
      alert(e.response?.data?.detail || 'Hata')
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AYARLAR</h1>
          <p className="page-sub">Uygulama tercihleri ve profil</p>
        </div>
      </div>

      <div className="settings-grid">

        {/* Profil */}
        <div className="settings-card">
          <div className="settings-card-title mono">// kullanıcı profili</div>
          <div className="settings-profile-top">
            {user?.photo
              ? <img src={user.photo} alt="" className="settings-avatar" />
              : <div className="settings-avatar-placeholder">{user?.nick?.[0]?.toUpperCase()}</div>
            }
            <div>
              <div className="settings-nick">{user?.nick}</div>
              <div className="settings-rank mono">{rank?.rank || 'Rütbesiz'} · LVL {user?.user_lvl}</div>
            </div>
          </div>

          <div className="settings-field">
            <label className="field-label">KULLANICI ADI</label>
            <input
              className="settings-input"
              value={nick}
              onChange={e => setNick(e.target.value)}
              placeholder="nickname"
            />
          </div>
          <div className="settings-field">
            <label className="field-label">PROFİL FOTOĞRAFI (URL)</label>
            <input
              className="settings-input"
              value={photo}
              onChange={e => setPhoto(e.target.value)}
              placeholder="https://..."
            />
          </div>

          {rank?.badges?.length > 0 && (
            <div className="settings-field">
              <label className="field-label">ROZETLER</label>
              <div className="profile-badges">
                {rank.badges.map((b,i) => (
                  <div key={i} className="profile-badge">{b.rank_name}</div>
                ))}
              </div>
            </div>
          )}

          <button className="btn-primary" onClick={saveProfile}>
            {profileSaved ? '✓ KAYDEDİLDİ' : 'KAYDET'}
          </button>
        </div>

        {/* Replays Path */}
        <div className="settings-card">
          <div className="settings-card-title mono">// game replays path</div>
          <p className="settings-desc">
            Demo dosyalarının kaydedileceği CS2 replays klasörü.
          </p>
          <div className="settings-field">
            <label className="field-label">KLASÖR YOLU</label>
            {editingPath ? (
              <div className="path-edit-row">
                <input
                  className="settings-input"
                  value={pathInput}
                  onChange={e => setPathInput(e.target.value)}
                  placeholder="C:\Program Files\..."
                />
                {window.electron && (
                  <button className="btn-ghost small" onClick={selectFolder}>SEÇ</button>
                )}
              </div>
            ) : (
              <div className="path-display mono">
                {replaysPath || <span style={{color:'var(--text-dim)'}}>ayarlanmamış</span>}
              </div>
            )}
          </div>
          <div className="settings-actions">
            {editingPath ? (
              <>
                <button className="btn-ghost" onClick={() => { setEditingPath(false); setPathInput(replaysPath) }}>İPTAL</button>
                <button className="btn-primary" onClick={savePath}>{pathSaved ? '✓ KAYDEDİLDİ' : 'KAYDET'}</button>
              </>
            ) : (
              <button className="btn-ghost" onClick={() => setEditingPath(true)}>DÜZENLE</button>
            )}
          </div>
        </div>

        {/* Banned From You */}
        <div className="settings-card full-width">
          <div className="settings-card-title mono">// banned from you ({bannedAccs.length})</div>
          <p className="settings-desc">Raporladığın ve ban yiyen hesaplar.</p>
          {bannedAccs.length === 0 ? (
            <div className="mono" style={{color:'var(--text-dim)',fontSize:13}}>// henüz ban yiyen hesap yok</div>
          ) : (
            <div className="banned-list">
              {bannedAccs.map(acc => (
                <div key={acc.steam_url} className="banned-row">
                  <a href={acc.steam_url} target="_blank" rel="noreferrer" className="suspect-url">
                    {acc.steam_url}
                  </a>
                  <span className="banned-count">{acc.bans} BAN</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Çıkış */}
        <div className="settings-card logout-card">
          <div className="settings-card-title mono">// oturum</div>
          <button className="btn-logout" onClick={handleLogout}>ÇIKIŞ YAP</button>
        </div>

      </div>
    </div>
  )
}
