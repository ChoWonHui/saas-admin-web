import { useEffect, useRef, useState } from 'react'
import { GRID, TW, TH, tileCenter } from './iso'
import { AvatarGlyph } from './Avatar'

/**
 * 방 안을 돌아다니는 사장님 캐릭터 — 지정 위치(char.x,y) 주변을 천천히 걸어다니고 통통 튄다.
 * 이동 방향에 따라 좌우로 돌아본다. requestAnimationFrame 으로만 애니메이션.
 */
export function WanderingChar({ char }) {
  const [pos, setPos] = useState({ x: char.x, y: char.y })
  const [face, setFace] = useState(1)
  const posRef = useRef({ x: char.x, y: char.y })
  const homeRef = useRef({ x: char.x, y: char.y })
  const targetRef = useRef({ x: char.x, y: char.y })
  const tRef = useRef(0)

  useEffect(() => { homeRef.current = { x: char.x, y: char.y } }, [char.x, char.y])

  useEffect(() => {
    let raf
    let nextAt = 0
    const clamp = (v) => Math.max(0, Math.min(GRID - 1, v))
    const loop = (ts) => {
      tRef.current += 1
      if (ts > nextAt) {
        const h = homeRef.current
        targetRef.current = { x: clamp(h.x + (Math.random() * 4 - 2)), y: clamp(h.y + (Math.random() * 4 - 2)) }
        nextAt = ts + 2600 + Math.random() * 2600
      }
      const p = posRef.current, t = targetRef.current
      const dx = t.x - p.x, dy = t.y - p.y
      const dist = Math.hypot(dx, dy)
      const sp = 0.03
      let moving = false
      let np
      if (dist < sp) { np = { x: t.x, y: t.y } } else { np = { x: p.x + (dx / dist) * sp, y: p.y + (dy / dist) * sp }; moving = true }
      posRef.current = np
      setPos(np)
      if (moving) setFace((dx - dy) < 0 ? -1 : 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const [cx, cy] = tileCenter(pos.x, pos.y)
  const hop = Math.abs(Math.sin(tRef.current * 0.13)) * 1.8
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={TW * 0.26} ry={TH * 0.28} fill="rgba(0,0,0,0.2)" />
      <g transform={`translate(${cx},${cy - hop}) scale(${0.64 * face},0.64)`}><AvatarGlyph char={char} /></g>
    </g>
  )
}
