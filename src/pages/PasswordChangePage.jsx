import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/**
 * 강제 비밀번호 변경 화면.
 * 기본 비밀번호(exprism1234!)로 로그인한 사람은 이 화면 밖으로 나갈 수 없다 —
 * 그 토큰으로는 서버가 다른 API 를 거부한다(403). 화면만 막는 것이 아니다.
 */
export default function PasswordChangePage() {
  const { user, loading, changePassword } = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <div className="boot">확인 중…</div>
  if (!user) return <Navigate to="/login" replace />
  // 이미 바꾼 사람이 주소로 직접 들어온 경우
  if (!user.mustChangePassword) return <Navigate to="/admins" replace />

  // 확인란까지 입력했을 때만 불일치를 알린다. 타이핑 중에 빨간 글씨를 띄우면 성가시다.
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      // 성공하면 토큰이 폐기되고 로그인 화면으로 돌아간다 (안내 문구와 함께).
      await changePassword(newPassword, confirmPassword)
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-head">
          <h1 className="wordmark">EXPRISM</h1>
          <p className="slogan">We express your vision through innovation.</p>
          <p>
            <strong>{user.empNo}</strong> 님, 초기 비밀번호를 사용 중입니다. 새 비밀번호로 변경해야
            계속할 수 있습니다.
          </p>
        </div>

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span>신규 비밀번호</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="8자 이상"
            minLength={8}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>신규 비밀번호 확인</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="위와 동일하게 입력"
            required
            aria-invalid={mismatch}
          />
          {mismatch && <span className="field-error">비밀번호가 일치하지 않습니다.</span>}
        </label>

        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || mismatch || newPassword.length < 8 || !confirmPassword}
        >
          {submitting ? '변경 중…' : '변경'}
        </button>

        <p className="hint">변경 후에는 새 비밀번호로 다시 로그인해야 합니다.</p>
      </form>
    </div>
  )
}
