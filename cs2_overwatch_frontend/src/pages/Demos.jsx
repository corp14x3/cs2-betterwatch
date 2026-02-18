import { useState, useEffect, useRef } from 'react'
import api from '../api/client'
import './Demos.css'

export default function Demos() {
  const [demos, setDemos]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [sortBy, setSortBy]     = useState('upload_timestamp')
  const [showUpload, setShowUpload] = useState(false)

  const fetchDemos = async () => {
    setLoading(true)
    try {
      const res = await api.get('/demos/', { params: { sort_by: sortBy, order: 'desc', limit: 50 } })
      setDemos(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDemos() }, [sortBy])

  const handleDownload = async (demo) => {
    try {
      const res = await api.get(`/demos/${demo.demo_id}/download`, { responseType: 'arraybuffer' })
      const fileName = `${demo.demo_id}.dem`
      if (window.electron) {
        await window.electron.saveDemo(fileName, Array.from(new Uint8Array(res.data)))
      } else {
        const blob = new Blob([res.data])
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = fileName; a.click()
        URL.revokeObjectURL(url)
      }
      fetchDemos()
    } catch (e) {
      alert('İndirme hatası: ' + (e.response?.data?.detail || e.message))
    }
  }

  return (
    <div className="demos-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">DEMOLAR</h1>
          <p className="page-sub">Topluluk tarafından yüklenen demo kayıtları</p>
        </div>
        <div className="demos-controls">
          <div className="sort-group">
            <button className={`sort-btn ${sortBy === 'upload_timestamp' ? 'active' : ''}`} onClick={() => setSortBy('upload_timestamp')}>TARİH</button>
            <button className={`sort-btn ${sortBy === 'download_count' ? 'active' : ''}`} onClick={() => setSortBy('download_count')}>İNDİRME</button>
          </div>
          <button className="upload-btn" onClick={() => setShowUpload(true)}>+ DEMO YÜKLE</button>
        </div>
      </div>

      {loading ? (
        <div className="demos-loading"><span className="mono">// yükleniyor...</span></div>
      ) : demos.length === 0 ? (
        <div className="demos-empty"><span className="mono">// henüz demo yok</span></div>
      ) : (
        <div className="demos-list">
          {demos.map(demo => (
            <DemoCard key={demo.demo_id} demo={demo} onDownload={handleDownload} onReport={fetchDemos} />
          ))}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={fetchDemos} />}
    </div>
  )
}

function DemoCard({ demo, onDownload, onReport }) {
  const [expanded, setExpanded]   = useState(false)
  const [reported, setReported]   = useState({})
  const [reporting, setReporting] = useState(null)
  const date = new Date(demo.upload_timestamp).toLocaleDateString('tr-TR')

  const report = async (url) => {
    setReporting(url)
    try {
      await api.post(`/demos/${demo.demo_id}/report`, { steam_url: url })
      setReported(r => ({ ...r, [url]: true }))
      onReport()
    } catch (e) {
      alert(e.response?.data?.detail || 'Raporlama hatası')
    } finally {
      setReporting(null)
    }
  }

  return (
    <div className="demo-card">
      <div className="demo-card-main">
        <div className="demo-card-info">
          <span className="demo-id mono">{demo.demo_id.slice(0, 8)}...</span>
          <span className="demo-date">{date}</span>
        </div>
        <div className="demo-card-stats">
          <span className="demo-stat"><span className="demo-stat-icon">↓</span>{demo.download_count}</span>
          <span className="demo-stat"><span className="demo-stat-icon">◎</span>{demo.demo_accs?.length || 0} şüpheli</span>
        </div>
        <div className="demo-card-actions">
          {demo.demo_accs?.length > 0 && (
            <button className="btn-ghost" onClick={() => setExpanded(e => !e)}>
              {expanded ? 'GİZLE' : 'ŞÜPHELİLER'}
            </button>
          )}
          <button className="btn-primary" onClick={() => onDownload(demo)}>↓ İNDİR</button>
        </div>
      </div>
      {expanded && demo.demo_accs?.length > 0 && (
        <div className="demo-suspects">
          <div className="suspects-title mono">// şüpheli hesaplar</div>
          {demo.demo_accs.map(url => (
            <div key={url} className="suspect-row">
              <a href={url} target="_blank" rel="noreferrer" className="suspect-url">{url}</a>
              <button
                className={`btn-report ${reported[url] ? 'reported' : ''}`}
                disabled={!!reported[url] || reporting === url}
                onClick={() => report(url)}
              >
                {reported[url] ? '✓ RAPORLANDI' : reporting === url ? '...' : 'RAPORLA'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UploadModal({ onClose, onSuccess }) {
  const [file, setFile]       = useState(null)
  const [accs, setAccs]       = useState([''])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const fileRef               = useRef()

  const addAcc    = () => setAccs(a => [...a, ''])
  const setAcc    = (i, v) => setAccs(a => a.map((x, j) => j === i ? v : x))
  const removeAcc = (i) => setAccs(a => a.filter((_, j) => j !== i))

  const submit = async () => {
    if (!file) { setError('Bir demo dosyası seç'); return }
    setLoading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('demo_accs', accs.filter(Boolean).join(','))
      await api.post('/demos/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      onSuccess(); onClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Yükleme hatası')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">DEMO YÜKLE</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-field">
          <label className="field-label">DEMO DOSYASI</label>
          <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => fileRef.current.click()}>
            {file ? <span className="mono">{file.name}</span> : <span className="file-drop-hint">Tıkla veya .dem dosyası seç</span>}
            <input ref={fileRef} type="file" accept=".dem" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
          </div>
        </div>
        <div className="modal-field">
          <label className="field-label">ŞÜPHELİ STEAM PROFİLLERİ</label>
          <div className="accs-list">
            {accs.map((acc, i) => (
              <div key={i} className="acc-row">
                <input type="text" className="acc-input" placeholder="https://steamcommunity.com/profiles/..." value={acc} onChange={e => setAcc(i, e.target.value)} />
                {accs.length > 1 && <button className="acc-remove" onClick={() => removeAcc(i)}>✕</button>}
              </div>
            ))}
            <button className="btn-ghost small" onClick={addAcc}>+ Hesap Ekle</button>
          </div>
        </div>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>İPTAL</button>
          <button className="btn-primary" onClick={submit} disabled={loading}>{loading ? 'YÜKLENİYOR...' : 'YÜKLE'}</button>
        </div>
      </div>
    </div>
  )
}
