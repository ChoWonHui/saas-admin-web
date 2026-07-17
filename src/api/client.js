// 백엔드 호출 한 곳. 토큰 보관과 만료 시 자동 재발급을 여기서만 처리한다.
//
// 토큰은 localStorage 에 둔다. XSS 가 나면 토큰이 털린다는 뜻이므로,
// 화면에 외부 입력을 innerHTML 로 꽂는 코드를 절대 만들지 않는다. (React 기본 렌더링은 안전하다)

const ACCESS_KEY = 'saas.accessToken'
const REFRESH_KEY = 'saas.refreshToken'

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  save({ accessToken, refreshToken }) {
    localStorage.setItem(ACCESS_KEY, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

/** 백엔드 ErrorResponse( code / message / fieldErrors ) 를 그대로 담는다. */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `요청이 실패했습니다. (HTTP ${status})`)
    this.status = status
    this.code = body?.code
    this.fieldErrors = body?.fieldErrors
  }
}

async function parse(response) {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function send(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && tokenStore.access) headers['Authorization'] = `Bearer ${tokenStore.access}`

  return fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// 리프레시가 동시에 여러 번 날아가지 않도록 진행 중인 것을 공유한다.
let refreshing = null

async function refreshAccessToken() {
  if (!tokenStore.refresh) return false
  if (!refreshing) {
    refreshing = (async () => {
      const response = await send('/api/auth/admin/refresh', {
        method: 'POST',
        body: { refreshToken: tokenStore.refresh },
        auth: false,
      })
      if (!response.ok) {
        tokenStore.clear()
        return false
      }
      // 토큰 회전: 쓴 리프레시 토큰은 폐기되고 새 것이 함께 온다. 둘 다 저장해야 한다.
      tokenStore.save(await parse(response))
      return true
    })().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

/**
 * 401 이면 리프레시로 한 번 되살려 재시도한다. 그래도 401 이면 토큰을 비우고 던진다.
 * (호출부는 ApiError.status === 401 을 보고 로그인 화면으로 돌리면 된다)
 */
export async function api(path, options = {}) {
  let response = await send(path, options)

  if (response.status === 401 && options.auth !== false && tokenStore.refresh) {
    if (await refreshAccessToken()) {
      response = await send(path, options)
    }
  }

  if (!response.ok) {
    if (response.status === 401) tokenStore.clear()
    throw new ApiError(response.status, await parse(response))
  }
  return parse(response)
}

// 이 콘솔은 내부 직원(관리자) 전용이다. 관리자는 이메일이 아니라 사번으로 로그인한다.
// 업체 사용자용 /api/auth/login 은 식별자 체계가 달라 별도 엔드포인트로 분리돼 있다.
export const authApi = {
  login: (empNo, password) =>
    api('/api/auth/admin/login', { method: 'POST', body: { empNo, password }, auth: false }),
  me: () => api('/api/auth/admin/me'),
  // 내가 접근할 수 있는 메뉴 id 목록 (부서 허용 ∪ 직책 허용 + 부모 + 대시보드; 슈퍼는 전체).
  myMenus: () => api('/api/auth/admin/my-menus'),
  logout: () => api('/api/auth/admin/logout', { method: 'POST' }),
  // 본인 비밀번호 변경. 성공하면 서버가 모든 토큰을 폐기한다 → 다시 로그인해야 한다.
  changeMyPassword: (newPassword, confirmPassword) =>
    api('/api/auth/admin/password', { method: 'POST', body: { newPassword, confirmPassword } }),
}

// 메뉴 권한. 슈퍼관리자만. subjectType: 'ORG'(부서, key=조직 id) | 'TITLE'(직책, key=직책명).
export const permissionApi = {
  get: (subjectType, subjectKey) =>
    api(`/api/platform-admin/permissions?${new URLSearchParams({ subjectType, subjectKey })}`),
  put: (subjectType, subjectKey, menuIds) =>
    api('/api/platform-admin/permissions', { method: 'PUT', body: { subjectType, subjectKey, menuIds } }),
}

// 관리자를 가리키는 키는 사번이다. 경로에도 사번이 그대로 들어간다.
// (/admins/260002 — 접근 로그만 봐도 누구인지 읽힌다)
export const adminApi = {
  list: ({ includeDeleted = false, page = 0, size = 20 } = {}) =>
    api(`/api/platform-admin/admins?${new URLSearchParams({ includeDeleted, page, size })}`),
  // 사번은 서버가 채번한다. 요청에 담지 않는다.
  create: (body) => api('/api/platform-admin/admins', { method: 'POST', body }),
  update: (empNo, body) => api(`/api/platform-admin/admins/${empNo}`, { method: 'PATCH', body }),
  // 비밀번호를 기본값으로 초기화한다. 새 비밀번호를 보내지 않는다 — 서버가 정하고 응답으로 알려준다.
  resetPassword: (empNo) =>
    api(`/api/platform-admin/admins/${empNo}/password/reset`, { method: 'POST' }),
  remove: (empNo) => api(`/api/platform-admin/admins/${empNo}`, { method: 'DELETE' }),
}

// 콘솔 상단 메뉴. 트리(최상위 + children 2단)로 주고받는다.
export const menuApi = {
  tree: () => api('/api/platform-admin/menus'),
  create: (body) => api('/api/platform-admin/menus', { method: 'POST', body }),
  // PATCH 지만 name/url/parentId/sortOrder 를 보낸 값으로 전부 교체한다. (수정 창이 모든 항목을 보여준다)
  update: (id, body) => api(`/api/platform-admin/menus/${id}`, { method: 'PATCH', body }),
  // 드래그앤드랍 이동. position = 새 형제 목록(자신 제외)의 0 기반 위치.
  move: (id, body) => api(`/api/platform-admin/menus/${id}/move`, { method: 'POST', body }),
  remove: (id) => api(`/api/platform-admin/menus/${id}`, { method: 'DELETE' }),
}

// 공통코드. 그룹코드·코드값은 생성 후 불변 — 이름(라벨)만 바꾼다.
export const codeApi = {
  groups: () => api('/api/platform-admin/code-groups'),
  createGroup: (body) => api('/api/platform-admin/code-groups', { method: 'POST', body }),
  updateGroup: (groupCode, body) => api(`/api/platform-admin/code-groups/${groupCode}`, { method: 'PATCH', body }),
  removeGroup: (groupCode) => api(`/api/platform-admin/code-groups/${groupCode}`, { method: 'DELETE' }),
  createCode: (groupCode, body) => api(`/api/platform-admin/code-groups/${groupCode}/codes`, { method: 'POST', body }),
  updateCode: (id, body) => api(`/api/platform-admin/codes/${id}`, { method: 'PATCH', body }),
  // 드래그앤드랍 순서 변경. position = 같은 그룹 형제(자신 제외)에서의 0 기반 위치.
  moveCode: (id, position) => api(`/api/platform-admin/codes/${id}/move`, { method: 'POST', body: { position } }),
  removeCode: (id) => api(`/api/platform-admin/codes/${id}`, { method: 'DELETE' }),
}

// 조직 / 조직도. 관리자 화면 우측이 이걸 쓴다.
export const orgApi = {
  chart: () => api('/api/platform-admin/org-chart'),
  create: (body) => api('/api/platform-admin/orgs', { method: 'POST', body }),
  rename: (id, body) => api(`/api/platform-admin/orgs/${id}`, { method: 'PATCH', body }),
  move: (id, body) => api(`/api/platform-admin/orgs/${id}/move`, { method: 'POST', body }),
  // empNo 를 비우면 부서장 해제.
  assignLeader: (id, empNo) => api(`/api/platform-admin/orgs/${id}/leader`, { method: 'POST', body: { empNo } }),
  remove: (id) => api(`/api/platform-admin/orgs/${id}`, { method: 'DELETE' }),
  // orgId 를 null 로 보내면 미배치로 되돌린다.
  assignMember: (empNo, orgId) => api(`/api/platform-admin/admins/${empNo}/org`, { method: 'POST', body: { orgId } }),
}

// 달력 일정 + 내 달력 권한.
export const calendarApi = {
  events: (year, month) => api(`/api/platform-admin/calendar/events?${new URLSearchParams({ year, month })}`),
  holidays: (year, month) => api(`/api/platform-admin/calendar/holidays?${new URLSearchParams({ year, month })}`),
  myPerms: () => api('/api/platform-admin/calendar/my-perms'),
  create: (body) => api('/api/platform-admin/calendar/events', { method: 'POST', body }),
  update: (id, body) => api(`/api/platform-admin/calendar/events/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/api/platform-admin/calendar/events/${id}`, { method: 'DELETE' }),
}

// 달력 권한 관리 (슈퍼만). subjectType: 'DEPT' | 'DEPT_TITLE'.
export const calendarPermApi = {
  get: (subjectType, subjectKey) =>
    api(`/api/platform-admin/calendar/permissions?${new URLSearchParams({ subjectType, subjectKey })}`),
  put: (subjectType, subjectKey, permKeys) =>
    api('/api/platform-admin/calendar/permissions', { method: 'PUT', body: { subjectType, subjectKey, permKeys } }),
}

// 파일 업로드(공지 에디터 이미지). 멀티파트라 JSON api() 헬퍼를 쓰지 않고 직접 보낸다.
// 성공 시 { url }. 401 이면 리프레시로 한 번 되살려 재시도한다.
export const fileApi = {
  async uploadImage(file) {
    const form = new FormData()
    form.append('file', file)
    const doSend = () =>
      fetch('/api/platform-admin/files/images', {
        method: 'POST',
        // Content-Type 은 브라우저가 boundary 와 함께 자동으로 넣는다 — 직접 지정하지 않는다.
        headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
        body: form,
      })
    let response = await doSend()
    if (response.status === 401 && tokenStore.refresh) {
      if (await refreshAccessToken()) response = await doSend()
    }
    if (!response.ok) {
      if (response.status === 401) tokenStore.clear()
      throw new ApiError(response.status, await parse(response))
    }
    return parse(response) // { url }
  },
}

// 사내 공지사항. content 는 에디터 HTML.
export const noticeApi = {
  list: ({ keyword = '', page = 0, size = 10 } = {}) =>
    api(`/api/platform-admin/notices?${new URLSearchParams({ keyword, page, size })}`),
  get: (id) => api(`/api/platform-admin/notices/${id}`),
  create: (body) => api('/api/platform-admin/notices', { method: 'POST', body }),
  update: (id, body) => api(`/api/platform-admin/notices/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/api/platform-admin/notices/${id}`, { method: 'DELETE' }),
  // 좋아요 토글 → { liked, likeCount }
  toggleLike: (id) => api(`/api/platform-admin/notices/${id}/like`, { method: 'POST' }),
  // 좋아요한 사람 목록 → [{ empNo, name, department, likedAt }]
  likeUsers: (id) => api(`/api/platform-admin/notices/${id}/likes`),
  // 댓글
  comments: (id) => api(`/api/platform-admin/notices/${id}/comments`),
  addComment: (id, content) =>
    api(`/api/platform-admin/notices/${id}/comments`, { method: 'POST', body: { content } }),
  removeComment: (commentId) =>
    api(`/api/platform-admin/notices/comments/${commentId}`, { method: 'DELETE' }),
}

export const tenantApi = {
  // 이 엔드포인트는 배열이 아니라 Spring 의 Page 를 준다.
  // { content: [...], totalElements, totalPages, number, ... }
  list: ({ status, page = 0, size = 20 } = {}) => {
    const params = new URLSearchParams({ page, size })
    if (status) params.set('status', status)
    return api(`/api/platform-admin/tenants?${params}`)
  },
}
