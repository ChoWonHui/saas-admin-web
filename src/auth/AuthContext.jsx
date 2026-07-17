import { createContext, useContext, useEffect, useState } from 'react'
import { authApi, tokenStore } from '../api/client'
import { clearMenuCache } from '../components/useMenus'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // 새로고침 직후에는 토큰이 아직 유효한지 모른다. 확인이 끝나기 전에
  // 로그인 화면으로 튕겨 버리면 이미 로그인한 사용자가 매번 다시 로그인해야 한다.
  const [loading, setLoading] = useState(true)
  // 비밀번호 변경 후 로그인 화면에 띄울 안내. ("변경된 비밀번호로 로그인하세요")
  const [notice, setNotice] = useState('')

  // 접근 가능 메뉴 id 집합. null 이면 아직 안 불러온 상태(그 사이엔 라우트 가드를 강제하지 않는다).
  const [allowedMenuIds, setAllowedMenuIds] = useState(null)
  // 권한 없는 URL 로 들어와 튕겼을 때 잠깐 띄우는 안내.
  const [denyNotice, setDenyNotice] = useState('')

  async function loadMyMenus() {
    try {
      const ids = await authApi.myMenus()
      setAllowedMenuIds(new Set(ids))
    } catch {
      // 실패하면 제한을 걸지 않는다(빈 화면 방지). 다음 조회에서 다시 시도된다.
      setAllowedMenuIds(null)
    }
  }

  useEffect(() => {
    if (!tokenStore.access) {
      setLoading(false)
      return
    }
    authApi
      .me()
      .then(async (me) => {
        setUser(me)
        if (!me.mustChangePassword) await loadMyMenus()
      })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  async function login(empNo, password) {
    // 관리자 로그인 엔드포인트는 관리자 계정만 통과시킨다.
    const result = await authApi.login(empNo, password)
    tokenStore.save(result)
    setNotice('')

    const me = await authApi.me()
    setUser(me)
    if (!me.mustChangePassword) await loadMyMenus()
    // me.mustChangePassword 가 true 면 기본 비밀번호 상태다.
    // 이 토큰으로는 다른 API 를 쓸 수 없어서, 라우터가 비밀번호 변경 화면으로 보낸다.
    return me
  }

  /**
   * 본인 비밀번호 변경.
   * 서버가 모든 토큰을 폐기하므로 여기서도 로그아웃 상태로 되돌린다 —
   * 바로 들여보내지 않고 새 비밀번호로 다시 로그인하게 해서 기억을 굳힌다.
   */
  async function changePassword(newPassword, confirmPassword) {
    await authApi.changeMyPassword(newPassword, confirmPassword)
    tokenStore.clear()
    setUser(null)
    setAllowedMenuIds(null)
    setNotice('비밀번호가 변경되었습니다. 변경된 비밀번호로 로그인하세요.')
  }

  async function logout() {
    try {
      await authApi.logout() // 서버의 리프레시 토큰을 폐기한다
    } catch {
      // 이미 만료됐거나 서버가 못 받아도, 로컬 토큰은 어차피 지운다
    }
    tokenStore.clear()
    setUser(null)
    setAllowedMenuIds(null)
    setNotice('')
    clearMenuCache() // 다음 로그인 사용자에게 이전 메뉴 캐시를 보여주지 않는다
  }

  /** 권한 없는 화면으로 접근했을 때 잠깐 안내를 띄운다 (2.5초 후 사라짐). */
  function flashDeny(message) {
    setDenyNotice(message)
  }
  useEffect(() => {
    if (!denyNotice) return
    const t = setTimeout(() => setDenyNotice(''), 2500)
    return () => clearTimeout(t)
  }, [denyNotice])

  return (
    <AuthContext.Provider
      value={{
        user, loading, notice, setNotice, login, logout, changePassword,
        isSuper: !!user?.isSuper, allowedMenuIds, denyNotice, flashDeny,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 는 AuthProvider 안에서만 쓸 수 있다.')
  return context
}
