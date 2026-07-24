import { useEffect, useState } from 'react'
import Toast from '../components/Toast'
import { useNavigate } from 'react-router-dom'
import { adminApi, tenantApi } from '../api/client'
import Shell from '../components/Shell'

// 로그인 후 첫 화면. 전체 현황을 숫자로 보여주고, 카드를 누르면 해당 목록으로 간다.
// 전용 대시보드 API 는 아직 없다 — 목록 API 의 totalElements 만 쓴다 (size=1 로 본문은 안 받는다).
export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([
      adminApi.list({ size: 1 }),
      tenantApi.list({ size: 1 }),
      tenantApi.list({ status: 'ACTIVE', size: 1 }),
      tenantApi.list({ status: 'PENDING', size: 1 }),
    ])
      .then(([admins, tenants, active, pending]) => {
        if (!alive) return
        setStats({
          admins: admins.totalElements,
          tenants: tenants.totalElements,
          active: active.totalElements,
          pending: pending.totalElements,
        })
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [])

  const cards = [
    { label: '재직 관리자', value: stats?.admins, to: '/admins' },
    { label: '전체 업체', value: stats?.tenants, to: '/tenants' },
    { label: '운영중 업체', value: stats?.active, to: '/tenants' },
    { label: '개설 대기 업체', value: stats?.pending, to: '/tenants' },
  ]

  return (
    <Shell>
      <div className="page-head">
        <h2>대시보드</h2>
      </div>

      <Toast message={error} onClose={() => setError('')} />

      <div className="stat-grid">
        {cards.map((card) => (
          <button key={card.label} type="button" className="stat-card" onClick={() => navigate(card.to)}>
            <span className="stat-label">{card.label}</span>
            <span className="stat-value">{card.value ?? '—'}</span>
          </button>
        ))}
      </div>
    </Shell>
  )
}
