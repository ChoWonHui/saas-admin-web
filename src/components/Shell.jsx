import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/** 로그인 후 모든 화면이 공유하는 껍데기 — 상단바 + 내비게이션. */
export default function Shell({ children }) {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <span className="wordmark">EXPRISM</span>
            <span className="brand-sub">Admin</span>
          </div>
          <nav className="nav">
            <NavLink to="/admins" className={({ isActive }) => (isActive ? 'nav-on' : '')}>
              관리자
            </NavLink>
            <NavLink to="/tenants" className={({ isActive }) => (isActive ? 'nav-on' : '')}>
              업체
            </NavLink>
          </nav>
        </div>
        <div className="topbar-right">
          <span className="who">
            {user?.empNo} · {user?.email ?? '내부 직원'}
          </span>
          <button className="btn-ghost" onClick={logout}>
            로그아웃
          </button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}
