import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AdminsPage from './pages/AdminsPage'
import LoginPage from './pages/LoginPage'
import PasswordChangePage from './pages/PasswordChangePage'
import TenantsPage from './pages/TenantsPage'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="boot">확인 중…</div>
  if (!user) return <Navigate to="/login" replace />
  // 기본 비밀번호 상태면 어느 화면으로 가려 하든 비밀번호 변경으로 보낸다.
  // (서버도 이 토큰의 다른 API 호출을 403 으로 막으므로, 화면만의 방어가 아니다)
  if (user.mustChangePassword) return <Navigate to="/password" replace />
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
          <Route path="*" element={<Navigate to="/admins" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
