import { useEffect, useRef, useState } from 'react'
import { GRID, VW, VH, TW, TH, wallColor, floorColor, shade, tilePoints, box, tileCenter, walls, floorSlab, OBJECTS, normalizeRoom } from './iso'
import { AvatarGlyph } from './Avatar'
import { Banner } from './Banner'
import { WanderingChar } from './wander'
import { useCatalog } from '../catalog'

// 오브젝트 하나 — 가벽은 얇은 벽 판, 그 외는 아이콘 + 바닥 그림자.
function IsoObject({ it }) {
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
  if (o.draw === 'table') {
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

/** 손님 화면 — 아이소메트릭 방(읽기 전용). 층이 여러 개면 아래에 층 전환 버튼. */
export default function IsoRoom({ data }) {
  const catReady = useCatalog()
  const room = normalizeRoom(data)
  const [fi, setFi] = useState(0)

  const cur = Math.min(fi, room.floors.length - 1)
  const floor = room.floors[cur]
  const char = room.character
  const w = walls()
  const slab = floorSlab()
  const wc = wallColor(floor.wall)
  const fc = floorColor(floor.floor)
  const sorted = [...floor.items].sort((a, b) => (a.x + a.y) - (b.x + b.y))
  const cells = []
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) cells.push([x, y])

  if (!catReady) return <div className="iso-view" style={{ padding: 24, textAlign: 'center', color: '#888' }}>불러오는 중…</div>

  return (
    <div className="iso-view">
      <div className="iso-stage">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="iso-svg">
          <polygon points={w.leftWall} fill={shade(wc, -0.07)} stroke={shade(wc, -0.2)} strokeWidth="0.5" />
          <polygon points={w.rightWall} fill={wc} stroke={shade(wc, -0.2)} strokeWidth="0.5" />
          {(floor.banners || []).map((bn) => <Banner key={bn.id} b={bn} />)}
          <polygon points={slab.frontLeft} fill={shade(fc, -0.28)} />
          <polygon points={slab.frontRight} fill={shade(fc, -0.16)} />
          {cells.map(([x, y]) => (
            <polygon key={`t${x}-${y}`} points={tilePoints(x, y)}
              fill={(x + y) % 2 ? shade(fc, -0.045) : fc} stroke={shade(fc, -0.13)} strokeWidth="0.4" />
          ))}
          {sorted.map((it) => <IsoObject key={`o${it.x}-${it.y}`} it={it} />)}
          <WanderingChar char={char} />
        </svg>
      </div>
      {room.floors.length > 1 && (
        <div className="iso-floors">
          {room.floors.map((_, i) => (
            <button key={i} className={`iso-floor-btn${i === cur ? ' on' : ''}`} onClick={() => setFi(i)}>{i + 1}층</button>
          ))}
        </div>
      )}
    </div>
  )
}
