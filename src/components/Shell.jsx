import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { adminPath } from '../adminBase'
import { useAuth } from '../auth/AuthContext'
import { useMenus } from './useMenus'
import AdminNotiBell from './AdminNotiBell'

// 메뉴 API 가 죽어도 콘솔은 다녀야 한다. 그때만 쓰는 최소한의 기본 메뉴.
const FALLBACK_MENUS = [
  { id: 'f1', name: '대시보드', url: '/dashboard', children: [] },
  { id: 'f2', name: '관리자', url: '/admins', children: [] },
  { id: 'f3', name: '업체', url: '/tenants', children: [] },
]

/** 내부 경로는 NavLink(활성 표시), 외부 주소는 새 탭으로 여는 일반 링크. */
function MenuLink({ item, onNavigate }) {
  if (item.url && !item.url.startsWith('/')) {
    return (
      <a href={item.url} target="_blank" rel="noreferrer" onClick={onNavigate}>
        {item.name}
      </a>
    )
  }
  // 메뉴 url 은 논리 경로(/dashboard)로 저장 → 시스템 관리자 접두 경로를 붙여 이동한다.
  return (
    <NavLink
      to={item.url ? adminPath(item.url) : '#'}
      className={({ isActive }) => (isActive ? 'nav-on' : '')}
      onClick={onNavigate}
    >
      {item.name}
    </NavLink>
  )
}

/** 접근 권한이 있는 메뉴만 남긴다. 슈퍼는 전부. 빈 묶음(하위가 다 걸러진 상위)은 제거. */
function filterAllowed(items, isSuper, allowedMenuIds) {
  if (isSuper || allowedMenuIds === null) return items // 슈퍼거나 아직 로딩 중이면 그대로
  const walk = (nodes) =>
    nodes
      .map((n) => ({ ...n, children: n.children ? walk(n.children) : [] }))
      .filter((n) => allowedMenuIds.has(n.id) || (n.children && n.children.length > 0))
  return walk(items)
}

/** 로그인 후 모든 화면이 공유하는 껍데기 — 상단바 + 내비게이션(DB 메뉴). */
export default function Shell({ children }) {
  const { user, logout, isSuper, allowedMenuIds, denyNotice } = useAuth()
  const menus = useMenus()
  const location = useLocation()
  const baseItems = menus.length ? menus : FALLBACK_MENUS
  const items = filterAllowed(baseItems, isSuper, allowedMenuIds)

  // 좁은 화면용 햄버거 메뉴. 화면을 이동하면 자동으로 닫힌다.
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // 드로어의 트리 접기/펴기. 지금 보고 있는 화면이 속한 묶음은 자동으로 펴 준다.
  const [openGroups, setOpenGroups] = useState(() => new Set())
  useEffect(() => {
    const active = items.find((item) => item.children?.some((child) => child.url === location.pathname))
    if (active) {
      setOpenGroups((prev) => (prev.has(active.id) ? prev : new Set(prev).add(active.id)))
    }
  }, [location.pathname, items])

  function toggleGroup(id) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 열려 있을 때 Esc 로 닫고, 뒤 화면 스크롤을 잠근다.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <div className="app-shell">
      {/* 권한 없는 URL 로 접근해 튕겼을 때 뜨는 안내 */}
      {denyNotice && <div className="deny-toast" role="alert">{denyNotice}</div>}
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="hamburger"
            aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
          {/* 로고 클릭 → 대시보드로 */}
          <Link to={adminPath('/dashboard')} className="brand" aria-label="대시보드로 이동">
            <span className="wordmark">EXPRISM</span>
            <span className="brand-sub">Admin</span>
          </Link>
          <nav className="nav">
            {items.map((item) =>
              item.children?.length ? (
                // 하위가 있으면 드롭다운. 상위에 URL 이 없으면 제목 역할만 한다.
                <div key={item.id} className="nav-group">
                  {item.url ? (
                    <MenuLink item={item} />
                  ) : (
                    <span className="nav-parent">{item.name} ▾</span>
                  )}
                  <div className="nav-dropdown">
                    {item.children.map((child) => (
                      <MenuLink key={child.id} item={child} />
                    ))}
                  </div>
                </div>
              ) : (
                <MenuLink key={item.id} item={item} />
              ),
            )}
          </nav>
        </div>
        <div className="topbar-right">
          <AdminNotiBell />
          <span className="who">
            {user?.name}({user?.empNo})
          </span>
          <button className="btn-ghost" onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>

      {/* 좁은 화면: 햄버거로 여는 좌측 드로어.
          항상 마운트해 두고 클래스로만 열고 닫는다 — 그래야 슬라이드 트랜지션이 걸린다. */}
      <div
        className={`drawer-backdrop${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />
      <nav className={`mobile-nav${mobileOpen ? ' open' : ''}`} aria-hidden={!mobileOpen}>
        <div className="mobile-head">
          <span className="wordmark">EXPRISM</span>
          <span className="mobile-user">
            {user?.name}({user?.empNo})
          </span>
        </div>
        {items.map((item) => {
          // 하위가 없는 최상위: 화살표 자리만 비워 두고 같은 굵기로 나란히
          if (!item.children?.length) {
            return (
              <div key={item.id} className="mobile-top">
                <span className="chev-slot" />
                <MenuLink item={item} onNavigate={() => setMobileOpen(false)} />
              </div>
            )
          }
          const opened = openGroups.has(item.id)
          return (
            <div key={item.id} className="mobile-group">
              {/* 상위 메뉴: 굵은 글씨 + 화살표. 누르면 하위가 접혔다 펴진다. */}
              <button
                type="button"
                className="mobile-top mobile-parent"
                aria-expanded={opened}
                onClick={() => toggleGroup(item.id)}
              >
                <span className={`chev${opened ? ' open' : ''}`}>▸</span>
                {item.name}
              </button>
              <div className={`tree-children${opened ? ' open' : ''}`}>
                <div className="tree-inner">
                  {item.url && (
                    <div className="mobile-child">
                      <MenuLink item={{ ...item, name: `${item.name} 홈` }} onNavigate={() => setMobileOpen(false)} />
                    </div>
                  )}
                  {item.children.map((child) => (
                    <div key={child.id} className="mobile-child">
                      <MenuLink item={child} onNavigate={() => setMobileOpen(false)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      <main className="content">{children}</main>
    </div>
  )
}
