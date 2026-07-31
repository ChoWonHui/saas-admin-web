// 시스템(플랫폼) 관리자 콘솔의 접두 경로.
// 루트(/dashboard …) 노출을 줄이기 위해 이 경로 아래로 모은다. 업체 콘솔(/admin/*)과는 별개다.
// 여기 한 곳만 바꾸면 라우트·네비·리다이렉트·권한 게이트가 모두 따라간다.
export const ADMIN_BASE = '/console/9f7a3d81'

/** 접두 경로를 붙인 절대 경로. p 는 '/dashboard' 처럼 슬래시로 시작. */
export function adminPath(p = '') {
  return `${ADMIN_BASE}${p}`
}

/** 절대 pathname 에서 접두 경로를 떼어 논리 경로(/dashboard)로. 메뉴 url·권한 매칭에 쓴다. */
export function stripBase(pathname) {
  if (pathname === ADMIN_BASE) return '/'
  return pathname.startsWith(`${ADMIN_BASE}/`) ? pathname.slice(ADMIN_BASE.length) : pathname
}
