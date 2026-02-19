import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'
import './Demos.css'

export default function DownloadedDemos() {
  const { t } = useTranslation()
  const [demos, setDemos]     = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDemos = async () => {
    setLoading(true)
    try {
      const res = await api.get('/demos/my/downloaded')
      const list = res.data

      // Her demo için local dosya var mı kontrol et
      if (window.electron) {
        const settings = await window.electron.getSettings()
        const replaysPath = settings.replaysPath || ''
        const checked = await Promise.all(list.map(async demo => {
          const filePath = `${replaysPath}\\${demo.demo_id}.dem`
          const exists = replaysPath ? await window.electron.fileExists(filePath) : false
          return { ...demo, localExists: exists, localPath: filePath }
        }))
        setDemos(checked)
      } else {
        setDemos(list.map(d => ({ ...d, localExists: false })))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDemos() }, [])

  const handleDelete = async (demo) => {
    if (!window.electron) {
      alert(t('downloaded.no_electron'))
      return
    }
    if (demo.localExists) {
      await window.electron.deleteDemo(demo.localPath)
    }
    // DB'deki kaydı silmiyoruz, sadece local dosyayı sildik
    // Listeyi yenile
    fetchDemos()
  }

  const report = (url) => {
  let profileUrl
  if (url.includes('/profiles/')) {
    const steamId = url.split('/profiles/').pop().replace(/\/$/, '')
    profileUrl = `https://steamcommunity.com/profiles/${steamId}`
  } else {
    profileUrl = url
  }
  window.electron
    ? window.electron.openExternal(profileUrl)
    : window.open(profileUrl, '_blank')
  }

  return (
    <div className="demos-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('downloaded.title')}</h1>
          <p className="page-sub">{t('downloaded.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="demos-loading"><span className="mono">{t('downloaded.loading')}</span></div>
      ) : demos.length === 0 ? (
        <div className="demos-empty"><span className="mono">{t('downloaded.empty')}</span></div>
      ) : (
        <div className="demos-list">
          {demos.map(demo => {
            const date = new Date(demo.upload_timestamp).toLocaleDateString()
            return (
              <div key={demo.demo_id} className="demo-card">
                <div className="demo-card-main">
                  <div className="demo-card-info">
                    <span className="demo-id mono">{demo.demo_id.slice(0, 8)}...</span>
                    <span className="demo-date">{date}</span>
                  </div>
                  <div className="demo-card-stats">
                    <span className="demo-stat">
                      <span className="demo-stat-icon">◎</span>
                      {demo.demo_accs?.length || 0} {t('downloaded.suspects')}
                    </span>
                    <span className={`demo-stat ${demo.localExists ? 'stat-ok' : 'stat-missing'}`}>
                      {demo.localExists ? '● LOCAL' : '○ SİLİNMİŞ'}
                    </span>
                  </div>
                  <div className="demo-card-actions">
                    {demo.localExists && (
                      <button className="btn-delete" onClick={() => handleDelete(demo)}>
                        {t('downloaded.delete')}
                      </button>
                    )}
                  </div>
                </div>

                {/* Şüpheliler + Report */}
                {demo.demo_accs?.length > 0 && (
                  <div className="demo-suspects">
                    <div className="suspects-title mono">// suspect accounts</div>
                    {demo.demo_accs.map(url => (
                      <div key={url} className="suspect-row">
                        <a href={url} target="_blank" rel="noreferrer" className="suspect-url">{url}</a>
                        <button className="btn-report" onClick={() => report(url)}>
                          {t('demos.report')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
