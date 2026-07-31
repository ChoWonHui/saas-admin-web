import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'

/**
 * 주문관리 화면의 '품절 관리' 모달. 분류별 메뉴를 나열하고 판매중/품절을 즉석에서 전환한다.
 * 바꾸면 손님 메뉴판에 바로 반영된다.
 * api = { getMenu(), setSoldOut(itemId, soldOut) } — 사장님(자기 가게)·관리자(업체별) 양쪽에서 재사용.
 */
export default function SoldOutModal({ api, onClose }) {
  const [cats, setCats] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)     // 전환 중인 itemId
  const [onlySold, setOnlySold] = useState(false)

  useEffect(() => {
    let alive = true
    api.getMenu().then((r) => { if (alive) setCats(r.categories || []) }).catch((e) => setError(e.message))
    return () => { alive = false }
  }, [api])

  async function toggle(item) {
    setBusy(item.id)
    setError('')
    try {
      const r = await api.setSoldOut(item.id, !item.soldOut)
      setCats(r.categories || [])
    } catch (e) { setError(e.message) } finally { setBusy(null) }
  }

  const itemCount = useMemo(() => (cats || []).reduce((s, c) => s + (c.items || []).length, 0), [cats])
  const soldCount = useMemo(
    () => (cats || []).reduce((s, c) => s + (c.items || []).filter((i) => i.soldOut).length, 0), [cats])

  const shown = (cats || [])
    .map((c) => ({ ...c, items: (c.items || []).filter((i) => !onlySold || i.soldOut) }))
    .filter((c) => c.items.length > 0)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal som-modal" onClick={(e) => e.stopPropagation()}>
        <div className="som-head">
          <h3><Icon name="remove_shopping_cart" /> 품절 관리</h3>
          <button className="m-icon-btn" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
        </div>
        <p className="som-sub">품절로 바꾸면 손님 메뉴판에서 바로 ‘품절’로 표시되고 주문할 수 없습니다.</p>

        <div className="som-toolbar">
          <span className="som-count">전체 {itemCount} · <b className="som-count-sold">품절 {soldCount}</b></span>
          <label className="som-filter">
            <input type="checkbox" checked={onlySold} onChange={(e) => setOnlySold(e.target.checked)} />
            품절만 보기
          </label>
        </div>

        <div className="som-body">
          {cats === null ? (
            <div className="som-loading">불러오는 중…</div>
          ) : shown.length === 0 ? (
            <div className="som-empty">
              <Icon name="restaurant_menu" />
              <p>{onlySold ? '품절된 메뉴가 없습니다.' : '등록된 메뉴가 없습니다.'}</p>
            </div>
          ) : shown.map((c) => (
            <div className="som-cat" key={c.id}>
              <div className="som-cat-name">{c.name}</div>
              <ul className="som-list">
                {c.items.map((it) => (
                  <li key={it.id} className={`som-item${it.soldOut ? ' sold' : ''}`}>
                    <span className="som-item-main">
                      <span className="som-item-name">{it.name}</span>
                      <span className="som-item-price">{(it.price ?? 0).toLocaleString()}원</span>
                    </span>
                    <button
                      type="button"
                      className={`som-pill${it.soldOut ? ' sold' : ''}`}
                      disabled={busy === it.id}
                      onClick={() => toggle(it)}
                      title="클릭하면 판매중/품절 전환"
                    >
                      {busy === it.id ? '…' : (
                        <>
                          <Icon name={it.soldOut ? 'block' : 'check_circle'} />
                          {it.soldOut ? '품절' : '판매중'}
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {error && <p className="som-error">{error}</p>}
        <div className="som-foot">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
