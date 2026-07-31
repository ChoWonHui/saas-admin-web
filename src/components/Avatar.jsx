import { shade, HAIR_DESIGNS, HAT_DESIGNS } from './iso'

// 카탈로그에 없을 때의 기본 머리 디자인.
const BUILTIN_HAIR = { short: { type: 'fringe' }, bob: { type: 'mass', len: -41 }, long: { type: 'mass', len: -27 }, bald: { type: 'bald' } }
function resolveHair(styleKey, override) {
  return override || (HAIR_DESIGNS && HAIR_DESIGNS[styleKey]) || BUILTIN_HAIR[styleKey] || { type: 'fringe' }
}
const BUILTIN_HAT = { none: { type: 'preset', preset: 'none' }, chef: { type: 'preset', preset: 'chef' }, cap: { type: 'preset', preset: 'cap' }, beanie: { type: 'preset', preset: 'beanie' } }
function resolveHat(hatKey, override) {
  return override || (HAT_DESIGNS && HAT_DESIGNS[hatKey]) || BUILTIN_HAT[hatKey] || { type: 'preset', preset: 'none' }
}

// 머리 경로(그림판 프리로드와 공유). len 이 클수록(0에 가까움) 더 길다.
export function hairMassD(len) {
  const L = Math.max(-46, Math.min(-16, len ?? -34))
  return `M0,-78 C12,-78 18,-70 18,-59 C18,-50 16.5,${L} 13.5,${L} Q11,${L - 4} 10,${L - 7} L10,-46 Q6,-44 0,-44 Q-6,-44 -10,-46 L-10,${L - 7} Q-11,${L - 4} -13.5,${L} C-16.5,${L} -18,-50 -18,-59 C-18,-70 -12,-78 0,-78 Z`
}
export const FRINGE_D = 'M-14.5,-61 q0,-17 14.5,-17 q14.5,0 14.5,17 q-3.5,-9 -14.5,-9 q-11,0 -14.5,9 z'
export const BALD_D = 'M-13,-65 q13,-8 26,0 q-6,-4 -13,-4 q-7,0 -13,4 z'

