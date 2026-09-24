// 손님(무인증) API. 백엔드 /api/public/** 는 인증이 필요 없다.
// 같은 오리진(/api)으로 호출 → 개발/운영 코드가 동일하고 CORS 가 필요 없다.

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message = data?.message || '요청을 처리하지 못했습니다.'
    const err = new Error(message)
    err.status = res.status
    err.code = data?.code
    throw err
  }
  return data
}

export const shopApi = {
  // 가게·테이블 확인(화면 헤더)
  table: (tenantCode, tableCode) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/tables/${encodeURIComponent(tableCode)}`),
  // 가게 메인 페이지(소개/영업시간 등). 미표시면 published=false.
  home: (tenantCode) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/home`),
  // 메뉴판
  menu: (tenantCode) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/menu`),
  // 테이블 주문 접수
  placeOrder: (tenantCode, tableCode, payload) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/tables/${encodeURIComponent(tableCode)}/orders`, {
      method: 'POST',
      body: payload,
    }),
  // 포장 주문 가능 여부(포장 QR 진입) — { shopName, tenantCode, takeoutAvailable }
  takeout: (tenantCode) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/takeout`),
  // 포장 주문 접수 (정지 상태면 409 TAKEOUT_STOPPED)
  placeTakeoutOrder: (tenantCode, payload) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/takeout/orders`, {
      method: 'POST',
      body: payload,
    }),
  // 택배 주문 가능 여부(택배 진입) — { shopName, tenantCode, parcelAvailable, orderEnabled, account, business }
  parcel: (tenantCode) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/parcel`),
  // 택배 주문 접수 (배송지 필수, 미제공이면 409 PARCEL_STOPPED)
  placeParcelOrder: (tenantCode, payload) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/parcel/orders`, {
      method: 'POST',
      body: payload,
    }),
  // 이 테이블의 진행 중 주문(종료 전) — '내 주문 내역'
  tableOrders: (tenantCode, tableCode) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/tables/${encodeURIComponent(tableCode)}/orders`),
  // 주문 id 목록으로 조회(포장 등, 이 기기에서 넣은 주문)
  ordersByIds: (tenantCode, ids) =>
    request(`/public/shops/${encodeURIComponent(tenantCode)}/orders?ids=${encodeURIComponent((ids || []).join(','))}`),
  // 플랫폼(본사) 공통 광고 배너 — 미노출이면 enabled=false
  ad: () => request('/public/ad'),
  // 은행 송금 런처 목록(공통코드 BANK_LAUNCHER_URL ⋈ BANK_CD) — [{code, name, url}]
  bankLaunchers: () => request('/public/bank-launchers'),
}

// 다국어 — 메뉴 텍스트 자동 번역(무인증, 서버 캐시). { 원문: 번역문 } 반환.
export const i18nApi = {
  translate: (targetLang, texts) =>
    request('/public/i18n/translate', { method: 'POST', body: { targetLang, texts } }),
}

// 홈페이지 문의(무인증) — kanchenjunga.co.kr / exprism.co.kr 의 /contact 폼.
//
// 받는 주소를 여기서 보내지 않는다. 서버가 공통코드(KCJG_CONTACT_EMAIL)에 등록된 주소로만
// 알림을 보낸다 — 프런트가 수신자를 정할 수 있으면 그 순간 스팸 중계기가 된다.
// (옛 /api-proxy/home/send-email 은 kanchenjunga-nodejs 시절 경로다. 지금 nginx 에 그 위치가 없다)
export const homeInquiryApi = {
  create: (payload) => request('/public/home-inquiries', { method: 'POST', body: payload }),
}

// 회사 사이트 공지사항(무인증). 공개된 글만 내려온다 — 초안은 서버가 걸러 준다.
export const homeNoticeApi = {
  list: ({ category = '', keyword = '', page = 0, size = 10 } = {}) => {
    const params = new URLSearchParams({ page, size })
    if (category) params.set('category', category)
    if (keyword) params.set('keyword', keyword)
    return request(`/public/home-notices?${params}`)
  },
  get: (id) => request(`/public/home-notices/${encodeURIComponent(id)}`),
  categories: () => request('/public/home-notices/categories'),
}
