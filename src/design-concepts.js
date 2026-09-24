/**
 * 디자인 시안 30종 — 전부 다른 "레이아웃 구조".
 *
 * 국내 기업 사이트 8곳(LG·삼성전자 DX·한화·롯데재단·두산·현대차·SK·네이버)의 첫 화면을
 * 실제로 열어 본 뒤, 거기서 본 골격을 출발점으로 삼아 30가지 배치를 만들었다.
 *
 * 색은 시안에 넣지 않는다. 화면에서 사용자가 직접 고른 포인트 색이 30개 전부에
 * 실시간으로 적용된다 — 구조를 비교하는 자리에서 색이 달라지면 비교가 안 되기 때문이다.
 *
 * group 은 필터용 묶음이다.
 */

export const GROUPS = [
  { id: 'hero', label: '히어로 중심' },
  { id: 'split', label: '분할' },
  { id: 'grid', label: '그리드' },
  { id: 'list', label: '목록 · 매거진' },
  { id: 'special', label: '변형' },
]

/** 30가지 구조. name 은 배치를 그대로 설명하는 이름으로 짓는다. */
export const LAYOUTS = [
  // ── 히어로 중심 ─────────────────────────────
  { id: 'center', group: 'hero', name: '중앙 집중', desc: '슬로건을 화면 한가운데 크게 놓는다. 메시지 하나에 힘을 싣는 가장 보편적인 형태.' },
  { id: 'left', group: 'hero', name: '좌측 정렬', desc: '슬로건을 왼쪽에 붙이고 오른쪽을 비운다. 제품 사진이 들어갈 자리가 생긴다.' },
  { id: 'right', group: 'hero', name: '우측 정렬', desc: '왼쪽에 비주얼, 오른쪽에 글. 시선이 그림에서 글로 흐른다.' },
  { id: 'overlay', group: 'hero', name: '풀스크린 오버레이', desc: '화면 전체를 비주얼로 채우고 그 위에 글을 얹는다. 인상이 가장 강하다.' },
  { id: 'typeonly', group: 'hero', name: '타입 온리', desc: '이미지 없이 글자만으로 채운다. 사진이 준비되지 않아도 완성도가 나온다.' },
  { id: 'boxed', group: 'hero', name: '프레임 인셋', desc: '화면 안쪽에 여백 테두리를 두고 그 안에 히어로를 넣는다. 정돈된 인상.' },
  { id: 'bottomcta', group: 'hero', name: '하단 고정 CTA', desc: '슬로건은 위, 문의 버튼은 화면 아래에 띠로 고정한다. 전환을 노린 배치.' },

  // ── 분할 ───────────────────────────────────
  { id: 'split', group: 'split', name: '좌우 5:5 분할', desc: '글과 비주얼을 반씩 나눈다. 설명할 내용이 많을 때 안정적이다.' },
  { id: 'split64', group: 'split', name: '좌우 6:4 분할', desc: '글 쪽을 넓게 잡아 문장을 충분히 넣는다.' },
  { id: 'splitv', group: 'split', name: '상하 분할', desc: '위는 글, 아래는 비주얼로 가로로 자른다. 세로가 긴 화면에 잘 맞는다.' },
  { id: 'diagonal', group: 'split', name: '대각 분할', desc: '경계를 비스듬히 잘라 정적인 화면에 움직임을 준다.' },
  { id: 'offset', group: 'split', name: '오프셋 겹침', desc: '글 상자와 비주얼을 서로 겹쳐 깊이를 만든다.' },
  { id: 'sidebar', group: 'split', name: '사이드 내비', desc: '내비를 왼쪽 세로로 세운다. 메뉴가 많은 사이트에 유리하다.' },
  { id: 'sticky', group: 'split', name: '좌측 고정 · 우측 흐름', desc: '왼쪽 글은 멈춰 있고 오른쪽만 흐른다. 긴 소개에 어울린다.' },

  // ── 그리드 ─────────────────────────────────
  { id: 'bento', group: 'grid', name: '벤토 그리드', desc: '큰 카드 하나에 작은 카드를 붙인 비대칭 격자. 소식·지표를 한 화면에 모은다.' },
  { id: 'quad', group: 'grid', name: '4분할 타일', desc: '같은 크기 타일 넷으로 사업 영역을 한 번에 보여준다.' },
  { id: 'cards3', group: 'grid', name: '히어로 + 카드 3', desc: '히어로 아래에 카드 셋을 붙인 가장 익숙한 기업 홈 구성.' },
  { id: 'mosaic', group: 'grid', name: '모자이크', desc: '크기가 제각각인 타일을 촘촘히 깐다. 사진이 많을 때 좋다.' },
  { id: 'gallery', group: 'grid', name: '갤러리 격자', desc: '같은 비율 이미지를 격자로 늘어놓는다. 포트폴리오형.' },
  { id: 'stats', group: 'grid', name: '히어로 + 지표 바', desc: '슬로건 아래에 숫자 지표를 한 줄로 깐다. 실적을 앞세울 때.' },
  { id: 'stair', group: 'grid', name: '계단식', desc: '카드를 한 칸씩 어긋나게 쌓아 리듬을 만든다.' },

  // ── 목록 · 매거진 ──────────────────────────
  { id: 'magazine', group: 'list', name: '매거진 3단', desc: '신문처럼 세 단으로 나눠 글을 흘린다. 읽을거리가 많은 사이트에.' },
  { id: 'newslist', group: 'list', name: '히어로 + 뉴스 목록', desc: '왼쪽 큰 비주얼, 오른쪽 소식 목록. 공지가 잦은 곳에 맞는다.' },
  { id: 'bigrow', group: 'list', name: '대형 리스트', desc: '항목 하나가 한 줄을 통째로 쓴다. 목록 자체가 디자인이 된다.' },
  { id: 'timeline', group: 'list', name: '세로 타임라인', desc: '세로 축을 따라 항목을 배치한다. 연혁·과정 설명에 적합.' },
  { id: 'accordion', group: 'list', name: '아코디언', desc: '접힌 항목을 눌러 펼친다. 내용이 길어도 첫 화면이 짧아진다.' },

  // ── 변형 ───────────────────────────────────
  { id: 'circle', group: 'special', name: '원형 마스크', desc: '비주얼을 원으로 잘라낸다. 부드럽고 브랜드 색이 잘 산다.' },
  { id: 'ticker', group: 'special', name: '흐르는 띠', desc: '가로로 흐르는 문구 띠를 넣어 화면에 속도감을 준다.' },
  { id: 'dashboard', group: 'special', name: '대시보드', desc: '위젯을 늘어놓아 서비스 화면처럼 보이게 한다. 제품 소개에 유리.' },
  { id: 'bignum', group: 'special', name: '대형 숫자', desc: '큰 숫자를 왼쪽에 두고 설명을 붙인다. 성과를 강조할 때.' },
]