// 프리셋 모자를 아바타 좌표로 그린 SVG data URL(그림판 프리로드용). viewBox = 이미지 박스.
export function hatPresetSvgUrl(preset, outfit = '#4a90d9') {
  let inner
  if (preset === 'chef') {
    inner = '<g fill="#d5dae2"><rect x="-13" y="-73.9" width="26" height="9.8" rx="3.6"/><circle cx="-8" cy="-78" r="7.5"/><circle cx="8" cy="-78" r="7.5"/><circle cx="0" cy="-81.4" r="8.6"/><ellipse cx="0" cy="-75" rx="14.1" ry="7"/></g>'
      + '<rect x="-12" y="-73" width="24" height="8" rx="3" fill="#fff"/><circle cx="-8" cy="-78" r="6.5" fill="#fff"/><circle cx="8" cy="-78" r="6.5" fill="#fff"/><circle cx="0" cy="-81" r="7.5" fill="#fff"/><ellipse cx="0" cy="-75" rx="13" ry="6" fill="#fff"/>'
      + '<line x1="-11" y1="-73.2" x2="11" y2="-73.2" stroke="#e3e7ee" stroke-width="0.8"/>'
  } else if (preset === 'cap') {
    inner = `<path d="M-14.5,-71 q14.5,-11 29,0 q-14.5,-5 -29,0 z" fill="${outfit}"/><ellipse cx="8" cy="-69" rx="10" ry="3.2" fill="${shade(outfit, -0.12)}"/>`
  } else if (preset === 'beanie') {
    inner = '<path d="M-13,-67 q13,-15 26,0 z" fill="#5aa9e0"/><rect x="-13" y="-68" width="26" height="4.5" rx="2" fill="#fff" opacity="0.85"/>'
  } else return ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="-24 -90 48 64">${inner}</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

/** 얼굴 뒤로 흘러내리는 머리카락 — 양옆으로 내려오고 가운데(앞치마)는 열어둔다. 얼굴은 이 위에 그려짐. */
function HairMass({ color, len }) {
  return <path d={hairMassD(len)} fill={color} />
}

/** 사장님 캐릭터(미니미) — 발이 (0,0), 위로 그린다. hairDesign 을 주면 그 디자인으로 미리보기. */
export function AvatarGlyph({ char: c, hairDesign, hatDesign }) {
  const pants = '#39404d'
  const apron = '#f4f1ea'
  const hair = resolveHair(c.hairStyle, hairDesign)
  const hatD = resolveHat(c.hat, hatDesign)
  const hatPreset = hatD.type === 'image' ? null : hatD.preset
  return (
    <g>
      {/* 다리·신발 */}
      <rect x="-8.5" y="-22" width="6.5" height="22" rx="3" fill={pants} />
      <rect x="2" y="-22" width="6.5" height="22" rx="3" fill={pants} />
      <ellipse cx="-5.2" cy="0" rx="5" ry="2.6" fill="#2a2f38" />
      <ellipse cx="5.2" cy="0" rx="5" ry="2.6" fill="#2a2f38" />
      {/* 몸통·팔 */}
      <rect x="-14" y="-49" width="28" height="31" rx="9" fill={c.outfit} />
      <rect x="-19.5" y="-47" width="7.5" height="23" rx="3.7" fill={c.outfit} />
      <rect x="12" y="-47" width="7.5" height="23" rx="3.7" fill={c.outfit} />
      <circle cx="-15.7" cy="-25" r="3.6" fill={c.skin} />
      <circle cx="15.7" cy="-25" r="3.6" fill={c.skin} />
      {/* 머리카락(길게 흘러내리는 형태) — 몸통 위·얼굴 아래 */}
      {hair.type === 'mass' && <HairMass color={c.hairColor} len={hair.len} />}
      {/* 앞치마 */}
      {c.apron && <>
        <rect x="-9.5" y="-45" width="19" height="27" rx="5" fill={apron} />
        <path d="M-5,-49 l5,4 l5,-4" stroke={apron} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </>}
      {/* 목 */}
      <rect x="-4" y="-53" width="8" height="8" fill={c.skin} />
      {/* 귀·머리 */}
      <circle cx="-13.5" cy="-59" r="3" fill={c.skin} />
      <circle cx="13.5" cy="-59" r="3" fill={c.skin} />
      <circle cx="0" cy="-60" r="14.5" fill={c.skin} />
      {/* 업로드한 머리 이미지 — 머리 위에, 얼굴 이목구비 아래(눈·입은 위에 그려져 항상 보임) */}
      {hair.type === 'image' && hair.url &&
        <image href={hair.url} x="-24" y="-90" width="48" height="64" preserveAspectRatio="xMidYMid meet" />}
      {/* 얼굴 */}
      <circle cx="-8.5" cy="-56" r="2.3" fill="#f2a0a0" opacity="0.5" />
      <circle cx="8.5" cy="-56" r="2.3" fill="#f2a0a0" opacity="0.5" />
      <circle cx="-5" cy="-60" r="1.8" fill="#3a2f2a" />
      <circle cx="5" cy="-60" r="1.8" fill="#3a2f2a" />
      <path d="M-4.5,-54.5 q4.5,4 9,0" stroke="#b0654a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* 앞머리(헤어라인) — 파라미터형만. 이미지·민머리는 제외 */}
      {hair.type !== 'bald' && hair.type !== 'image' && <path d={FRINGE_D} fill={c.hairColor} />}
      {hair.type === 'bald' && <path d={BALD_D} fill={c.hairColor} opacity="0.85" />}
      {/* 모자 — 이미지형이면 업로드/그린 이미지, 아니면 프리셋 */}
      {hatD.type === 'image' && hatD.url &&
        <image href={hatD.url} x="-24" y="-90" width="48" height="64" preserveAspectRatio="xMidYMid meet" />}
      {hatPreset === 'chef' && <>
        {/* 흰 배경에서도 보이도록 뒤에 옅은 회색 실루엣(외곽선) */}
        <g fill="#d5dae2">
          <rect x="-13" y="-73.9" width="26" height="9.8" rx="3.6" />
          <circle cx="-8" cy="-78" r="7.5" />
          <circle cx="8" cy="-78" r="7.5" />
          <circle cx="0" cy="-81.4" r="8.6" />
          <ellipse cx="0" cy="-75" rx="14.1" ry="7" />
        </g>
        <rect x="-12" y="-73" width="24" height="8" rx="3" fill="#ffffff" />
        <circle cx="-8" cy="-78" r="6.5" fill="#ffffff" />
        <circle cx="8" cy="-78" r="6.5" fill="#ffffff" />
        <circle cx="0" cy="-81" r="7.5" fill="#ffffff" />
        <ellipse cx="0" cy="-75" rx="13" ry="6" fill="#ffffff" />
        {/* 챙과 부풀린 부분 구분선 */}
        <line x1="-11" y1="-73.2" x2="11" y2="-73.2" stroke="#e3e7ee" strokeWidth="0.8" />
      </>}
      {hatPreset === 'cap' && <>
        <path d="M-14.5,-71 q14.5,-11 29,0 q-14.5,-5 -29,0 z" fill={c.outfit} />
        <ellipse cx="8" cy="-69" rx="10" ry="3.2" fill={shade(c.outfit, -0.12)} />
      </>}
      {hatPreset === 'beanie' && <>
        <path d="M-13,-67 q13,-15 26,0 z" fill="#5aa9e0" />
        <rect x="-13" y="-68" width="26" height="4.5" rx="2" fill="#ffffff" opacity="0.85" />
      </>}
    </g>
  )
}

export default function Avatar({ char, className, hairDesign, hatDesign }) {
  return (
    <svg viewBox="-25 -92 50 96" className={className} aria-label="사장님 캐릭터">
      <AvatarGlyph char={char} hairDesign={hairDesign} hatDesign={hatDesign} />
    </svg>
  )
}
