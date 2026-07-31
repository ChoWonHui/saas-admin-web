// 아이소메트릭(입체) 방 빌더 공용 로직 — 편집기(콘솔)와 손님 화면(IsoRoom)이 같은 값을 쓴다.
export const GRID = 7            // 7×7 바닥
export const TW = 46, TH = 23    // 타일 폭/높이(2:1 아이소)
export const WH = 74             // 벽 높이
export const FT = 14             // 바닥 두께(슬래브) — 얇은 종이처럼 안 보이게
export const OX = GRID * TW / 2  // 원점 X(왼쪽 끝이 0이 되도록)
export const OY = WH + 6         // 원점 Y(위에 벽 공간)
export const VW = GRID * TW
export const VH = GRID * TH + WH + 16 + FT

export const px = (x, y) => OX + (x - y) * TW / 2
export const py = (x, y) => OY + (x + y) * TH / 2

// 벽지 / 바닥재 프리셋 (기본값 = 폴백. 관리자 카탈로그를 불러오면 hydrateCatalog 가 덮어쓴다.)
export let WALLPAPERS = [
  { key: 'cream', label: '크림', color: '#efe4d2' },
  { key: 'brick', label: '벽돌', color: '#c88b6a' },
  { key: 'mint', label: '민트', color: '#cfeede' },
  { key: 'sky', label: '하늘', color: '#cfe4f7' },
  { key: 'pink', label: '핑크', color: '#f4d0dc' },
  { key: 'navy', label: '네이비', color: '#3c4a63' },
  { key: 'white', label: '화이트', color: '#f1f1f6' },
]
export let FLOORTILES = [
  { key: 'wood', label: '원목', color: '#d8b487' },
  { key: 'tile', label: '타일', color: '#e6e6ee' },
  { key: 'marble', label: '대리석', color: '#edeff3' },
  { key: 'green', label: '잔디', color: '#bfe0c4' },
  { key: 'dark', label: '다크', color: '#4a4a58' },
  { key: 'red', label: '레드', color: '#d3a0a0' },
]
export const wallColor = (k) => (WALLPAPERS.find((w) => w.key === k) || WALLPAPERS[0]).color
export const floorColor = (k) => (FLOORTILES.find((f) => f.key === k) || FLOORTILES[0]).color

// 배치 오브젝트. 대부분 'sprite'(이모지 아이콘 + 그림자)로 바닥에 놓인다.
// 가벽만 'wall'(얇은 벽 판)으로 세운다. 순서 = 팔레트 순서.
export let OBJECTS = {
  table: { name: '테이블', kind: 'sprite', draw: 'table', sz: 25, emoji: '🍽️' },
  chair: { name: '의자', kind: 'sprite', sz: 20, emoji: '🪑' },
  sofa: { name: '소파', kind: 'sprite', sz: 25, emoji: '🛋️' },
  counter: { name: '카운터', kind: 'sprite', draw: 'counter', sz: 24, emoji: '☕' },
  plant: { name: '화분', kind: 'sprite', sz: 24, emoji: '🪴' },
  lamp: { name: '조명', kind: 'sprite', sz: 25, emoji: '💡' },
  shelf: { name: '선반', kind: 'sprite', sz: 26, emoji: '📚' },
  door: { name: '문', kind: 'sprite', sz: 26, emoji: '🚪' },
  wall: { name: '가벽', kind: 'wall', h: 46, color: '#e3d7c4', emoji: '🚧' },
}
export let OBJECT_KEYS = Object.keys(OBJECTS)

// 도구 카테고리 — 종류가 늘어나면 여기에 추가/분류만 하면 된다.
export let OBJECT_CATS = [
  { key: 'furniture', label: '가구', icon: '🪑', items: ['table', 'chair', 'sofa'] },
  { key: 'facility', label: '시설', icon: '☕', items: ['counter', 'shelf', 'door'] },
  { key: 'deco', label: '장식', icon: '🪴', items: ['plant', 'lamp'] },
  { key: 'structure', label: '구조', icon: '🚧', items: ['wall'] },
]

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amt * 255)))
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255)
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

// 바닥 타일 (x,y) 다이아몬드 점.
export const tilePoints = (x, y) =>
  `${px(x, y)},${py(x, y)} ${px(x + 1, y)},${py(x + 1, y)} ${px(x + 1, y + 1)},${py(x + 1, y + 1)} ${px(x, y + 1)},${py(x, y + 1)}`

