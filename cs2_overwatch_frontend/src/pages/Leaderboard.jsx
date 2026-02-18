import { useState, useEffect } from 'react'
import api from '../api/client'
import './Leaderboard.css'

export default function Leaderboard() {
  const [period, setPeriod]   = useState('weekly')
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/leaderboard/${period}`)
      setRows(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLeaderboard() }, [period])

  return (
    <div className="lb-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">SIRA LİSTESİ</h1>
          <p className="page-sub">En çok ban yedirten oyuncular</p>
        </div>
        <div className="period-group">
          {['weekly','monthly','yearly'].map(p => (
            <button
              key={p}
              className={`sort-btn ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'weekly' ? 'HAFTALIK' : p === 'monthly' ? 'AYLIK' : 'YILLIK'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="demos-loading"><span className="mono">// yükleniyor...</span></div>
      ) : rows.length === 0 ? (
        <div className="demos-empty"><span className="mono">// henüz veri yok</span></div>
      ) : (
        <div className="lb-list">
          {rows.map((row, i) => (
            <div key={row.user_id} className="lb-row" onClick={() => setProfile(row.user_id)}>
              <div className={`lb-rank ${i < 3 ? 'top' : ''}`}>
                {i === 0 ? '◈' : i === 1 ? '◇' : i === 2 ? '○' : `#${i+1}`}
              </div>
              <div className="lb-user">
                {row.photo
                  ? <img src={row.photo} alt="" className="lb-avatar" />
                  : <div className="lb-avatar-placeholder">{row.nick?.[0]?.toUpperCase()}</div>
                }
                <div>
                  <div className="lb-nick">{row.nick}</div>
                  <div className="lb-lvl mono">LVL {row.user_lvl}</div>
                </div>
              </div>
              <div className="lb-bans">
                <span className="lb-ban-count">{row.ban_count}</span>
                <span className="lb-ban-label">BAN</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {profile && <ProfileModal userId={profile} onClose={() => setProfile(null)} />}
    </div>
  )
}

function ProfileModal({ userId, onClose }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/leaderboard/profile/${userId}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal profile-modal">
        <div className="modal-header">
          <h2 className="modal-title">PROFİL</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {loading ? (
          <div className="mono" style={{color:'var(--text-dim)',fontSize:13}}>// yükleniyor...</div>
        ) : data && (
          <>
            <div className="profile-top">
              {data.photo
                ? <img src={data.photo} alt="" className="profile-avatar" />
                : <div className="profile-avatar-placeholder">{data.nick?.[0]?.toUpperCase()}</div>
              }
              <div>
                <div className="profile-nick">{data.nick}</div>
                <div className="profile-rank mono">{data.rank || 'Rütbesiz'} · LVL {data.user_lvl}</div>
              </div>
            </div>

            {data.badges?.length > 0 && (
              <div className="profile-section">
                <div className="profile-section-title mono">// rozetler</div>
                <div className="profile-badges">
                  {data.badges.map((b,i) => (
                    <div key={i} className="profile-badge">{b.rank_name}</div>
                  ))}
                </div>
              </div>
            )}

            {data.banned_accs?.length > 0 && (
              <div className="profile-section">
                <div className="profile-section-title mono">// banned from you ({data.banned_accs.length})</div>
                <div className="profile-banned-list">
                  {data.banned_accs.map(url => (
                    <a key={url} href={url} target="_blank" rel="noreferrer" className="suspect-url">
                      {url}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
