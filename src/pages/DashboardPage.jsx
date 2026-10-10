import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from '../components/Toast'
import Shell from '../components/Shell'
import Icon from '../components/Icon'
import { adminApi, tenantApi, chatApi, mailboxApi, homeInquiryApi, inquiryApi } from '../api/client'
import { adminPath } from '../adminBase'

// 로그인 후 첫 화면. "지금 처리할 일 → 최근 활동 → 현황" 순으로 보여주는 운영 허브.
// 전용 대시보드 API 는 없다 — 각 목록 API 를 모아 쓴다.
const fmtAgo = (dt) => {
  if (!dt) return ''
  const s = Math.max(0, Math.floor((Date.now() - new Date(dt).getTime()) / 1000))
  if (s < 60) return '방금'
  const m = Math.floor(s / 60); if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60); if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [stats, setStats] = useState(null)
  const [todo, setTodo] = useState({ chat: 0, home: 0, tenant: 0, mail: 0 })
  const [feed, setFeed] = useState([]) // 최근 활동(채팅·홈문의)

  useEffect(() => {
    let alive = true

    // 현황 카드
    Promise.all([
      adminApi.list({ size: 1 }),
      tenantApi.list({ size: 1 }),
      tenantApi.list({ status: 'ACTIVE', size: 1 }),
      tenantApi.list({ status: 'PENDING', size: 1 }),
    ]).then(([admins, tenants, active, pending]) => {
      if (!alive) return
      setStats({ admins: admins.totalElements, tenants: tenants.totalElements, active: active.totalElements, pending: pending.totalElements })
    }).catch((e) => { if (alive) setError(e.message) })

    // 처리할 일 + 최근 활동
    const loadWork = async () => {
      const [convs, mailFolders, homeq, tenantConvs] = await Promise.all([
        chatApi.conversations().catch(() => []),
        mailboxApi.folders().catch(() => []),
        homeInquiryApi.list({ status: 'NEW', size: 5 }).catch(() => ({ content: [], totalElements: 0 })),
        inquiryApi.tenantConvs().catch(() => []),
      ])
      if (!alive) return

      const chatUnread = (convs || []).filter((c) => c.unreadForAdmin > 0).length
      const inbox = (mailFolders || []).find((f) => f.folder === 'INBOX')
      const mailUnread = inbox?.unread || 0
      const tenantWait = (tenantConvs || []).filter((c) => c.needsReply).length
      setTodo({ chat: chatUnread, home: homeq.totalElements || 0, tenant: tenantWait, mail: mailUnread })

      // 최근 활동 피드 — 채팅·홈문의를 시간순으로 섞어 상위 6개
      const chatItems = (convs || []).map((c) => ({
        kind: 'chat', icon: 'forum', title: `${c.visitorName || '방문자'} · 채팅`,
        sub: c.lastMessage || '새 대화', at: c.lastMessageAt, to: '/home-chat',
      }))
      const homeItems = (homeq.content || []).map((q) => ({
        kind: 'home', icon: 'contact_support', title: `${q.name || '방문자'} · ${q.siteLabel || '홈 문의'}`,
        sub: q.subject || '새 문의', at: q.createdAt, to: '/home-inquiries',
      }))
      const merged = [...chatItems, ...homeItems]
        .filter((x) => x.at)
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 6)
      setFeed(merged)
    }
    loadWork()
    const t = setInterval(loadWork, 30000) // 30초마다 갱신
    return () => { alive = false; clearInterval(t) }
  }, [])

  const todos = [
    { key: 'chat', label: '안 읽은 채팅', icon: 'forum', value: todo.chat, to: '/home-chat' },
    { key: 'home', label: '대기 홈페이지 문의', icon: 'contact_support', value: todo.home, to: '/home-inquiries' },
    { key: 'tenant', label: '대기 업체 문의', icon: 'storefront', value: todo.tenant, to: '/inquiries' },
    { key: 'mail', label: '안 읽은 메일', icon: 'mail', value: todo.mail, to: '/mailbox' },
  ]
  const todoTotal = todos.reduce((s, t) => s + (t.value || 0), 0)

  const cards = [
    { label: '재직 관리자', value: stats?.admins, to: '/admins' },
    { label: '전체 업체', value: stats?.tenants, to: '/tenants' },
    { label: '운영중 업체', value: stats?.active, to: '/tenants' },
    { label: '개설 대기 업체', value: stats?.pending, to: '/tenants' },
  ]

  return (
    <Shell>
      <div className="page-head"><h2>대시보드</h2></div>
      <Toast message={error} onClose={() => setError('')} />

      {/* 1) 지금 처리할 일 */}
      <section className="dash-sec">
        <h3 className="dash-h3">지금 처리할 일{todoTotal > 0 && <span className="dash-h3-n">{todoTotal}</span>}</h3>
        <div className="dash-todos">
          {todos.map((t) => (
            <button key={t.key} type="button" className={`dash-todo${t.value > 0 ? ' has' : ''}`} onClick={() => navigate(adminPath(t.to))}>
              <span className="dash-todo-ic"><Icon name={t.icon} filled={t.value > 0} /></span>
              <span className="dash-todo-v">{t.value ?? '—'}</span>
              <span className="dash-todo-l">{t.label}</span>
            </button>
          ))}
        </div>
        {todoTotal === 0 && <p className="dash-clear"><Icon name="check_circle" /> 지금 처리할 일이 없습니다.</p>}
      </section>

      {/* 2) 최근 활동 */}
      <section className="dash-sec">
        <h3 className="dash-h3">최근 활동</h3>
        {feed.length === 0 ? (
          <p className="dash-empty">최근 들어온 상담·문의가 없습니다.</p>
        ) : (
          <ul className="dash-feed">
            {feed.map((f, i) => (
              <li key={i}>
                <button type="button" className="dash-feed-item" onClick={() => navigate(adminPath(f.to))}>
                  <span className={`dash-feed-ic ${f.kind}`}><Icon name={f.icon} /></span>
                  <span className="dash-feed-txt">
                    <span className="dash-feed-title">{f.title}</span>
                    <span className="dash-feed-sub">{f.sub}</span>
                  </span>
                  <span className="dash-feed-at">{fmtAgo(f.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3) 현황 */}
      <section className="dash-sec">
        <h3 className="dash-h3">현황</h3>
        <div className="stat-grid">
          {cards.map((card) => (
            <button key={card.label} type="button" className="stat-card" onClick={() => navigate(adminPath(card.to))}>
              <span className="stat-label">{card.label}</span>
              <span className="stat-value">{card.value ?? '—'}</span>
            </button>
          ))}
        </div>
      </section>
    </Shell>
  )
}
