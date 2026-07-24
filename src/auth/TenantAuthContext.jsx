import { createContext, useContext, useEffect, useState } from 'react'
import { tenantAuthApi, tenantTokenStore } from '../api/tenantClient'

// 업체(tenant) 사용자 세션. 내부 관리자(AuthContext)와 완전히 분리돼 있다.
const TenantAuthContext = createContext(null)

export function TenantAuthProvider({ children }) {
  const [user, setUser] = useState(null) // /me 결과: { userId, email, tenantId, roleCode }
  const [loading, setLoading] = useState(true)

  // 새로고침 직후: 저장된 토큰이 아직 유효하고, '테넌트 컨텍스트'까지 있는 토큰인지 확인한다.
  useEffect(() => {
    if (!tenantTokenStore.access) {
      setLoading(false)
      return
    }
    tenantAuthApi
      .me()
      .then((me) => {
        // 업체를 아직 고르지 않은(테넌트 컨텍스트 없는) 토큰은 로그인 완료로 보지 않는다.
        if (me && me.tenantId != null) setUser(me)
        else tenantTokenStore.clear()
      })
      .catch(() => tenantTokenStore.clear())
      .finally(() => setLoading(false))
  }, [])

  /**
   * 업체 로그인 — 업체코드 + 아이디 + 비밀번호로 한 번에 로그인한다.
   * 업체코드가 가게를 특정하므로 별도 선택 단계 없이 바로 세션이 확정된다.
   */
  async function login(tenantCode, loginId, password) {
    const token = await tenantAuthApi.tenantLogin(tenantCode.trim(), loginId.trim(), password)
    tenantTokenStore.save(token)
    const me = await tenantAuthApi.me()
    setUser(me)
    return me
  }

  async function logout() {
    try {
      await tenantAuthApi.logout()
    } catch {
      // 이미 만료됐어도 로컬 토큰은 어차피 지운다
    }
    tenantTokenStore.clear()
    setUser(null)
  }

  return (
    <TenantAuthContext.Provider value={{ user, loading, login, lookup: tenantAuthApi.lookup, logout }}>
      {children}
    </TenantAuthContext.Provider>
  )
}

export function useTenantAuth() {
  const context = useContext(TenantAuthContext)
  if (!context) throw new Error('useTenantAuth 는 TenantAuthProvider 안에서만 쓸 수 있다.')
  return context
}
