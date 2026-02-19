import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api/client'
import './Demos.css'

export default function Demos() {
  const { t } = useTranslation()
  const [demos, setDemos]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [sortBy, setSortBy]         = useState('upload_timestamp')
  const [showUpload, setShowUpload] = useState(false)
  const [downloadedIds, setDownloadedIds] = useState(new Set())

  const fetchDemos = async () => {
    setLoading(true)
    try {
      const [demosRes, dlRes] = await Promise.all([
        api.get('/demos/', { params: { sort_by: sortBy, order: 'desc', limit: 50 } }),
        api.get('/demos/my/downloaded').catch(() => ({ data: [] }))
      ])
      setDemos(demosRes.data)
      setDownloadedIds(new Set(dlRes.data.map(d => d.demo_id)))
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDemos() }, [sortBy])

  return (
    <div className="demos-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('demos.title')}</h1>
          <p className="page-sub">{t('demos.subtitle')}</p>
        </div>
        <div className="demos-controls">
          <div className="sort-group">
            <button className={`sort-btn ${sortBy === 'upload_timestamp' ? 'active' : ''}`} onClick={() => setSortBy('upload_timestamp')}>{t('demos.sort_date')}</button>
            <button className={`sort-btn ${sortBy === 'download_count' ? 'active' : ''}`} onClick={() => setSortBy('download_count')}>{t('demos.sort_downloads')}</button>
          </div>
          <button className="upload-btn" onClick={() => setShowUpload(true)}>{t('demos.upload_btn')}</button>
        </div>
      </div>

      {loading ? (
        <div className="demos-loading"><span className="mono">{t('demos.loading')}</span></div>
      ) : demos.length === 0 ? (
        <div className="demos-empty"><span className="mono">{t('demos.empty')}</span></div>
      ) : (
        <div className="demos-list">
          {demos.map(demo => (
            <DemoCard
              key={demo.demo_id}
              demo={demo}
              onReport={fetchDemos}
              isDownloaded={downloadedIds.has(demo.demo_id)}
              onDownloaded={() => setDownloadedIds(s => new Set([...s, demo.demo_id]))}
            />
          ))}
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={fetchDemos} />}
    </div>
  )
}

function DemoCard({ demo, onReport, isDownloaded, onDownloaded }) {
  const { t } = useTranslation()
  const [expanded, setExpanded]     = useState(false)
  const [dlProgress, setDlProgress] = useState(null)
  const date = new Date(demo.upload_timestamp).toLocaleDateString()

  const handleDownload = async () => {
    if (isDownloaded) return
    try {
      setDlProgress(0)
      const res = await api.get(`/demos/${demo.demo_id}/download`, {
        responseType: 'arraybuffer',
        onDownloadProgress: (e) => {
          if (e.total) setDlProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
      const fileName = `${demo.demo_id}.dem`
      if (window.electron) {
        await window.electron.saveDemo(fileName, res.data)
      } else {
        const blob = new Blob([res.data])
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = fileName; a.click()
        URL.revokeObjectURL(url)
      }
      onDownloaded()
      onReport()
    } catch (e) {
      alert(t('demos.download_error') + ': ' + (e.response?.data?.detail || e.message))
    } finally {
      setDlProgress(null)
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
          <span className="demo-stat"><span className="demo-stat-icon">◎</span>{demo.demo_accs?.length || 0} {t('demos.suspects')}</span>
        </div>
        <div className="demo-card-actions">
          {demo.demo_accs?.length > 0 && (
            <button className="btn-ghost" onClick={() => setExpanded(e => !e)}>
              {expanded ? t('demos.hide') : t('demos.show_suspects')}
            </button>
          )}
          <button
            className={`btn-primary ${isDownloaded ? 'downloaded' : ''}`}
            onClick={handleDownload}
            disabled={isDownloaded || dlProgress !== null}
          >
            {isDownloaded ? '✓ İNDİRİLDİ' : dlProgress !== null ? `↓ ${dlProgress}%` : t('demos.download')}
          </button>
        </div>
      </div>

      {dlProgress !== null && (
        <div className="progress-container">
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${dlProgress}%` }} />
          </div>
          <span className="progress-text">{t('demos.download')} {dlProgress}%</span>
        </div>
      )}

      {expanded && demo.demo_accs?.length > 0 && (
        <div className="demo-suspects">
          <div className="suspects-title mono">{t('demos.suspect_accounts')}</div>
          {demo.demo_accs.map(url => (
            <div key={url} className="suspect-row">
              <a href={url} target="_blank" rel="noreferrer" className="suspect-url">{url}</a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UploadModal({ onClose, onSuccess }) {
  const { t } = useTranslation()
  const [file, setFile]         = useState(null)
  const [accs, setAccs]         = useState([''])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [progress, setProgress] = useState(0)
  const fileRef                 = useRef()

  const addAcc    = () => setAccs(a => [...a, ''])
  const setAcc    = (i, v) => setAccs(a => a.map((x, j) => j === i ? v : x))
  const removeAcc = (i) => setAccs(a => a.filter((_, j) => j !== i))

  const submit = async () => {
    if (!file) { setError(t('upload.no_file_error')); return }
    setLoading(true); setError(''); setProgress(0)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('demo_accs', accs.filter(Boolean).join(','))
      await api.post('/demos/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
      onSuccess(); onClose()
    } catch (e) {
      setError(e.response?.data?.detail || t('upload.upload_error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{t('upload.title')}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-field">
          <label className="field-label">{t('upload.file_label')}</label>
          <div className={`file-drop ${file ? 'has-file' : ''}`} onClick={() => fileRef.current.click()}>
            {file ? <span className="mono">{file.name}</span> : <span className="file-drop-hint">{t('upload.file_hint')}</span>}
            <input ref={fileRef} type="file" accept=".dem" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
          </div>
        </div>
        <div className="modal-field">
          <label className="field-label">{t('upload.suspects_label')}</label>
          <div className="accs-list">
            {accs.map((acc, i) => (
              <div key={i} className="acc-row">
                <input type="text" className="acc-input" placeholder="https://steamcommunity.com/profiles/..." value={acc} onChange={e => setAcc(i, e.target.value)} />
                {accs.length > 1 && <button className="acc-remove" onClick={() => removeAcc(i)}>✕</button>}
              </div>
            ))}
            <button className="btn-ghost small" onClick={addAcc}>{t('upload.add_account')}</button>
          </div>
        </div>

        {loading && (
          <div className="progress-container">
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <span className="progress-text">{t('upload.uploading')} {progress}%</span>
          </div>
        )}

        {error && <p className="modal-error">{error}</p>}
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>{t('upload.cancel')}</button>
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? `${t('upload.uploading')} ${progress}%` : t('upload.upload')}
          </button>
        </div>
      </div>
    </div>
  )
}
