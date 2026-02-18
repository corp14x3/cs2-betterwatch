import { useState, useEffect } from 'react'
import api from '../api/client'
import './Demos.css'

export default function DownloadedDemos() {
  const [demos, setDemos]     = useState([])
  const [loading, setLoading] = useState(true)

  const fetchDemos = async () => {
    setLoading(true)
    try {
      const res = await api.get('/demos/my/downloaded')
      setDemos(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDemos() }, [])

  const handleDelete = async (demo) => {
    if (!window.electron) {
      alert('Dosya silme sadece masaüstü uygulamada çalışır.')
      return
    }
    const settings = await window.electron.getSettings()
    if (!settings.replaysPath) {
      alert('Önce ayarlardan replays klasörünü ayarla.')
      return
    }
    const filePath = `${settings.replaysPath}\\${demo.demo_id}.dem`
    const deleted  = await window.electron.deleteDemo(filePath)
    if (deleted) {
      setDemos(d => d.filter(x => x.demo_id !== demo.demo_id))
    } else {
      alert('Dosya bulunamadı, zaten silinmiş olabilir.')
      setDemos(d => d.filter(x => x.demo_id !== demo.demo_id))
    }
  }

  return (
    <div className="demos-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">İNDİRİLEN DEMOLAR</h1>
          <p className="page-sub">Localine indirdiğin demo kayıtları</p>
        </div>
      </div>

      {loading ? (
        <div className="demos-loading"><span className="mono">// yükleniyor...</span></div>
      ) : demos.length === 0 ? (
        <div className="demos-empty"><span className="mono">// henüz indirilen demo yok</span></div>
      ) : (
        <div className="demos-list">
          {demos.map(demo => {
            const date = new Date(demo.upload_timestamp).toLocaleDateString('tr-TR')
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
                      {demo.demo_accs?.length || 0} şüpheli
                    </span>
                  </div>
                  <div className="demo-card-actions">
                    <button className="btn-delete" onClick={() => handleDelete(demo)}>
                      ✕ SİL
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
