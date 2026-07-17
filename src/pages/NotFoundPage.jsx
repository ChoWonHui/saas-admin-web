import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

// 없는 주소로 들어왔을 때.
//  - 로그인 전: 아무것도 보여줄 것이 없다 → 무조건 로그인 화면으로 보낸다.
//  - 로그인 후: 잘못 들어왔음을 알린 뒤 대시보드로 보낸다.
//    (조용한 리다이렉트는 "내가 뭘 잘못 쳤는지"를 알 수 없게 만든다)
export default function NotFoundPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [secondsLeft, setSecondsLeft] = useState(3)

  useEffect(() => {
    if (loading || !user) return
    if (secondsLeft <= 0) {
      navigate('/dashboard', { replace: true })
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [loading, user, secondsLeft, navigate])

  if (loading) return <div className="boot">확인 중…</div>
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-head">
          <h1 className="wordmark">EXPRISM</h1>
          <p>주소가 올바르지 않습니다.</p>
        </div>

        <p className="alert" role="alert">
          <code>{pathname}</code> 는 없는 페이지입니다.
        </p>

        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate('/dashboard', { replace: true })}
        >
          대시보드로 이동
        </button>

        <p className="hint">{secondsLeft}초 뒤 자동으로 이동합니다.</p>
      </div>
    </div>
  )
}
