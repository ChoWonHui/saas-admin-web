import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ADMIN_BASE, adminPath, stripBase } from './adminBase'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { TenantAuthProvider, useTenantAuth } from './auth/TenantAuthContext'
import { flattenMenus, useMenus } from './components/useMenus'
import AdminsPage from './pages/AdminsPage'
import CalendarPage from './pages/CalendarPage'
import CodesPage from './pages/CodesPage'
import DecorateCatalogPage from './pages/DecorateCatalogPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import MenusPage from './pages/MenusPage'
import TenantConsoleMenuPage from './pages/TenantConsoleMenuPage'
import NotFoundPage from './pages/NotFoundPage'
import NoticesPage from './pages/NoticesPage'
import PasswordChangePage from './pages/PasswordChangePage'
import PermissionsPage from './pages/PermissionsPage'
import TenantsPage from './pages/TenantsPage'
import InquiriesPage from './pages/InquiriesPage'
import TenantNoticesPage from './pages/TenantNoticesPage'
import TenantNoticeBoardPage from './pages/tenant/TenantNoticeBoardPage'
import TenantLoginPage from './pages/tenant/TenantLoginPage'
import TenantHomePage from './pages/tenant/TenantHomePage'
import TenantInquiriesPage from './pages/tenant/TenantInquiriesPage'
import TenantTablesPage from './pages/tenant/TenantTablesPage'
import TenantMenuPage from './pages/tenant/TenantMenuPage'
import TenantOrdersPage from './pages/tenant/TenantOrdersPage'
import TenantWaitlistPage from './pages/tenant/TenantWaitlistPage'
import TenantStatsPage from './pages/tenant/TenantStatsPage'
import TenantStaffPage from './pages/tenant/TenantStaffPage'

// 대시보드는 권한과 무관하게 항상 접근 가능하다 — 권한 없는 URL 에서 튕겨 갈 곳이다.
const ALWAYS_ALLOWED = ['/dashboard']

function RequireAuth({ children }) {
  const { user, loading, isSuper, allowedMenuIds, flashDeny } = useAuth()
  const menus = useMenus()
  const { pathname } = useLocation()
  // 메뉴 url 은 접두 경로 없는 논리 경로(/dashboard)로 저장돼 있으므로, 매칭 전 접두 경로를 뗀다.
  const logical = stripBase(pathname)

  // 이 경로에 해당하는 메뉴가 있고, 그 메뉴에 접근 권한이 없으면 막는다.
  const gate = flattenMenus(menus).find((m) => m.url === logical)
  const permsPending = allowedMenuIds === null // 아직 권한을 못 받았으면 강제하지 않는다
  const denied =
    !!user &&
    !user.mustChangePassword &&
    !isSuper &&
    !permsPending &&
    !!gate &&
    !ALWAYS_ALLOWED.includes(logical) &&
    !allowedMenuIds.has(gate.id)

  useEffect(() => {
    if (denied) flashDeny(`권한이 존재하지 않습니다. (${logical})`)
  }, [denied, logical, flashDeny])

  if (loading) return <div className="boot">확인 중…</div>
  if (!user) return <Navigate to={adminPath('/login')} replace />
  // 기본 비밀번호 상태면 어느 화면으로 가려 하든 비밀번호 변경으로 보낸다.
  // (서버도 이 토큰의 다른 API 호출을 403 으로 막으므로, 화면만의 방어가 아니다)
  if (user.mustChangePassword) return <Navigate to={adminPath('/password')} replace />
  // 권한 없는 화면 → 대시보드로 강제 이동 (안내는 flashDeny 가 토스트로 띄운다)
  if (denied) return <Navigate to={adminPath('/dashboard')} replace />
  return children
}

// 루트(/) — 로그인한 관리자만 콘솔 대시보드로 보내고, 그 외엔 접두 경로를 드러내지 않는 담백한 404.
function RootLanding() {
  const { user, loading } = useAuth()
  if (loading) return <div className="boot">확인 중…</div>
  return user ? <Navigate to={adminPath('/dashboard')} replace /> : <NotFoundPage />
}

