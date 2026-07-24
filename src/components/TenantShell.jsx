import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTenantAuth } from '../auth/TenantAuthContext'
import { tenantNoticeBoardApi } from '../api/tenantClient'
import Icon from './Icon'

const ROLE_LABEL = {
  TENANT_OWNER: '대표',
  TENANT_MANAGER: '매니저',
  TENANT_STAFF: '직원',
}

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
  const navClass = ({ isActive }) => `m-nav-link${isActive ? ' on' : ''}`

  return (
    <div className="tenant-shell">
      <header className="m-topbar">
        <div className="m-topbar-inner">
          <div className="m-topbar-left">
            <span className="m-logo">EXPRISM</span>
            <nav className="m-nav">
              <NavLink to="/admin" end className={navClass}>홈</NavLink>
              <NavLink to="/admin/tables" className={navClass}>테이블</NavLink>
              <NavLink to="/admin/menu" className={navClass}>메뉴판</NavLink>
              <NavLink to="/admin/notices" className={navClass}>공지사항</NavLink>
              <NavLink to="/admin/inquiries" className={navClass}>문의</NavLink>
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