// 임의 footprint 큐보이드의 세 면(가벽 등에 사용).
export function box(x0, y0, x1, y1, h) {
  const A = [px(x0, y0), py(x0, y0)], B = [px(x1, y0), py(x1, y0)]
  const C = [px(x1, y1), py(x1, y1)], D = [px(x0, y1), py(x0, y1)]
  const up = (p) => `${p[0]},${p[1] - h}`
  const at = (p) => `${p[0]},${p[1]}`
  return {
    top: `${up(A)} ${up(B)} ${up(C)} ${up(D)}`,
    right: `${at(B)} ${at(C)} ${up(C)} ${up(B)}`,
    left: `${at(D)} ${at(C)} ${up(C)} ${up(D)}`,
  }
}

// 타일 (x,y)의 바닥 중심 좌표(스프라이트·그림자용).
export const tileCenter = (x, y) => [OX + (x - y) * TW / 2, OY + (x + y + 1) * TH / 2]

// 바닥 슬래브(앞쪽 두 모서리의 수직 두께 면) — 바닥이 단단한 판처럼 보이게.
export function floorSlab() {
  const L = [px(0, GRID), py(0, GRID)]     // 왼쪽 꼭짓점
  const F = [px(GRID, GRID), py(GRID, GRID)] // 앞 꼭짓점(맨 아래)
  const R = [px(GRID, 0), py(GRID, 0)]      // 오른쪽 꼭짓점
  const a = (p) => `${p[0]},${p[1]}`
  const d = (p) => `${p[0]},${p[1] + FT}`
  return {
    frontLeft: `${a(L)} ${a(F)} ${d(F)} ${d(L)}`,
    frontRight: `${a(F)} ${a(R)} ${d(R)} ${d(F)}`,
  }
}

// ===== 벽 배너(글자 쓰는 현수막) =====
export let BANNER_COLORS = ['#e05a5a', '#4a90d9', '#43b581', '#f0a030', '#9b59b6', '#2c2c40', '#ec7fb0']
export const BANNER_W = 0.62   // 벽을 따라 차지하는 가로 비율
export const BANNER_V0 = 0.46  // 배너 아래 높이(v)
export const BANNER_V1 = 0.8   // 배너 위 높이(v)

// 벽면의 한 점(f=수평 0..1, v=수직 0..1). wall: 'left' | 'right'.
export function wallPoint(wall, f, v) {
  const b0x = px(0, 0), b0y = py(0, 0)
  const ex = wall === 'left' ? px(0, GRID) : px(GRID, 0)
  const ey = wall === 'left' ? py(0, GRID) : py(GRID, 0)
  return [b0x + f * (ex - b0x), b0y + f * (ey - b0y) - v * WH]
}

// 배너 폴리곤 + 글자를 벽 평면에 눕히는 변환행렬. f = 시작 위치(0..1-BANNER_W).
export function bannerGeom(wall, f) {
  const f0 = Math.max(0, Math.min(1 - BANNER_W, f || 0))
  const f1 = f0 + BANNER_W
  const p = (ff, v) => wallPoint(wall, ff, v)
  const c00 = p(f0, BANNER_V1), c10 = p(f1, BANNER_V1), c11 = p(f1, BANNER_V0), c01 = p(f0, BANNER_V0)
  const points = `${c00[0]},${c00[1]} ${c10[0]},${c10[1]} ${c11[0]},${c11[1]} ${c01[0]},${c01[1]}`
  // 글자가 화면상 왼→오른쪽으로 읽히도록 로컬 x축을 잡는다(좌벽은 f 방향이 반대라 뒤집는다).
  const TL = wall === 'left' ? c10 : c00
  const TR = wall === 'left' ? c00 : c10
  const BL = wall === 'left' ? c11 : c01
  const LW = 100, LH = 40 // 로컬 좌표(가로100·세로40) → 벽 평면
  const ax = (TR[0] - TL[0]) / LW, ay = (TR[1] - TL[1]) / LW
  const cx = (BL[0] - TL[0]) / LH, cy = (BL[1] - TL[1]) / LH
  return { points, matrix: `matrix(${ax},${ay},${cx},${cy},${TL[0]},${TL[1]})`, LW, LH }
}

