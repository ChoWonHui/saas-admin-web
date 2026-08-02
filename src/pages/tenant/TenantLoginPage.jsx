import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTenantAuth } from '../../auth/TenantAuthContext'

// 사장님에게 친근한 가게(스토어프론트) 일러스트
function StorefrontMark() {
  return (
    <svg className="owner-illus" viewBox="0 0 120 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 34h92l-8-16H22l-8 16Z" fill="#5b48e6" />
      <path d="M14 34h92l-8-16H22l-8 16Z" fill="url(#awning)" />
      <g fill="#fff" opacity=".85">
        <path d="M22 34l4-16h10l-3 16z" />
        <path d="M50 34l1.5-16h10l-1 16z" />
        <path d="M78 34l-1.5-16h10l3 16z" />
      </g>
      <rect x="20" y="34" width="80" height="52" rx="4" fill="#fff" stroke="#d9d5f5" strokeWidth="2" />
      <rect x="52" y="52" width="16" height="34" rx="2" fill="#a99ff0" />
      <circle cx="64" cy="70" r="1.6" fill="#3525cd" />
      <rect x="30" y="52" width="16" height="14" rx="2" fill="#ece9ff" stroke="#a99ff0" strokeWidth="1.5" />
      <rect x="74" y="52" width="16" height="14" rx="2" fill="#ece9ff" stroke="#a99ff0" strokeWidth="1.5" />
      <circle cx="60" cy="27" r="3" fill="#fff" opacity=".9" />
      <defs>
        <linearGradient id="awning" x1="14" y1="18" x2="106" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5b48e6" />
          <stop offset="1" stopColor="#3525cd" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function TenantLoginPage() {
  const { user, login, lookup } = useTenantAuth()
  const navigate = useNavigate()
  const { code: codeFromUrl } = useParams() // /admin/login/:code 로 들어오면 업체코드 자동 채움

  const [tenantCode, setTenantCode] = useState(codeFromUrl ? codeFromUrl.toUpperCase() : '')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shopName, setShopName] = useState('') // 업체코드로 확인한 가게 이름
  const [codeState, setCodeState] = useState('loading') // loading | ok | notfound
  const idRef = useRef(null)

  // URL 에 업체코드가 있으면 가게 이름을 조회해 "우리 가게 맞음"을 보여준다.
  const locked = !!codeFromUrl
  useEffect(() => {
    if (!codeFromUrl) return
    let alive = true
    lookup(codeFromUrl)
      .then((r) => {
        if (!alive) return
        if (r?.found) { setShopName(r.name); setCodeState('ok') }
        else setCodeState('notfound')
      })
      .catch(() => { if (alive) setCodeState('notfound') })
    // 코드가 이미 채워졌으니 아이디부터 입력하게 포커스를 옮긴다.
    idRef.current?.focus()
    return () => { alive = false }
  }, [codeFromUrl, lookup])

  if (user) return <Navigate to="/admin" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(tenantCode, loginId, password)
      navigate('/admin', { replace: true })
    } catch (e) {
      setError(e.message || '로그인에 실패했습니다.')
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="owner-auth">
      <div className="owner-card">
        <form onSubmit={handleSubmit}>
          <div className="owner-hero">
            <StorefrontMark />
            <h1 className="owner-title">
              {locked && shopName ? `${shopName}` : '사장님, 어서 오세요'}
            </h1>
            <p className="owner-sub">
              {locked && shopName
                ? '이메일과 비밀번호를 입력해 주세요.'
                : '오늘도 좋은 하루 되세요. 가게 운영을 시작해 볼까요?'}
            </p>
          </div>

          {error && <p className="owner-alert" role="alert">{error}</p>}

          {/* URL 로 업체코드가 들어오면 칸을 잠그고 배지로만 보여준다. */}
          {locked ? (
            <div className={`owner-shopbadge${codeState === 'notfound' ? ' bad' : ''}`}>
              <span className="sb-ico" aria-hidden="true">{codeState === 'notfound' ? '❓' : '🏪'}</span>
              <span className="sb-body">
                <span className="sb-name">
                  {codeState === 'loading' ? '가게 확인 중…'
                    : codeState === 'notfound' ? '가게를 찾을 수 없어요'
                    : shopName}
                </span>
                <span className="sb-code">
                  {codeState === 'notfound' ? '링크의 업체코드를 다시 확인해 주세요' : `업체코드 ${tenantCode}`}
                </span>
              </span>
            </div>
          ) : (
            <label className="owner-field">
              <span className="of-label">업체코드</span>
              <span className="of-input">
                <span className="of-ico" aria-hidden="true">🏪</span>
                <input
                  type="text"
                  value={tenantCode}
                  onChange={(e) => setTenantCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  autoComplete="off"
                  placeholder="가게 코드"
                  maxLength={20}
                  required
                  autoFocus
                />
              </span>
            </label>
          )}

          <label className="owner-field">
            <span className="of-label">이메일</span>
            <span className="of-input">
              <span className="of-ico" aria-hidden="true">✉️</span>
              <input
                ref={idRef}
                type="email"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value.replace(/\s/g, ''))}
                autoComplete="email"
                placeholder="이메일을 입력해주세요"
                maxLength={150}
                required
                autoFocus={locked}
              />
            </span>
          </label>

          <label className="owner-field">
            <span className="of-label">비밀번호</span>
            <span className="of-input">
              <span className="of-ico" aria-hidden="true">🔒</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="비밀번호"
                required
              />
            </span>
          </label>

          <button type="submit" className="owner-btn" disabled={submitting}>
            {submitting ? '들어가는 중…' : '로그인하고 시작하기'}
          </button>

          <p className="owner-foot">연속 5회 틀리면 계정이 15분간 잠겨요.</p>
        </form>
      </div>
      <p className="owner-brand">EXPRISM 가게 운영 콘솔</p>
    </div>
  )
}
