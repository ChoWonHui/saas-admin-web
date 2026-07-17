import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { flattenMenus, useMenus } from './components/useMenus'
import AdminsPage from './pages/AdminsPage'
import CalendarPage from './pages/CalendarPage'
import CodesPage from './pages/CodesPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import MenusPage from './pages/MenusPage'
import NotFoundPage from './pages/NotFoundPage'
import NoticesPage from './pages/NoticesPage'
import PasswordChangePage from './pages/PasswordChangePage'
import PermissionsPage from './pages/PermissionsPage'
import TenantsPage from './pages/TenantsPage'

// 대시보드는 권한과 무관하게 항상 접근 가능하다 — 권한 없는 URL 에서 튕겨 갈 곳이다.
const ALWAYS_ALLOWED = ['/dashboard']

function RequireAuth({ children }) {
  const { user, loading, isSuper, allowedMenuIds, flashDeny } = useAuth()
  const menus = useMenus()
  const { pathname } = useLocation()

  // 이 경로에 해당하는 메뉴가 있고, 그 메뉴에 접근 권한이 없으면 막는다.
  const gate = flattenMenus(menus).find((m) => m.url === pathname)
  const permsPending = allowedMenuIds === null // 아직 권한을 못 받았으면 강제하지 않는다
  const denied =
    !!user &&
    !user.mustChangePassword &&
    !isSuper &&
    !permsPending &&
    !!gate &&
    !ALWAYS_ALLOWED.includes(pathname) &&
    !allowedMenuIds.has(gate.id)

  useEffect(() => {
    if (denied) flashDeny(`권한이 존재하지 않습니다. (${pathname})`)
  }, [denied, pathname, flashDeny])

  if (loading) return <div className="boot">확인 중…</div>
  if (!user) return <Navigate to="/login" replace />
  // 기본 비밀번호 상태면 어느 화면으로 가려 하든 비밀번호 변경으로 보낸다.
  // (서버도 이 토큰의 다른 API 호출을 403 으로 막으므로, 화면만의 방어가 아니다)
  if (user.mustChangePassword) return <Navigate to="/password" replace />
  // 권한 없는 화면 → 대시보드로 강제 이동 (안내는 flashDeny 가 토스트로 띄운다)
  if (denied) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/password" element={<PasswordChangePage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/codes"
            element={
              <RequireAuth>
                <CodesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/menus"
            element={
              <RequireAuth>
                <MenusPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admins"
            element={
              <RequireAuth>
                <AdminsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/tenants"
            element={
              <RequireAuth>
                <TenantsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/permissions"
            element={
              <RequireAuth>
                <PermissionsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/calendar"
            element={
              <RequireAuth>
                <CalendarPage />
              </RequireAuth>
            }
          />
          <Route
            path="/notices"
            element={
              <RequireAuth>
                <NoticesPage />
              </RequireAuth>
            }
          />
          {/* 루트만 홈(대시보드)으로 보내고, 그 외 없는 주소는 NotFound 가 처리한다:
              로그인 전 → 로그인으로 / 로그인 후 → 안내하고 대시보드로 */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
