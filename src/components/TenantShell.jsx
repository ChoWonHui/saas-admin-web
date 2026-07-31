import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useTenantAuth } from '../auth/TenantAuthContext'
import { tenantNoticeBoardApi, tenantMenuApi } from '../api/tenantClient'
import Icon from './Icon'

const ROLE_LABEL = {
  TENANT_OWNER: '대표',
  TENANT_MANAGER: '홀',
  TENANT_STAFF: '주방',
}

// API 실패 시 폴백용 기본 네비(대표 기준). 정상 동작 시엔 /api/tenant/menus 결과를 쓴다.
const NAV = [
  { to: '/admin', end: true, label: '홈', icon: 'cottage' },
  { to: '/admin/orders', label: '주문', icon: 'receipt_long' },
  { to: '/admin/waitlist', label: '예약', icon: 'event' },
  { to: '/admin/tables', label: '테이블', icon: 'table_restaurant' },
  { to: '/admin/menu', label: '메뉴판', icon: 'restaurant_menu' },
  { to: '/admin/staff', label: '직원', icon: 'group', ownerOnly: true },
  { to: '/admin/notices', label: '공지사항', icon: 'campaign' },
  { to: '/admin/inquiries', label: '문의', icon: 'forum' },
]

const DISMISS_KEY = 'saas.tenant.noticePopupDismiss'   // "오늘 하루 보지 않기" (localStorage, 날짜별)
const SESSION_KEY = 'saas.tenant.noticePopupSeen'      // 닫기(이번 세션 동안 다시 안 뜸)
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
function loadJson(store, key) {
  try { return JSON.parse(store.getItem(key) || '{}') } catch { return {} }
}

/** 로그인 후 활성 팝업 공지를 하나씩 띄운다. 닫기=이번 세션 동안, "오늘 하루 보지 않기"=오늘 하루. */
function NoticePopupHost() {
  const [queue, setQueue] = useState([])

  useEffect(() => {
    let alive = true
    tenantNoticeBoardApi.popups()
      .then((list) => {
        if (!alive) return
        const dismissed = loadJson(localStorage, DISMISS_KEY)
        const seen = loadJson(sessionStorage, SESSION_KEY)
        const today = todayStr()
        setQueue((list || []).filter((n) => dismissed[n.id] !== today && !seen[n.id]))
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (queue.length === 0) return null
  const notice = queue[0]
  const next = () => {
    // 이번 세션 동안 다시 뜨지 않게 기억(화면 이동 시 재노출 방지).
    const s = loadJson(sessionStorage, SESSION_KEY); s[notice.id] = 1
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch { /* noop */ }
    setQueue((q) => q.slice(1))
  }
  const dismissToday = () => {
    const d = loadJson(localStorage, DISMISS_KEY); d[notice.id] = todayStr()
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(d)) } catch { /* noop */ }
    next()
  }

  return (
    <div className="modal-backdrop" onClick={next}>
      <div className="modal tn-popup" onClick={(e) => e.stopPropagation()}>
        <div className="tn-popup-head">
          <Icon name="campaign" />
          <h3>{notice.title}</h3>
        </div>
        <div className="tn-popup-body" dangerouslySetInnerHTML={{ __html: notice.content }} />
        <div className="tn-popup-actions">
          <button className="btn-ghost btn-sm" onClick={dismissToday}>오늘 하루 보지 않기</button>
          <button className="btn-primary btn-sm" onClick={next}>닫기{queue.length > 1 ? ` (${queue.length})` : ''}</button>
        </div>
      </div>
    </div>
  )
}

// 업체(사장님) 콘솔 공통 껍데기 — Material Design 3(인디고) 톤. 상단 내비 + 푸터 + 공지 팝업.
export default function TenantShell({ children }) {
  const { user, logout } = useTenantAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const navClass = ({ isActive }) => `m-nav-link${isActive ? ' on' : ''}`
  const mnavClass = ({ isActive }) => `m-mnav-link${isActive ? ' on' : ''}`

  // 상단 메뉴는 서버에서 역할별로 필터돼 온다. 실패하면 하드코딩 폴백(대표 기준)으로 콘솔이 안 끊기게.
  const [items, setItems] = useState(() =>
    NAV.filter((n) => !n.ownerOnly).map((n) => ({ id: n.to, to: n.to, end: n.end, label: n.label, icon: n.icon })))
  useEffect(() => {
    let alive = true
    tenantMenuApi.myMenus()
      .then((rows) => {
        if (!alive) return
        setItems(rows.map((r) => ({ id: r.id, to: r.url, end: r.url === '/admin', label: r.name, icon: r.icon || 'chevron_right' })))
      })
      .catch(() => {
        if (!alive) return
        setItems(NAV.filter((n) => !n.ownerOnly || user?.roleCode === 'TENANT_OWNER')
          .map((n) => ({ id: n.to, to: n.to, end: n.end, label: n.label, icon: n.icon })))
      })
    return () => { alive = false }
  }, [user?.roleCode])

  // 화면을 옮기면 모바일 메뉴는 닫는다.
  useEffect(() => { setMenuOpen(false) }, [pathname])

  return (
    <div className="tenant-shell">
      <header className="m-topbar">
        <div className="m-topbar-inner">
          <div className="m-topbar-left">
            <button type="button" className="m-hamburger" aria-label="메뉴" onClick={() => setMenuOpen((v) => !v)}>
              <Icon name={menuOpen ? 'close' : 'menu'} />
            </button>
            <Link to="/admin/orders" className="m-logo m-logo-link" title="주문 관리로 이동">EXPRISM</Link>
            <nav className="m-nav">
              {items.map((n) => <NavLink key={n.id} to={n.to} end={n.end} className={navClass}>{n.label}</NavLink>)}
            </nav>
          </div>
          <div className="m-topbar-right">
            <button type="button" className="m-icon-btn" title="알림"><Icon name="notifications" /></button>
            <span className="m-divider" />
            <span className="m-user">
              {user?.email}
              {user?.roleCode && <span className="m-user-role"> · {ROLE_LABEL[user.roleCode] || user.roleCode}</span>}
            </span>
            <button type="button" className="m-btn-outline" onClick={logout}>로그아웃</button>
          </div>
        </div>
      </header>

      {/* 모바일 드로어 네비 */}
      <div className={`m-mnav-backdrop${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} />
      <nav className={`m-mnav${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <div className="m-mnav-user">
          <Icon name="storefront" />
          <span>{user?.email}{user?.roleCode && ` · ${ROLE_LABEL[user.roleCode] || user.roleCode}`}</span>
        </div>
        {items.map((n) => (
          <NavLink key={n.id} to={n.to} end={n.end} className={mnavClass}>
            <Icon name={n.icon} /> {n.label}
          </NavLink>
        ))}
        <button type="button" className="m-mnav-logout" onClick={logout}><Icon name="logout" /> 로그아웃</button>
      </nav>

      <main className="m-main">{children}</main>

      <footer className="m-footer">
        <div className="m-footer-inner">
          <div className="m-footer-brand">
            <span className="m-logo faded">EXPRISM</span>
            <span className="m-copy">© 2026 EXPRISM Table Management. All rights reserved.</span>
          </div>
          <div className="m-footer-links">
            <a href="#">이용약관</a>
            <a href="#">개인정보처리방침</a>
            <a href="#">고객센터</a>
          </div>
        </div>
      </footer>

      <NoticePopupHost />
    </div>
  )
}