// 두 벽(뒤-왼쪽 / 뒤-오른쪽) 폴리곤.
export function walls() {
  const back = [px(0, 0), py(0, 0)]
  const right = [px(GRID, 0), py(GRID, 0)]
  const left = [px(0, GRID), py(0, GRID)]
  const u = (p) => `${p[0]},${p[1] - WH}`
  const a = (p) => `${p[0]},${p[1]}`
  return {
    rightWall: `${a(back)} ${a(right)} ${u(right)} ${u(back)}`,
    leftWall: `${a(back)} ${a(left)} ${u(left)} ${u(back)}`,
  }
}

// ===== 사장님 캐릭터(미니미) =====
export let SKINS = ['#f7d6b6', '#f0c49b', '#e0ac82', '#c68642', '#8d5524']
export let HAIR_COLORS = ['#2b2018', '#5a3a22', '#96612e', '#d9b45b', '#bdbdbd', '#e0607a', '#5a6cc0']
export let HAIR_STYLES = ['short', 'bob', 'long', 'bald']
export let OUTFITS = ['#e05a5a', '#4a90d9', '#43b581', '#f0a030', '#9b59b6', '#39404d', '#ec7fb0']
export let HATS = ['none', 'chef', 'cap', 'beanie']
export let HAT_LABEL = { none: '없음', chef: '요리사', cap: '캡모자', beanie: '비니' }
export let HAIR_LABEL = { short: '숏', bob: '단발', long: '긴머리', bald: '민머리' }
// 머리스타일 디자인 파라미터 { key: {type:'fringe'|'mass'|'bald', len?} }. 관리자 카탈로그가 덮어쓴다.
export let HAIR_DESIGNS = { short: { type: 'fringe' }, bob: { type: 'mass', len: -41 }, long: { type: 'mass', len: -27 }, bald: { type: 'bald' } }
// 모자 디자인 { key: {type:'preset', preset:'none'|'chef'|'cap'|'beanie'} | {type:'image', url} }.
export let HAT_DESIGNS = { none: { type: 'preset', preset: 'none' }, chef: { type: 'preset', preset: 'chef' }, cap: { type: 'preset', preset: 'cap' }, beanie: { type: 'preset', preset: 'beanie' } }

export const DEFAULT_CHAR = () => ({
  skin: '#f0c49b', hairStyle: 'short', hairColor: '#2b2018',
  outfit: '#e05a5a', apron: true, hat: 'chef', x: 3, y: 5,
})

function normChar(c) {
  const d = DEFAULT_CHAR()
  if (!c || typeof c !== 'object') return d
  return {
    skin: c.skin || d.skin,
    hairStyle: HAIR_STYLES.includes(c.hairStyle) ? c.hairStyle : d.hairStyle,
    hairColor: c.hairColor || d.hairColor,
    outfit: c.outfit || d.outfit,
    apron: c.apron !== false,
    hat: HATS.includes(c.hat) ? c.hat : d.hat,
    x: Number.isFinite(c.x) ? Math.max(0, Math.min(GRID - 1, c.x)) : d.x,
    y: Number.isFinite(c.y) ? Math.max(0, Math.min(GRID - 1, c.y)) : d.y,
  }
}

const DEFAULT_FLOOR = () => ({ wall: 'cream', floor: 'wood', items: [], banners: [] })
export const DEFAULT_ROOM = () => ({ v: 2, floors: [DEFAULT_FLOOR()], character: DEFAULT_CHAR() })

/** 저장된 값을 v2 방 구조로 정규화. 옛 미니룸(v1)이면 새로 시작. 캐릭터는 항상 존재. */
export function normalizeRoom(data) {
  let r = data
  if (typeof r === 'string') { try { r = JSON.parse(r) } catch { r = null } }
  if (!r || r.v !== 2 || !Array.isArray(r.floors) || r.floors.length === 0) return DEFAULT_ROOM()
  return {
    v: 2,
    floors: r.floors.map((f) => ({
      wall: f.wall || 'cream',
      floor: f.floor || 'wood',
      items: Array.isArray(f.items) ? f.items.filter((it) => OBJECTS[it.t]) : [],
      banners: Array.isArray(f.banners) ? f.banners.map((bn) => ({
        id: bn.id || 'b', wall: bn.wall === 'left' ? 'left' : 'right',
        f: Number.isFinite(bn.f) ? bn.f : 0.19, text: String(bn.text ?? '').slice(0, 16),
        color: bn.color || '#e05a5a',
      })) : [],
    })),
    character: normChar(r.character),
  }
}

