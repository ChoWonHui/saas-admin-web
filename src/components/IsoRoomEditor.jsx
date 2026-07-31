import { useState } from 'react'
import {
  GRID, VW, VH, TW, TH, OX, WALLPAPERS, FLOORTILES, OBJECTS, OBJECT_CATS,
  SKINS, HAIR_COLORS, HAIR_STYLES, OUTFITS, HATS, HAT_LABEL, HAIR_LABEL,
  BANNER_COLORS, BANNER_W,
  wallColor, floorColor, shade, tilePoints, box, tileCenter, walls, floorSlab, normalizeRoom, DEFAULT_ROOM,
} from './iso'
import Avatar from './Avatar'
import { Banner } from './Banner'
import { WanderingChar } from './wander'
import { useCatalog } from '../catalog'

let seq = 0

// 아이콘이 이모지인지 이미지 URL 인지.
const isImgIcon = (s) => typeof s === 'string' && (s.startsWith('/') || s.startsWith('http') || s.startsWith('data:'))

/** 아이소메트릭 방 편집기 — 미니룸이 최상단, 그 아래 벽지·바닥·도구. (단일 층) */
export default function IsoRoomEditor({ value, onChange }) {
  const room = normalizeRoom(value)
  const catReady = useCatalog()
  const [tool, setTool] = useState('table')
  const [cat, setCat] = useState(OBJECT_CATS[0].key)
  const [charOpen, setCharOpen] = useState(false)
  const cur = 0                    // 층 기능 제거 — 항상 1층만 편집
  const floor = room.floors[cur]

  const char = room.character
  const emit = (next) => onChange(next)
  const setFloor = (patch) => emit({ ...room, floors: room.floors.map((f, i) => (i === cur ? { ...f, ...patch } : f)) })
  const setChar = (patch) => emit({ ...room, character: { ...char, ...patch } })
  function placeAt(x, y) {
    const items = floor.items.filter((it) => !(it.x === x && it.y === y))
    if (tool !== 'erase') items.push({ t: tool, x, y })
    setFloor({ items })
  }
  // 벽 배너
  const banners = floor.banners || []
  const setBanners = (next) => setFloor({ banners: next })
  const addBanner = () => setBanners([...banners, { id: 'b' + (Date.now() % 100000) + '_' + (seq++), wall: 'right', f: 0.19, text: '환영합니다', color: '#e05a5a' }])
  const patchBanner = (id, p) => setBanners(banners.map((bn) => (bn.id === id ? { ...bn, ...p } : bn)))
  const delBanner = (id) => setBanners(banners.filter((bn) => bn.id !== id))
  // 배너를 벽을 따라 드래그해 위치(f) 변경. 화면 x 만으로 벽 상의 f 를 구한다.
  function startBannerDrag(e, bn) {
    e.preventDefault(); e.stopPropagation()
    const svg = e.currentTarget.ownerSVGElement
    const endX = OX + (bn.wall === 'left' ? -1 : 1) * GRID * TW / 2 // px(0,GRID) or px(GRID,0)
    const move = (ev) => {
      const rect = svg.getBoundingClientRect()
      const mx = (ev.clientX - rect.left) / rect.width * VW
      let f = (mx - OX) / (endX - OX) - BANNER_W / 2
      f = Math.max(0, Math.min(1 - BANNER_W, f))
      patchBanner(bn.id, { f })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const w = walls()
  const slab = floorSlab()
  const wc = wallColor(floor.wall)
  const fc = floorColor(floor.floor)
  const sorted = [...floor.items].sort((a, b) => (a.x + a.y) - (b.x + b.y))
  const cells = []
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) cells.push([x, y])

  // 카탈로그(벽지·바닥·도구·색)를 불러온 뒤 그린다.
  if (!catReady) return <p className="hint left" style={{ padding: 24 }}>꾸미기 항목을 불러오는 중…</p>

  // 하이드레이션 후 선택 분류가 사라졌을 수 있어 방어.
  const activeCatItems = (OBJECT_CATS.find((c) => c.key === cat) || OBJECT_CATS[0] || { items: [] }).items || []

  return (
    <div className="iso-editor v">
      {/* 미니룸 — 최상단 */}
      <div className="iso-stage">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="iso-svg">
          <polygon points={w.leftWall} fill={shade(wc, -0.07)} stroke={shade(wc, -0.2)} strokeWidth="0.5" />
          <polygon points={w.rightWall} fill={wc} stroke={shade(wc, -0.2)} strokeWidth="0.5" />
          {banners.map((bn) => (
            <g key={bn.id} className="banner-drag" onPointerDown={(e) => startBannerDrag(e, bn)}>
              <Banner b={bn} />
            </g>
          ))}
          <polygon points={slab.frontLeft} fill={shade(fc, -0.28)} />
          <polygon points={slab.frontRight} fill={shade(fc, -0.16)} />
          {cells.map(([x, y]) => (
            <polygon key={`t${x}-${y}`} points={tilePoints(x, y)}
              fill={(x + y) % 2 ? shade(fc, -0.045) : fc} stroke={shade(fc, -0.13)} strokeWidth="0.4" />
          ))}
          {sorted.map((it) => <IsoObject key={`o${it.x}-${it.y}`} it={it} />)}
          <WanderingChar char={char} />
          {cells.map(([x, y]) => (
            <polygon key={`h${x}-${y}`} points={tilePoints(x, y)} className="iso-hit" onClick={() => placeAt(x, y)} />
          ))}
        </svg>
      </div>

      {/* 미니룸 아래 — 벽지 / 바닥 / 도구 */}
      <div className="iso-controls">
      {/* 사장님 캐릭터 — 선택 항목 중 제일 위 */}
      <div className="char-bar">
        <div className="char-preview sm"><Avatar char={char} className="char-avatar" /></div>
        <div className="char-bar-info">
          <span className="char-bar-title">사장님 캐릭터</span>
          <span className="char-bar-sub">방에 항상 표시돼요</span>
        </div>
        <button type="button" className="char-open-btn" onClick={() => setCharOpen(true)}>＋ 꾸미기</button>
      </div>
      {/* 배경(벽지·바닥) — 스크롤 그리드(색이 늘어나도 정리됨) */}
      <div className="iso-bgbox">
        <div className="iso-bg-row">
          <span className="iso-swlabel">벽지</span>
          <div className="iso-swgrid">
            {WALLPAPERS.map((s) => (
              <button key={s.key} type="button" title={s.label} className={`iso-swatch${floor.wall === s.key ? ' on' : ''}`}
                style={{ background: s.color }} onClick={() => setFloor({ wall: s.key })} />
            ))}
          </div>
        </div>
        <div className="iso-bg-row">
          <span className="iso-swlabel">바닥</span>
          <div className="iso-swgrid">
            {FLOORTILES.map((s) => (
              <button key={s.key} type="button" title={s.label} className={`iso-swatch${floor.floor === s.key ? ' on' : ''}`}
                style={{ background: s.color }} onClick={() => setFloor({ floor: s.key })} />
            ))}
          </div>
        </div>
      </div>

      {/* 도구 툴박스 — 카테고리 탭 + 스크롤 그리드(도구가 늘어나도 정리됨) */}
      <div className="iso-toolbox">
        <div className="iso-tb-head">
          <span className="iso-tb-title">도구</span>
          <button type="button" className={`iso-erase-btn${tool === 'erase' ? ' on' : ''}`} onClick={() => setTool('erase')}>
            🧽 지우개
          </button>
        </div>
        <div className="iso-cat-tabs">
          {OBJECT_CATS.map((c) => (
            <button key={c.key} type="button" className={`iso-cat${cat === c.key ? ' on' : ''}`} onClick={() => setCat(c.key)}>
              <span className="iso-cat-ic">{isImgIcon(c.icon) ? <img src={c.icon} alt="" className="iso-cat-img" /> : c.icon}</span>{c.label}
            </button>
          ))}
        </div>
        <div className="iso-tool-grid">
          {activeCatItems.filter((k) => OBJECTS[k]).map((k) => (
            <button key={k} type="button" className={`iso-tool${tool === k ? ' on' : ''}`} onClick={() => setTool(k)}>
              <span className="iso-tool-ic"><ToolIcon o={OBJECTS[k]} /></span>
              <span className="iso-tool-name">{OBJECTS[k].name}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="hint left">카테고리에서 도구를 고르고 바닥 칸을 눌러 배치하세요. 지우개로 지웁니다.</p>

      {/* 벽 배너 */}
      <div className="banner-editor">
        <div className="banner-head">
          <span className="banner-title">벽 배너</span>
          <button type="button" className="btn-ghost btn-sm" onClick={addBanner}>＋ 배너 추가</button>
        </div>
        {banners.length === 0
          ? <p className="hint left" style={{ margin: 0 }}>＋ 배너 추가로 벽에 문구를 걸 수 있어요.</p>
          : <p className="hint left" style={{ margin: 0 }}>방에서 배너를 끌어 위치를 옮기세요.</p>}
        {banners.map((bn) => (
          <div className="banner-row" key={bn.id}>
            <input className="banner-text" value={bn.text} maxLength={16} placeholder="배너 문구"
              onChange={(e) => patchBanner(bn.id, { text: e.target.value })} />
            <button type="button" className={`char-chip${bn.wall === 'left' ? ' on' : ''}`} onClick={() => patchBanner(bn.id, { wall: 'left' })}>좌벽</button>
            <button type="button" className={`char-chip${bn.wall === 'right' ? ' on' : ''}`} onClick={() => patchBanner(bn.id, { wall: 'right' })}>우벽</button>
            <span className="banner-sws">
              {BANNER_COLORS.map((c) => (
                <button key={c} type="button" className={`char-sw${bn.color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => patchBanner(bn.id, { color: c })} />
              ))}
            </span>
            <button type="button" className="btn-danger btn-sm" onClick={() => delBanner(bn.id)}>삭제</button>
          </div>
        ))}
      </div>
      </div>

      {charOpen && (
        <div className="modal-backdrop" onClick={() => setCharOpen(false)}>
          <div className="modal char-modal" onClick={(e) => e.stopPropagation()}>
            <div className="char-modal-head">
              <h3>사장님 캐릭터 꾸미기</h3>
              <button type="button" className="char-modal-x" aria-label="닫기" onClick={() => setCharOpen(false)}>✕</button>
            </div>
            <div className="char-modal-body">
              <div className="char-preview"><Avatar char={char} className="char-avatar" /></div>
              <div className="char-opts">
                <div className="char-row">
                  <span className="char-label">피부</span>
                  {SKINS.map((s) => (
                    <button key={s} type="button" className={`char-sw${char.skin === s ? ' on' : ''}`} style={{ background: s }} onClick={() => setChar({ skin: s })} />
                  ))}
                </div>
                <div className="char-row">
                  <span className="char-label">머리</span>
                  {HAIR_STYLES.map((h) => (
                    <button key={h} type="button" className={`char-chip${char.hairStyle === h ? ' on' : ''}`} onClick={() => setChar({ hairStyle: h })}>{HAIR_LABEL[h]}</button>
                  ))}
                </div>
                <div className="char-row">
                  <span className="char-label">머리색</span>
                  {HAIR_COLORS.map((c) => (
                    <button key={c} type="button" className={`char-sw${char.hairColor === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setChar({ hairColor: c })} />
                  ))}
                </div>
                <div className="char-row">
                  <span className="char-label">옷색</span>
                  {OUTFITS.map((c) => (
                    <button key={c} type="button" className={`char-sw${char.outfit === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setChar({ outfit: c })} />
                  ))}
                </div>
                <div className="char-row">
                  <span className="char-label">모자</span>
                  {HATS.map((h) => (
                    <button key={h} type="button" className={`char-chip${char.hat === h ? ' on' : ''}`} onClick={() => setChar({ hat: h })}>{HAT_LABEL[h]}</button>
                  ))}
                  <label className="char-apron"><input type="checkbox" checked={char.apron} onChange={(e) => setChar({ apron: e.target.checked })} /> 앞치마</label>
                </div>
              </div>
            </div>
            <div className="char-modal-actions">
              <button type="button" className="btn-primary btn-sm" onClick={() => setCharOpen(false)}>완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 오브젝트 하나 — 가벽은 얇은 벽 판, 테이블은 벡터, 그 외는 아이콘 + 바닥 그림자.
export function IsoObject({ it }) {
  const o = OBJECTS[it.t]
  if (o.kind === 'wall') {
    const b = box(it.x, it.y + 0.34, it.x + 1, it.y + 0.66, o.h)
    return (
      <g>
        <polygon points={b.left} fill={shade(o.color, -0.22)} />
        <polygon points={b.right} fill={shade(o.color, -0.06)} />
        <polygon points={b.top} fill={shade(o.color, 0.15)} stroke={shade(o.color, -0.22)} strokeWidth="0.4" />
      </g>
    )
  }
  if (o.draw === 'counter') {
    const b = box(it.x + 0.12, it.y + 0.12, it.x + 0.88, it.y + 0.88, 26)
    return (
      <g>
        <polygon points={b.left} fill="#8f6238" />
        <polygon points={b.right} fill="#b0824e" />
        <polygon points={b.top} fill="#dcbb86" stroke="#7a4e2c" strokeWidth="0.5" />
      </g>
    )
  }
  const [cx, cy] = tileCenter(it.x, it.y)
  if (o.draw === 'table') return <TableSprite cx={cx} cy={cy} />
  if (o.draw === 'image' && o.url) {
    const w = (o.sz || 30) * 2, h = w
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={TW * 0.3} ry={TH * 0.32} fill="rgba(0,0,0,0.18)" />
        <image href={o.url} x={cx - w / 2} y={cy - h * 0.86} width={w} height={h} preserveAspectRatio="xMidYMid meet" />
      </g>
    )
  }
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={TW * 0.3} ry={TH * 0.32} fill="rgba(0,0,0,0.18)" />
      <text x={cx} y={cy - o.sz * 0.32} fontSize={o.sz} textAnchor="middle" dominantBaseline="central">{o.emoji}</text>
    </g>
  )
}

// 원형 카페 테이블(외다리) — 방 안 스프라이트.
export function TableSprite({ cx, cy }) {
  const h = 19
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={TW * 0.32} ry={TH * 0.34} fill="rgba(0,0,0,0.18)" />
      <ellipse cx={cx} cy={cy - 1} rx={6.5} ry={2.4} fill="#9a7b53" />
      <rect x={cx - 2.4} y={cy - h} width={4.8} height={h} rx={1.2} fill="#b58c5c" />
      <ellipse cx={cx} cy={cy - h} rx={TW * 0.36} ry={TH * 0.4} fill="#c69a63" />
      <ellipse cx={cx} cy={cy - h - 1.8} rx={TW * 0.36} ry={TH * 0.4} fill="#dcbb86" stroke="#a9814f" strokeWidth="0.8" />
    </g>
  )
}

// 팔레트용 작은 테이블 아이콘.
export function TableGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <ellipse cx="12" cy="18" rx="7.5" ry="2" fill="#c9a36e" />
      <rect x="10.6" y="9" width="2.8" height="9" rx="1" fill="#b58c5c" />
      <ellipse cx="12" cy="9" rx="8.5" ry="2.8" fill="#dcbb86" stroke="#a9814f" strokeWidth="1" />
    </svg>
  )
}

// 팔레트용 작은 카운터 아이콘.
export function CounterGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <polygon points="4,10 12,7 20,10 12,13" fill="#dcbb86" stroke="#7a4e2c" strokeWidth="0.6" />
      <polygon points="4,10 12,13 12,20 4,17" fill="#8f6238" />
      <polygon points="12,13 20,10 20,17 12,20" fill="#b0824e" />
    </svg>
  )
}

// 팔레트 아이콘 — 벡터 오브젝트는 전용 글리프, 나머지는 이모지.
function ToolIcon({ o }) {
  if (o.draw === 'table') return <TableGlyph />
  if (o.draw === 'counter') return <CounterGlyph />
  if (o.draw === 'image' && o.url) return <img src={o.url} alt="" className="iso-tool-img" />
  return <>{o.emoji || '▮'}</>
}

export { DEFAULT_ROOM }
