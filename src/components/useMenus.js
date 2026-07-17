import { useEffect, useState } from 'react'
import { menuApi } from '../api/client'

// 상단 메뉴는 모든 화면(Shell)이 쓰는데, 화면을 옮길 때마다 다시 불러오면
// 내비게이션이 매번 깜빡인다. 한 번 받아 모듈에 캐시하고,
// 메뉴 관리 화면이 저장하면 refreshMenus() 로 모든 Shell 에 즉시 반영한다.

let cache = null
let pending = null // 여러 화면이 동시에 마운트돼도 요청은 한 번만 나간다
const listeners = new Set()

function fetchAndBroadcast() {
  if (!pending) {
    pending = menuApi
      .tree()
      .then((tree) => {
        cache = tree
        listeners.forEach((notify) => notify(cache))
        return tree
      })
      .finally(() => {
        pending = null // 실패했으면 cache 가 null 로 남아 다음 마운트가 다시 시도한다
      })
  }
  return pending
}

/** 메뉴를 추가/수정/삭제한 뒤 호출한다. 열려 있는 모든 화면의 상단 메뉴가 갱신된다. */
export function refreshMenus() {
  return fetchAndBroadcast()
}

/** 로그아웃 시 호출 — 다음 로그인 사용자에게 이전 캐시를 보여주지 않는다. */
export function clearMenuCache() {
  cache = null
}

/** 메뉴 트리를 평평하게 편다. url→메뉴 매칭(라우트 가드)에 쓴다. */
export function flattenMenus(tree, acc = []) {
  for (const node of tree) {
    acc.push(node)
    flattenMenus(node.children ?? [], acc)
  }
  return acc
}

export function useMenus() {
  const [menus, setMenus] = useState(cache ?? [])

  useEffect(() => {
    listeners.add(setMenus)
    if (cache) {
      setMenus(cache)
    } else {
      // 실패해도 콘솔은 떠야 한다 — Shell 이 기본 메뉴로 대신 그린다.
      fetchAndBroadcast().catch(() => {})
    }
    return () => listeners.delete(setMenus)
  }, [])

  return menus
}