// 30개가 맞는지 개발 중 실수로 어긋나지 않게 확인한다.
if (LAYOUTS.length !== 30) {
  console.warn(`[design] 시안 수가 30이 아닙니다: ${LAYOUTS.length}`)
}

export const CONCEPTS = LAYOUTS.map((l, i) => ({
  ...l,
  no: String(i + 1).padStart(2, '0'),
}))

export const FILTERS = [
  { id: 'all', label: '전체' },
  ...GROUPS.map((g) => ({ id: g.id, label: g.label })),
]

/** 기본 포인트 색. 화면의 색 선택기에서 바꾸면 30개에 즉시 반영된다. */
export const DEFAULT_ACCENT = '#2F6FEB'

/** #rrggbb 를 {r,g,b} 로. 잘못된 값이면 null. */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex({ r, g, b }) {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** 밝기 조절. amt 가 음수면 검정 쪽, 양수면 흰색 쪽으로 섞는다. */
export function shade(hex, amt) {
  const c = hexToRgb(hex)
  if (!c) return hex
  const t = amt < 0 ? 0 : 255
  const p = Math.abs(amt)
  return rgbToHex({ r: c.r + (t - c.r) * p, g: c.g + (t - c.g) * p, b: c.b + (t - c.b) * p })
}

/** 이 색 위에 흰 글씨를 얹어도 읽히는가. 어두우면 흰색, 밝으면 검정을 돌려준다. */
export function onColor(hex) {
  const c = hexToRgb(hex)
  if (!c) return '#fff'
  // WCAG 상대 휘도 근사식. 노란색처럼 밝은 색에 흰 글씨를 얹는 실수를 막는다.
  const lum = (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255
  return lum > 0.62 ? '#15181D' : '#FFFFFF'
}

/**
 * 사이트에 넣을 수 있는 메뉴 후보.
 *
 * 고객이 "무엇을 넣을지" 를 백지에서 떠올리기는 어렵다. 기업 사이트에 흔히 있는 것들을
 * 늘어놓고 고르게 한다. main: true 인 항목은 처음부터 '메인 노출' 이 켜져 있다
 * — 보통 상단 내비에 올리는 것들이다.
 */
export const MENU_CATALOG = [
  {
    group: '회사',
    items: [
      { id: 'about', label: '회사소개', main: true },
      { id: 'greeting', label: '대표 인사말' },
      { id: 'history', label: '연혁' },
      { id: 'org', label: '조직도' },
      { id: 'vision', label: '비전 · 미션' },
      { id: 'location', label: '오시는 길' },
      { id: 'ci', label: 'CI · BI 소개' },
    ],
  },
  {
    group: '사업 · 제품',
    items: [
      { id: 'biz', label: '사업영역', main: true },
      { id: 'product', label: '제품 · 서비스' },
      { id: 'portfolio', label: '포트폴리오 · 구축사례' },
      { id: 'client', label: '고객사' },
      { id: 'price', label: '요금 안내' },
    ],
  },
  {
    group: '고객지원',
    items: [
      { id: 'support', label: '고객센터', main: true },
      { id: 'notice', label: '공지사항', main: true },
      { id: 'faq', label: 'FAQ' },
      { id: 'contact', label: '문의하기', main: true },
      { id: 'qna', label: '1:1 상담' },
      { id: 'archive', label: '자료실 · 다운로드' },
    ],
  },
  {
    group: '소식 · 채용',
    items: [
      { id: 'news', label: '뉴스 · 보도자료' },
      { id: 'blog', label: '블로그' },
      { id: 'gallery', label: '갤러리' },
      { id: 'recruit', label: '채용정보' },
      { id: 'welfare', label: '인재상 · 복리후생' },
    ],
  },
  {
    group: '기능',
    items: [
      { id: 'search', label: '통합검색' },
      { id: 'lang', label: '언어 전환' },
      { id: 'login', label: '로그인 · 회원가입' },
      { id: 'sitemap', label: '사이트맵' },
      { id: 'terms', label: '이용약관 · 개인정보처리방침' },
    ],
  },
]

/** id → 라벨. 메일 본문을 만들 때 쓴다. */
export const MENU_LABEL = Object.fromEntries(
  MENU_CATALOG.flatMap((g) => g.items.map((i) => [i.id, i.label])),
)

/** 처음에 켜져 있는 메뉴 — 어떤 사이트에나 있는 것들만 최소로 잡는다. */
export const DEFAULT_MENUS = MENU_CATALOG.flatMap((g) =>
  g.items.filter((i) => i.main).map((i) => i.id),
)

// 미리보기 안에 넣는 더미 문구.
export const SAMPLE = {
  brand: 'KANCHENJUNGA',
  title: ['미래를 코딩하다,', 'KANCHENJUNGA'],
  lead: '기획부터 디자인, 개발, 보안까지 한 팀이 끝까지 책임집니다.',
  cta: '프로젝트 문의',
  nav: ['회사정보', '사업영역', 'NOTICE', 'CONTACT'],
  cards: ['IT 컨설팅', 'EXPRISM', '문의'],
  stats: [['30+', '프로젝트'], ['4', '핵심 영역'], ['5', '지원 언어'], ['24/7', '기술 지원']],
  rows: ['기획 · 요구사항 정리', '디자인 · 화면 설계', '개발 · 배포', '보안 · 유지보수'],
}
