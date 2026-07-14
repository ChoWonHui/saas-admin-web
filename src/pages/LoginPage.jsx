import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { user, login, notice } = useAuth()
  const navigate = useNavigate()

  const [empNo, setEmpNo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to={user.mustChangePassword ? '/password' : '/admins'} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const me = await login(empNo.trim(), password)
      // 초기 비밀번호로 들어온 사람은 곧장 비밀번호 변경 화면으로 보낸다.
      navigate(me.mustChangePassword ? '/password' : '/admins', { replace: true })
    } catch (e) {
      // 백엔드가 INVALID_ADMIN_CREDENTIALS / ACCOUNT_LOCKED / ACCOUNT_DISABLED 를 구분해 내려준다.
      setError(e.message || '로그인에 실패했습니다.')
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-head">
          <h1 className="wordmark">EXPRISM</h1>
          <p className="slogan">We express your vision through innovation.</p>
          <p>내부 직원 전용 콘솔입니다. 사번으로 로그인하세요.</p>
        </div>

        {/* 비밀번호를 막 바꾼 사람에게 "변경된 비밀번호로 로그인하세요" 를 알린다. */}
        {notice && !error && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span>사번</span>
          <input
            type="text"
            value={empNo}
            onChange={(e) => setEmpNo(e.target.value.replace(/\D/g, ''))}
            autoComplete="username"
            placeholder="260001"
            inputMode="numeric"
            maxLength={6}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
          />
        </label>

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? '로그인 중…' : '로그인'}
        </button>

        <p className="hint">연속 5회 실패하면 계정이 15분간 잠깁니다.</p>
      </form>
    </div>
  )
}
