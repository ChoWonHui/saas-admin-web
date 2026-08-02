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

// 사장님 콘솔 메뉴 정책(전역) — 모든 업체가 공유. 역할(대표/홀/주방)별 노출.
export const tenantMenuPolicyApi = {
  list: () => api('/api/platform-admin/tenant-menus'),
  add: (body) => api('/api/platform-admin/tenant-menus', { method: 'POST', body }),
  update: (menuId, body) => api(`/api/platform-admin/tenant-menus/${menuId}`, { method: 'PATCH', body }),
  remove: (menuId) => api(`/api/platform-admin/tenant-menus/${menuId}`, { method: 'DELETE' }),
  reorder: (orderedIds) => api('/api/platform-admin/tenant-menus/reorder', { method: 'POST', body: { orderedIds } }),
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

// 가게 꾸미기(store decorate) 카탈로그. 대분류(고정) → 소분류(분류) → 항목. 모든 업체 에디터가 공유.
export const decorateApi = {
  catalog: () => api('/api/platform-admin/decorate/categories'),
  createCategory: (body) => api('/api/platform-admin/decorate/categories', { method: 'POST', body }),
  updateCategory: (id, body) => api(`/api/platform-admin/decorate/categories/${id}`, { method: 'PATCH', body }),
  removeCategory: (id) => api(`/api/platform-admin/decorate/categories/${id}`, { method: 'DELETE' }),
  createItem: (categoryId, body) => api(`/api/platform-admin/decorate/categories/${categoryId}/items`, { method: 'POST', body }),
  updateItem: (id, body) => api(`/api/platform-admin/decorate/items/${id}`, { method: 'PATCH', body }),
  removeItem: (id) => api(`/api/platform-admin/decorate/items/${id}`, { method: 'DELETE' }),
  // 머리·모자 그림 업로드(DB 저장, S3 불필요). 성공 시 { url }. 멀티파트라 api() 대신 직접 fetch.
  async uploadImage(file) {
    const form = new FormData()
    form.append('file', file)
    const doSend = () =>
      fetch('/api/platform-admin/decorate/images', {
        method: 'POST',
        headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
        body: form,
      })
    let res = await doSend()
    if (res.status === 401 && tokenStore.refresh) { if (await refreshAccessToken()) res = await doSend() }
    if (!res.ok) { if (res.status === 401) tokenStore.clear(); throw new ApiError(res.status, await parse(res)) }
    return res.json()
  },
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

// 플랫폼(본사) 광고 배너 — 전 매장 손님 화면 하단 공통 노출.
export const adApi = {
  get: () => api('/api/platform-admin/ad'),
  save: (body) => api('/api/platform-admin/ad', { method: 'PUT', body }),
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
  // 이미지 검색(Pixabay). [{ thumb, url }]
  searchImages: (q, page = 1) =>
    api(`/api/platform-admin/image-search?${new URLSearchParams({ q, page })}`),
  // 검색으로 고른 외부 이미지 URL 을 S3 에 저장 → { url }
  saveFromUrl: (url) => api('/api/platform-admin/files/from-url', { method: 'POST', body: { url } }),
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

// 업체 문의 관리(관리자). 전체 업체의 문의를 보고 답변한다.
export const inquiryApi = {
  list: (status = 'ALL') => api(`/api/platform-admin/inquiries?status=${encodeURIComponent(status)}`),
  get: (id) => api(`/api/platform-admin/inquiries/${id}`),
  reply: (id, body) => api(`/api/platform-admin/inquiries/${id}/replies`, { method: 'POST', body }),
  close: (id) => api(`/api/platform-admin/inquiries/${id}/close`, { method: 'POST' }),
  remove: (id) => api(`/api/platform-admin/inquiries/${id}`, { method: 'DELETE' }),
  // 업체별 대화(채팅)
  tenantConvs: () => api('/api/platform-admin/inquiries/tenants'),
  tenantConv: (tenantId) => api(`/api/platform-admin/inquiries/tenants/${tenantId}`),
  sendToTenant: (tenantId, body) => api(`/api/platform-admin/inquiries/tenants/${tenantId}/messages`, { method: 'POST', body }),
  // 답변 이미지 업로드는 기존 관리자 업로드 엔드포인트(fileApi.uploadImage)를 그대로 쓴다.
}

// 업체 공지사항(관리자 등록/관리). 상단 고정 + 팝업(기간). 본문은 에디터 HTML.
export const tenantNoticeApi = {
  list: ({ keyword = '', page = 0, size = 10 } = {}) =>
    api(`/api/platform-admin/tenant-notices?${new URLSearchParams({ keyword, page, size })}`),
  get: (id) => api(`/api/platform-admin/tenant-notices/${id}`),
  create: (body) => api('/api/platform-admin/tenant-notices', { method: 'POST', body }),
  update: (id, body) => api(`/api/platform-admin/tenant-notices/${id}`, { method: 'PATCH', body }),
  remove: (id) => api(`/api/platform-admin/tenant-notices/${id}`, { method: 'DELETE' }),
}

// 업체(테넌트) 관리. 목록은 Spring Page( { content, totalElements, ... } ).
// 삭제는 소프트삭제(삭제여부='Y') — 기본 목록에서 숨겨지고 복구할 수 있다.
// 지점 메뉴판. 모든 응답은 갱신된 전체 메뉴 트리({ categories })다.
// (관리자 콘솔 메뉴용 menuApi 와 다른, 업체 지점 메뉴판 API)
export const tenantMenuApi = {
  base: (tid, bid) => `/api/platform-admin/tenants/${tid}/branches/${bid}/menu`,
  get: (tid, bid) => api(tenantMenuApi.base(tid, bid)),
  addCategory: (tid, bid, name) => api(`${tenantMenuApi.base(tid, bid)}/categories`, { method: 'POST', body: { name } }),
  renameCategory: (tid, bid, cid, name) =>
    api(`${tenantMenuApi.base(tid, bid)}/categories/${cid}`, { method: 'PATCH', body: { name } }),
  deleteCategory: (tid, bid, cid) => api(`${tenantMenuApi.base(tid, bid)}/categories/${cid}`, { method: 'DELETE' }),
  addItem: (tid, bid, cid, body) => api(`${tenantMenuApi.base(tid, bid)}/categories/${cid}/items`, { method: 'POST', body }),
  updateItem: (tid, bid, iid, body) => api(`${tenantMenuApi.base(tid, bid)}/items/${iid}`, { method: 'PATCH', body }),
  deleteItem: (tid, bid, iid) => api(`${tenantMenuApi.base(tid, bid)}/items/${iid}`, { method: 'DELETE' }),
  copy: (tid, bid, fromBranchId) => api(`${tenantMenuApi.base(tid, bid)}/copy`, { method: 'POST', body: { fromBranchId } }),
}

// 업체 직원(로그인 계정). 역할 2=대표 3=매니저 4=직원.
export const staffApi = {
  base: (tid) => `/api/platform-admin/tenants/${tid}/staff`,
  list: (tid) => api(staffApi.base(tid)),
  create: (tid, body) => api(staffApi.base(tid), { method: 'POST', body }),
  update: (tid, staffId, body) => api(`${staffApi.base(tid)}/${staffId}`, { method: 'PATCH', body }),
  resetPassword: (tid, staffId, newPassword) =>
    api(`${staffApi.base(tid)}/${staffId}/password`, { method: 'POST', body: { newPassword } }),
  remove: (tid, staffId) => api(`${staffApi.base(tid)}/${staffId}`, { method: 'DELETE' }),
  emailAvailable: (tid, email) =>
    api(`${staffApi.base(tid)}/email-available?email=${encodeURIComponent(email)}`),
}

export const tenantApi = {
  list: ({ status, includeDeleted = false, page = 0, size = 20 } = {}) => {
    const params = new URLSearchParams({ page, size, includeDeleted })
    if (status) params.set('status', status)
    return api(`/api/platform-admin/tenants?${params}`)
  },
  get: (id) => api(`/api/platform-admin/tenants/${id}`),
  plans: () => api('/api/platform-admin/tenants/plans'),
  // 업체별 주문 조회(읽기 전용). status 는 CSV(예: RECEIVED,COOKING). 비우면 전체.
  // 날짜별 페이징 주문 목록 → { content, date, page, size, totalElements, totalPages }
  orders: (id, status = '', date = '', page = 0, size = 20) =>
    api(`/api/platform-admin/tenants/${id}/orders?${status ? `status=${encodeURIComponent(status)}&` : ''}${date ? `date=${date}&` : ''}page=${page}&size=${size}`),
  // 업체별 가게 꾸미기(store decorate) 조회(읽기 전용). 미표시 상태여도 반환.
  home: (id) => api(`/api/platform-admin/tenants/${id}/home`),
  // 업체별 대기(예약) 관리 — 확인·발급·호출·착석·취소.
  waitlist: (id) => api(`/api/platform-admin/tenants/${id}/waitlist`),
  waitlistAdd: (id, body) => api(`/api/platform-admin/tenants/${id}/waitlist`, { method: 'POST', body }),
  waitlistStatus: (id, entryId, status) => api(`/api/platform-admin/tenants/${id}/waitlist/${entryId}/status`, { method: 'PATCH', body: { status } }),
  waitlistCancel: (id, entryId) => api(`/api/platform-admin/tenants/${id}/waitlist/${entryId}`, { method: 'DELETE' }),
  // 업체별 매출 통계(결제 주문 기간별) + 결제 취소.
  stats: (id, from, to) => api(`/api/platform-admin/tenants/${id}/stats?from=${from}&to=${to}`),
  statsCancel: (id, orderId) => api(`/api/platform-admin/tenants/${id}/stats/payments/${orderId}/cancel`, { method: 'POST' }),
  // 업체별 메뉴 품절 관리 — 주문관리 화면에서. 손님 메뉴판 즉시 반영.
  menu: (id) => api(`/api/platform-admin/tenants/${id}/menu`),
  menuSoldOut: (id, itemId, soldOut) => api(`/api/platform-admin/tenants/${id}/menu/items/${itemId}/soldout`, { method: 'PATCH', body: { soldOut } }),
  // 업체 정보만 등록(대표 계정 없이).
  create: (body) => api('/api/platform-admin/tenants', { method: 'POST', body }),
  update: (id, body) => api(`/api/platform-admin/tenants/${id}`, { method: 'PATCH', body }),
  // 소프트 삭제 / 복구
  remove: (id) => api(`/api/platform-admin/tenants/${id}`, { method: 'DELETE' }),
  restore: (id) => api(`/api/platform-admin/tenants/${id}/restore`, { method: 'POST' }),
  // 상태 전이(개설/중지) — 기존 기능 유지.
  activate: (id) => api(`/api/platform-admin/tenants/${id}/activate`, { method: 'POST' }),
  suspend: (id, reason) => api(`/api/platform-admin/tenants/${id}/suspend`, { method: 'POST', body: { reason } }),
  // 지점(호점) — 한 업체 아래 1호점·2호점… 호점 번호는 서버가 자동 채번.
  branches: (id) => api(`/api/platform-admin/tenants/${id}/branches`),
  addBranch: (id, body) => api(`/api/platform-admin/tenants/${id}/branches`, { method: 'POST', body }),
  updateBranch: (id, branchId, body) =>
    api(`/api/platform-admin/tenants/${id}/branches/${branchId}`, { method: 'PATCH', body }),
  removeBranch: (id, branchId) =>
    api(`/api/platform-admin/tenants/${id}/branches/${branchId}`, { method: 'DELETE' }),
  // 영업장 테이블 배치 — { takeoutOnly, floorCount, tables:[{floorNo,label,seats,kind,x,y,width,height}] }
  layout: (id, branchId) => api(`/api/platform-admin/tenants/${id}/branches/${branchId}/layout`),
  saveLayout: (id, branchId, body) =>
    api(`/api/platform-admin/tenants/${id}/branches/${branchId}/layout`, { method: 'PUT', body }),
  // 테이블 주문 QR PNG. 이미지 엔드포인트도 인증이 필요해 <img> 로 직접 못 부른다 →
  // 토큰 붙여 fetch 후 blob → object URL 로 돌려준다. (다 쓰면 URL.revokeObjectURL 로 해제)
  async tableQr(id, branchId, tableId) {
    const send = () =>
      fetch(`/api/platform-admin/tenants/${id}/branches/${branchId}/tables/${tableId}/qr`, {
        headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
      })
    let res = await send()
    if (res.status === 401 && tokenStore.refresh) { if (await refreshAccessToken()) res = await send() }
    if (!res.ok) { if (res.status === 401) tokenStore.clear(); throw new ApiError(res.status, await parse(res)) }
    return URL.createObjectURL(await res.blob())
  },
  // 포장 전용 QR PNG → object URL. (가게 단위, 테이블 id 불필요)
  async takeoutQr(id, branchId) {
    const send = () =>
      fetch(`/api/platform-admin/tenants/${id}/branches/${branchId}/takeout-qr`, {
        headers: tokenStore.access ? { Authorization: `Bearer ${tokenStore.access}` } : {},
      })
    let res = await send()
    if (res.status === 401 && tokenStore.refresh) { if (await refreshAccessToken()) res = await send() }
    if (!res.ok) { if (res.status === 401) tokenStore.clear(); throw new ApiError(res.status, await parse(res)) }
    return URL.createObjectURL(await res.blob())
  },
}