// ===== 카탈로그 하이드레이션 =====
// 관리자 카탈로그(/api/public/decorate/catalog 응답)로 위 선택지 상수들을 덮어쓴다.
// 값이 비면 기본값(폴백)을 유지한다. import 한 곳들은 live binding 으로 새 값을 읽는다.
function itemsOf(cats, group, categoryKey) {
  return cats
    .filter((c) => c.group === group && (!categoryKey || c.categoryKey === categoryKey))
    .flatMap((c) => c.items || [])
}
function parseHairDesign(raw) {
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (d && (d.type === 'fringe' || d.type === 'mass' || d.type === 'bald' || (d.type === 'image' && d.url))) return d
  } catch { /* noop */ }
  return { type: 'fringe' }
}
function parseHatDesign(raw) {
  try {
    const d = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (d && d.type === 'preset' && d.preset) return d
    if (d && d.type === 'image' && d.url) return d
  } catch { /* noop */ }
  return { type: 'preset', preset: 'none' }
}
function itemToObject(i) {
  const rk = i.renderKind || 'sprite'
  if (rk === 'wall') return { name: i.label, kind: 'wall', h: i.wallH || 46, color: i.color || '#e3d7c4', emoji: i.emoji || '🚧' }
  if (rk === 'image') return { name: i.label, kind: 'sprite', draw: 'image', url: i.renderData, sz: i.sz || 30 }
  const o = { name: i.label, kind: 'sprite', sz: i.sz || 24, emoji: i.emoji || '▦' }
  if (rk === 'table') o.draw = 'table'
  if (rk === 'counter') o.draw = 'counter'
  return o
}

/** 관리자 카탈로그 배열을 받아 선택지 상수들을 갱신한다. 실패/빈 값이면 기본값 유지. */
export function hydrateCatalog(cats) {
  if (!Array.isArray(cats) || cats.length === 0) return
  const colors = (arr) => arr.map((i) => i.color).filter(Boolean)

  const wp = itemsOf(cats, 'WALLPAPER')
  if (wp.length) WALLPAPERS = wp.map((i) => ({ key: i.itemKey, label: i.label, color: i.color }))
  const fl = itemsOf(cats, 'FLOOR')
  if (fl.length) FLOORTILES = fl.map((i) => ({ key: i.itemKey, label: i.label, color: i.color }))

  const objCats = cats.filter((c) => c.group === 'OBJECT')
  if (objCats.length) {
    const objs = {}
    objCats.forEach((c) => (c.items || []).forEach((i) => { objs[i.itemKey] = itemToObject(i) }))
    OBJECTS = objs
    OBJECT_KEYS = Object.keys(objs)
    OBJECT_CATS = objCats.map((c) => ({
      key: c.categoryKey,
      label: c.label,
      // 분류 자체 아이콘(이모지 또는 이미지 URL). 없으면 첫 항목 이모지로 폴백.
      icon: c.icon || (c.items && c.items[0] && c.items[0].emoji) || '▦',
      items: (c.items || []).map((i) => i.itemKey),
    }))
  }

  const bn = colors(itemsOf(cats, 'BANNER'))
  if (bn.length) BANNER_COLORS = bn

  const skin = colors(itemsOf(cats, 'CHARACTER', 'SKIN'))
  if (skin.length) SKINS = skin
  const hcol = colors(itemsOf(cats, 'CHARACTER', 'HAIRCOLOR'))
  if (hcol.length) HAIR_COLORS = hcol
  const outf = colors(itemsOf(cats, 'CHARACTER', 'OUTFIT'))
  if (outf.length) OUTFITS = outf
  const hs = itemsOf(cats, 'CHARACTER', 'HAIRSTYLE')
  if (hs.length) {
    HAIR_STYLES = hs.map((i) => i.itemKey)
    HAIR_LABEL = Object.fromEntries(hs.map((i) => [i.itemKey, i.label]))
    HAIR_DESIGNS = Object.fromEntries(hs.map((i) => [i.itemKey, parseHairDesign(i.renderData)]))
  }
  const ht = itemsOf(cats, 'CHARACTER', 'HAT')
  if (ht.length) {
    HATS = ht.map((i) => i.itemKey)
    HAT_LABEL = Object.fromEntries(ht.map((i) => [i.itemKey, i.label]))
    HAT_DESIGNS = Object.fromEntries(ht.map((i) => [i.itemKey, parseHatDesign(i.renderData)]))
  }
}
