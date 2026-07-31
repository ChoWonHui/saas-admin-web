import { useEffect, useState } from 'react'
import { hydrateCatalog } from './components/iso'

// 가게 꾸미기 카탈로그를 불러와 iso.js 선택지를 하이드레이션한다(무인증 공개 엔드포인트).
// 관리 화면에서 항목을 바꾸면 바로 반영되도록, 방을 그리는 컴포넌트가 마운트할 때마다 새로 불러온다.
export function loadCatalog() {
  return fetch('/api/public/decorate/catalog')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { if (data) hydrateCatalog(data) })
    .catch(() => {}) // 실패해도 기본값으로 계속 동작
}

/** 카탈로그를 최신으로 불러온 뒤 준비 여부를 알린다. 방을 그리기 전에 이걸로 기다린다. */
export function useCatalog() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    loadCatalog().finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [])
  return ready
}
