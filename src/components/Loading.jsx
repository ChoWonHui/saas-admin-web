// 데이터 로딩 표시 — 빙글 도는 스피너 + 안내 문구. 비어 보여서 오류처럼 느껴지지 않게.
export default function Loading({ label = '불러오는 중…', full = false }) {
  return (
    <div className={`loading-box${full ? ' full' : ''}`}>
      <span className="loading-spinner" aria-hidden="true" />
      <span className="loading-label">{label}</span>
    </div>
  )
}
