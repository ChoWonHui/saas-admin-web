import { bannerGeom } from './iso'

/** 벽 배너(현수막) — 폴리곤 + 벽 평면에 눕힌 글자. */
export function Banner({ b }) {
  const g = bannerGeom(b.wall, b.f)
  return (
    <g>
      <polygon points={g.points} fill={b.color} stroke="rgba(0,0,0,0.28)" strokeWidth="0.6" />
      {b.text && (
        <text transform={g.matrix} x={g.LW / 2} y={g.LH * 0.64} fontSize="19" fontWeight="800"
          textAnchor="middle" fill="#ffffff" style={{ fontFamily: 'inherit' }}>{b.text}</text>
      )}
    </g>
  )
}