// 업체(tenant) 사용자 전용 가드. 내부 관리자 가드(RequireAuth)와 완전히 별개다.
function RequireTenantAuth({ children }) {
  const { user, loading } = useTenantAuth()
  if (loading) return <div className="boot">확인 중…</div>
  if (!user) return <Navigate to="/admin/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
       <TenantAuthProvider>
        <Routes>
          {/* 업체 사용자 콘솔 (/admin/*) — 업체코드 + 아이디 + 비밀번호 로그인.
              /admin/login/:code 로 들어오면 업체코드가 자동으로 채워진다(가게 전용 링크·QR). */}
          <Route path="/admin/login" element={<TenantLoginPage />} />
          <Route path="/admin/login/:code" element={<TenantLoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireTenantAuth>
                <TenantHomePage />
              </RequireTenantAuth>
            }
          />
          <Route
            path="/admin/tables"
            element={
              <RequireTenantAuth>
                <TenantTablesPage />
              </RequireTenantAuth>
            }
          />
          <Route
            path="/admin/menu"
            element={
              <RequireTenantAuth>
                <TenantMenuPage />
              </RequireTenantAuth>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <RequireTenantAuth>
                <TenantOrdersPage />
              </RequireTenantAuth>
            }
          />
          <Route
            path="/admin/waitlist"
            element={
              <RequireTenantAuth>
                <TenantWaitlistPage />
              </RequireTenantAuth>
            }
          />
          <Route
            path="/admin/stats"
            element={
              <RequireTenantAuth>
                <TenantStatsPage />
              </RequireTenantAuth>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <RequireTenantAuth>
                <TenantStaffPage />
              </RequireTenantAuth>
            }
          />
          <Route
            path="/admin/notices"
            element={
              <RequireTenantAuth>
                <TenantNoticeBoardPage />
              </RequireTenantAuth>
            }
          />
          <Route
            path="/admin/inquiries"
            element={
              <RequireTenantAuth>
                <TenantInquiriesPage />
              </RequireTenantAuth>
            }
          />
          {/* 시스템(플랫폼) 관리자 콘솔 — 접두 경로(ADMIN_BASE) 아래로 모아 루트 노출을 줄인다.
              내부 링크·권한 게이트는 접두 경로를 자동으로 붙이고 뗀다. */}
          <Route path={ADMIN_BASE}>
            <Route path="login" element={<LoginPage />} />
            <Route path="password" element={<PasswordChangePage />} />
            <Route path="dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
            <Route path="codes" element={<RequireAuth><CodesPage /></RequireAuth>} />
            <Route path="decorate-catalog" element={<RequireAuth><DecorateCatalogPage /></RequireAuth>} />
            <Route path="menus" element={<RequireAuth><MenusPage /></RequireAuth>} />
            <Route path="tenant-menus" element={<RequireAuth><TenantConsoleMenuPage /></RequireAuth>} />
            <Route path="admins" element={<RequireAuth><AdminsPage /></RequireAuth>} />
            <Route path="tenants" element={<RequireAuth><TenantsPage /></RequireAuth>} />
            <Route path="permissions" element={<RequireAuth><PermissionsPage /></RequireAuth>} />
            <Route path="calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
            <Route path="notices" element={<RequireAuth><NoticesPage /></RequireAuth>} />
            <Route path="inquiries" element={<RequireAuth><InquiriesPage /></RequireAuth>} />
            <Route path="tenant-notices" element={<RequireAuth><TenantNoticesPage /></RequireAuth>} />
            {/* 접두 경로만 입력하면 대시보드로. 접두 경로 하위 미존재 주소는 NotFound. */}
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          {/* 루트/기타 주소: 인증된 관리자만 콘솔로, 그 외엔 담백한 404(접두 경로 비노출). */}
          <Route path="/" element={<RootLanding />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
       </TenantAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
