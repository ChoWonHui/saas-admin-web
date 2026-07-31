import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminPath } from '../adminBase'
import { useAuth } from '../auth/AuthContext'

// 없는 주소로 들어왔을 때.
//  - 로그인 전: 콘솔의 접두 경로가 새어나가지 않도록, 어떤 링크·리다이렉트도 없이 담백한 404 만 보여준다.
//  - 로그인 후: 잘못 들어왔음을 알린 뒤 대시보드로 보낸다.
export default function NotFoundPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [secondsLeft, setSecondsLeft] = useState(3)

  useEffect(() => {
    if (loading || !user) return
    if (secondsLeft <= 0) {
      navigate(adminPath('/dashboard'), { replace: true })
      return
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [loading, user, secondsLeft, navigate])

  if (loading) return <div className="boot">확인 중…</div>

  // 로그인 전 — 접두 경로/콘솔을 드러내지 않는 담백한 안내.
  if (!user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-head">
            <h1 className="wordmark">EXPRISM</h1>
            <p>페이지를 찾을 수 없습니다.</p>
          </div>
          <p className="hint">주소를 다시 확인해 주세요.</p>
        </div>
      </div>
    )
  }

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
          onClick={() => navigate(adminPath('/dashboard'), { replace: true })}
        >
          대시보드로 이동
        </button>

        <p className="hint">{secondsLeft}초 뒤 자동으로 이동합니다.</p>
      </div>
    </div>
  )
}
