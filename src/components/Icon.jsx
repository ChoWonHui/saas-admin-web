// Material Symbols(아이콘 폰트) 헬퍼. index.html 에서 폰트를 불러온다.
export default function Icon({ name, className = '', filled = false }) {
  const style = filled ? { fontVariationSettings: "'FILL' 1" } : undefined
  return (
    <span className={`material-symbols-outlined ${className}`} style={style} aria-hidden="true">
      {name}
    </span>
  )
}
