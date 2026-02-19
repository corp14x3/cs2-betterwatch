import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import './Login.css'

export default function Login() {
  const { login, register } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [mode, setMode]       = useState('login')
  const [form, setForm]       = useState({ email: '', nick: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handle = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password, rememberMe)
        navigate('/demos')
      } else {
        await register(form.email, form.nick, form.password)
        setMode('login')
        setError(t('login.success'))
      }
    } catch (err) {
      setError(err.response?.data?.detail || t('login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-bg">
        <div className="login-bg-grid" />
        <div className="login-bg-glow" />
        <div className="login-bg-scanline" />
      </div>
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo-icon">⊛</span>
          </div>
          <h1 className="login-title">{t('login.title')}</h1>
          <p className="login-subtitle">{t('login.subtitle')}</p>
        </div>

        <div className="login-tabs">
          <button className={`login-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError('') }}>
            {t('login.tab_login')}
          </button>
          <button className={`login-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError('') }}>
            {t('login.tab_register')}
          </button>
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="login-field">
            <label>{t('login.email')}</label>
            <input name="email" type="email" value={form.email} onChange={handle} placeholder="example@email.com" required autoComplete="email" />
          </div>
          {mode === 'register' && (
            <div className="login-field">
              <label>{t('login.username')}</label>
              <input name="nick" type="text" value={form.nick} onChange={handle} placeholder="nickname" required />
            </div>
          )}
          <div className="login-field">
            <label>{t('login.password')}</label>
            <input name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          {mode === 'login' && (
            <label className="login-remember">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              <span>{t('login.remember_me')}</span>
            </label>
          )}
          {error && (
            <p className={`login-error ${error.includes('success') || error.includes('başarılı') || error.includes('успешна') ? 'success' : ''}`}>
              {error}
            </p>
          )}
          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? t('login.loading') : mode === 'login' ? t('login.btn_login') : t('login.btn_register')}
          </button>
        </form>
      </div>
    </div>
  )
}
