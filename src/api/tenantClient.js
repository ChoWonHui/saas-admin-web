// 업체(tenant) 사용자용 백엔드 호출. 내부 관리자 콘솔(client.js)과 토큰을 분리한다.
// 같은 브라우저에서 관리자와 업체 사용자가 섞이지 않도록 저장 키를 다르게 둔다.
//
// 인증 흐름:
//   1) POST /api/auth/login          → accessToken(테넌트 컨텍스트 없음) + memberships[]
//   2) 소속이 여러 개면 하나를 고르고 POST /api/auth/select-tenant → 테넌트 토큰 재발급
//   3) 이후 모든 호출은 테넌트 토큰(tenantId + roleCode 포함)으로 나간다.

import { ApiError } from './client'

const ACCESS_KEY = 'saas.tenant.accessToken'
const REFRESH_KEY = 'saas.tenant.refreshToken'

export const tenantTokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  save({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
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
  if (auth && tenantTokenStore.access) headers['Authorization'] = `Bearer ${tenantTokenStore.access}`
  return fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

// 리프레시가 동시에 여러 번 날아가지 않게 진행 중인 것을 공유한다.
let refreshing = null

async function refreshAccessToken() {
  if (!tenantTokenStore.refresh) return false
  if (!refreshing) {
    refreshing = (async () => {
      const response = await send('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken: tenantTokenStore.refresh },
        auth: false,
      })
      if (!response.ok) {
        tenantTokenStore.clear()
        return false
      }
      // 토큰 회전: 쓴 리프레시 토큰은 폐기되고 새 것이 함께 온다. 둘 다 저장한다.
      tenantTokenStore.save(await parse(response))
      return true
    })().finally(() => {
      refreshing = null
    })
  }
  return refreshing
}

/** 401 이면 리프레시로 한 번 되살려 재시도한다. 그래도 401 이면 토큰을 비우고 던진다. */
export async function tenantApiCall(path, options = {}) {
  let response = await send(path, options)

  if (response.status === 401 && options.auth !== false && tenantTokenStore.refresh) {
    if (await refreshAccessToken()) {
      response = await send(path, options)
    }
  }

  if (!response.ok) {
    if (response.status === 401) tenantTokenStore.clear()
    throw new ApiError(response.status, await parse(response))
  }
  return parse(response)
}

// 업체 사용자 인증 엔드포인트. (내부 관리자 /api/auth/admin/* 과 별개)
export const tenantAuthApi = {
  // 업체코드 + 아이디 + 비밀번호 → 한 번에 테넌트 컨텍스트 토큰({ accessToken, refreshToken, tenantId, roleCode }).
  tenantLogin: (tenantCode, loginId, password) =>
    tenantApiCall('/api/auth/tenant-login', {
      method: 'POST',
      body: { tenantCode, loginId, password },
      auth: false,
    }),
  // 로그인 전, 업체코드로 가게 이름만 확인 → { found, name }.
  lookup: (code) =>
    tenantApiCall(`/api/auth/tenant-lookup?code=${encodeURIComponent(code)}`, { auth: false }),
  me: () => tenantApiCall('/api/auth/me'),
  logout: () => tenantApiCall('/api/auth/logout', { method: 'POST' }),
}

// 업체 테이블 관리. 업체코드(토큰)를 키로 자기 가게 테이블만 다룬다.
// 배치 편집기는 관리자 콘솔과 동일 — layout 조회/저장으로 오간다.
export const tenantTableApi = {
  layout: () => tenantApiCall('/api/tenant/tables/layout'),
  saveLayout: (body) => tenantApiCall('/api/tenant/tables/layout', { method: 'PUT', body }),
  list: () => tenantApiCall('/api/tenant/tables'),
  create: (body) => tenantApiCall('/api/tenant/tables', { method: 'POST', body }),
  remove: (tableId) => tenantApiCall(`/api/tenant/tables/${tableId}`, { method: 'DELETE' }),
  // QR PNG → object URL. 인증 헤더가 필요해 blob 으로 직접 받는다.
  qr: async (tableId) => {
    const run = () => fetch(`/api/tenant/tables/${tableId}/qr`, {
      headers: tenantTokenStore.access ? { Authorization: `Bearer ${tenantTokenStore.access}` } : {},
    })
    let res = await run()
    if (res.status === 401 && tenantTokenStore.refresh) {
      try { await tenantAuthApi.me() } catch { /* noop */ }
      res = await run()
    }
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
    return URL.createObjectURL(await res.blob())
  },
  // 포장 전용 QR PNG → object URL. (가게 단위, 테이블 id 불필요)
  takeoutQr: async () => {
    const run = () => fetch('/api/tenant/tables/takeout-qr', {
      headers: tenantTokenStore.access ? { Authorization: `Bearer ${tenantTokenStore.access}` } : {},
    })
    let res = await run()
    if (res.status === 401 && tenantTokenStore.refresh) {
      try { await tenantAuthApi.me() } catch { /* noop */ }
      res = await run()
    }
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
    return URL.createObjectURL(await res.blob())
  },
}

// 멀티파트 업로드(이미지). 401 이면 한 번 갱신 후 재시도.
async function uploadMultipart(path, file) {
  const form = new FormData()
  form.append('file', file)
  const run = () => fetch(path, {
    method: 'POST',
    headers: tenantTokenStore.access ? { Authorization: `Bearer ${tenantTokenStore.access}` } : {},
    body: form,
  })
  let res = await run()
  if (res.status === 401 && tenantTokenStore.refresh) {
    try { await tenantAuthApi.me() } catch { /* noop */ }
    res = await run()
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
  return res.json()
}

// 업체 메뉴판 — 관리자 메뉴 편집기와 같은 시그니처(tenantId·branchId 인자는 무시). /api/tenant/menu 로 감.
export const tenantMenuBoardApi = {
  get: () => tenantApiCall('/api/tenant/menu'),
  addCategory: (_t, _b, name) => tenantApiCall('/api/tenant/menu/categories', { method: 'POST', body: { name } }),
  renameCategory: (_t, _b, cid, name) => tenantApiCall(`/api/tenant/menu/categories/${cid}`, { method: 'PATCH', body: { name } }),
  deleteCategory: (_t, _b, cid) => tenantApiCall(`/api/tenant/menu/categories/${cid}`, { method: 'DELETE' }),
  addItem: (_t, _b, cid, body) => tenantApiCall(`/api/tenant/menu/categories/${cid}/items`, { method: 'POST', body }),
  updateItem: (_t, _b, iid, body) => tenantApiCall(`/api/tenant/menu/items/${iid}`, { method: 'PATCH', body }),
  deleteItem: (_t, _b, iid) => tenantApiCall(`/api/tenant/menu/items/${iid}`, { method: 'DELETE' }),
  // 주문관리 화면의 빠른 품절 토글 — 손님 메뉴판에 즉시 반영.
  setSoldOut: (iid, soldOut) => tenantApiCall(`/api/tenant/menu/items/${iid}/soldout`, { method: 'PATCH', body: { soldOut } }),
  // 업체는 지점이 하나라 다른 지점 복사는 쓰지 않지만, 시그니처는 맞춰 둔다.
  copy: (_t, _b, fromBranchId) => tenantApiCall('/api/tenant/menu/copy', { method: 'POST', body: { fromBranchId } }),
}

// 업체 이미지 — 업로드/검색/URL저장. 관리자 fileApi 와 같은 메서드 이름.
export const tenantImageApi = {
  uploadImage: (file) => uploadMultipart('/api/tenant/files/images', file),
  searchImages: (q, page = 1) =>
    tenantApiCall(`/api/tenant/files/image-search?${new URLSearchParams({ q, page })}`),
  saveFromUrl: (url) => tenantApiCall('/api/tenant/files/from-url', { method: 'POST', body: { url } }),
}

// 가게 메인 페이지(홈) 편집 — 손님 QR 화면에 보일 소개/영업시간 등.
export const tenantHomeApi = {
  get: () => tenantApiCall('/api/tenant/home'),
  save: (body) => tenantApiCall('/api/tenant/home', { method: 'PUT', body }),
}

// 업체 직원 관리 — 대표(사장님)만. 로그인은 업체코드+아이디+비번.
export const tenantStaffApi = {
  list: () => tenantApiCall('/api/tenant/staff'),
  create: (body) => tenantApiCall('/api/tenant/staff', { method: 'POST', body }),
  update: (id, body) => tenantApiCall(`/api/tenant/staff/${id}`, { method: 'PATCH', body }),
  resetPassword: (id, newPassword) =>
    tenantApiCall(`/api/tenant/staff/${id}/password`, { method: 'POST', body: { newPassword } }),
  remove: (id) => tenantApiCall(`/api/tenant/staff/${id}`, { method: 'DELETE' }),
}

// 업체 주문 관리.
export const tenantOrderApi = {
  // 날짜별 페이징 목록 → { content, date, page, size, totalElements, totalPages }
  list: (status = 'ALL', date = '', page = 0, size = 20) =>
    tenantApiCall(`/api/tenant/orders?status=${encodeURIComponent(status)}${date ? `&date=${date}` : ''}&page=${page}&size=${size}`),
  // 진행 중(활성) 주문 — 테이블 현황판용
  active: () => tenantApiCall('/api/tenant/orders/active'),
  get: (id) => tenantApiCall(`/api/tenant/orders/${id}`),
  create: (body) => tenantApiCall('/api/tenant/orders', { method: 'POST', body }),
  changeStatus: (id, status) => tenantApiCall(`/api/tenant/orders/${id}/status`, { method: 'PATCH', body: { status } }),
}

// 업체 대기(예약) 관리 — 테이블 점유 현황 + 대기 순번 발급/호출/착석/취소.
export const tenantWaitlistApi = {
  board: () => tenantApiCall('/api/tenant/waitlist'),
  add: (body) => tenantApiCall('/api/tenant/waitlist', { method: 'POST', body }),
  changeStatus: (id, status) => tenantApiCall(`/api/tenant/waitlist/${id}/status`, { method: 'PATCH', body: { status } }),
  cancel: (id) => tenantApiCall(`/api/tenant/waitlist/${id}`, { method: 'DELETE' }),
}

// 콘솔 메뉴 — 로그인 역할(대표/홀/주방)이 볼 수 있는 상단 메뉴.
export const tenantMenuApi = {
  myMenus: () => tenantApiCall('/api/tenant/menus'),
}

// 매출 통계 — 결제된 주문 기간별 집계 + 결제 취소.
export const tenantStatsApi = {
  stats: (from, to) => tenantApiCall(`/api/tenant/stats?from=${from}&to=${to}`),
  cancelPayment: (orderId) => tenantApiCall(`/api/tenant/stats/payments/${orderId}/cancel`, { method: 'POST' }),
}

// 업체 공지사항(조회 전용) — 관리자가 등록한 공지 + 팝업 목록.
export const tenantNoticeBoardApi = {
  list: () => tenantApiCall('/api/tenant/notices'),
  get: (id) => tenantApiCall(`/api/tenant/notices/${id}`),
  popups: () => tenantApiCall('/api/tenant/notices/popups'),
}

// 업체 문의 게시판.
export const tenantInquiryApi = {
  list: () => tenantApiCall('/api/tenant/inquiries'),
  create: (body) => tenantApiCall('/api/tenant/inquiries', { method: 'POST', body }),
  get: (id) => tenantApiCall(`/api/tenant/inquiries/${id}`),
  reply: (id, body) => tenantApiCall(`/api/tenant/inquiries/${id}/replies`, { method: 'POST', body }),
  // 이미지 업로드(멀티파트) → { url }. 401 이면 한 번 갱신 후 재시도.
  uploadImage: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const run = () => fetch('/api/tenant/files/images', {
      method: 'POST',
      headers: tenantTokenStore.access ? { Authorization: `Bearer ${tenantTokenStore.access}` } : {},
      body: form,
    })
    let res = await run()
    if (res.status === 401 && tenantTokenStore.refresh) {
      // tenantApiCall 의 재발급 로직을 태우기 위해 가벼운 인증 호출을 한 번 던진다.
      try { await tenantAuthApi.me() } catch { /* noop */ }
      res = await run()
    }
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
    return res.json()
  },
}
