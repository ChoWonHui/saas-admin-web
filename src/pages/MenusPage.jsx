import { useCallback, useEffect, useRef, useState } from 'react'
import Toast from '../components/Toast'
import { menuApi } from '../api/client'
import Shell from '../components/Shell'
import { refreshMenus } from '../components/useMenus'

/**
 * 트리를 표 행으로 편다. 접힌 상위의 하위는 행을 만들지 않는다.
 * 드래그앤드랍 계산을 위해 각 행에 depth / parentId / hasChildren 을 함께 담는다.
 */
function flatten(tree, collapsed) {
  const rows = []
  for (const top of tree) {
    rows.push({ ...top, depth: 0, hasChildren: (top.children?.length ?? 0) > 0 })
    if (!collapsed.has(top.id)) {
      for (const child of top.children ?? []) {
        rows.push({ ...child, depth: 1, parentName: top.name, hasChildren: false })
      }
    }
  }
  return rows
}

/**
 * 드랍 위치 → 서버 move 요청(parentId, position) 계산.
 * 규칙에 어긋나는 자리(3단이 되는 곳, 자기 자신 밑)는 null 을 돌려줘 드랍 자체를 막는다.
 */
function computeDrop(dragRow, target, zone, tree) {
  if (!dragRow || dragRow.id === target.id) return null

  if (zone === 'into') {
    // 상위 메뉴 위에 겹치면 그 밑으로 들어간다 (맨 뒤에 붙는다)
    if (target.depth !== 0 || dragRow.hasChildren) return null
    const kids = (tree.find((t) => t.id === target.id)?.children ?? []).filter((c) => c.id !== dragRow.id)
    return { parentId: target.id, position: kids.length }
  }

  const parentId = target.depth === 0 ? null : target.parentId
  if (parentId != null && dragRow.hasChildren) return null // 하위를 거느린 채 남의 밑으로 = 3단
  if (parentId === dragRow.id) return null // 자기 자신 밑으로

  const siblings = (parentId == null ? tree : (tree.find((t) => t.id === parentId)?.children ?? []))
    .filter((s) => s.id !== dragRow.id)
  const idx = siblings.findIndex((s) => s.id === target.id)
  if (idx < 0) return null
  return { parentId, position: zone === 'before' ? idx : idx + 1 }
}

export default function MenusPage() {
  const [tree, setTree] = useState([])
  const [collapsed, setCollapsed] = useState(() => new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dialog, setDialog] = useState(null) // { mode: 'create' | 'edit' | 'delete', item, parentId }
  const [menu, setMenu] = useState(null) // 우클릭 메뉴 { x, y, item }
  const [dragId, setDragId] = useState(null)
  const [dropHint, setDropHint] = useState(null) // { id, zone: 'before' | 'after' | 'into' }
  const tbodyRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTree(await menuApi.tree())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 우클릭 메뉴는 바깥 클릭·Esc·스크롤 시 닫는다. (AdminsPage 와 동일한 규칙)
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const rows = flatten(tree, collapsed)
  const topLevel = tree

  function toggleCollapse(id) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function saved() {
    setDialog(null)
    await load()
    await refreshMenus() // 상단 내비게이션에 즉시 반영
  }

  // --- 드래그앤드랍 (포인터 기반 — 네이티브 HTML5 DnD 대신. 마우스·터치·모든 브라우저에서 동작) ---

  // 드래그 손잡이(⠿)를 누르면 시작. rows/tree 를 그 시점 스냅샷으로 클로저에 담는다(드래그 중엔 안 바뀜).
  function startPointerDrag(e, row) {
    if (e.button != null && e.button !== 0) return // 좌클릭만
    e.preventDefault()
    e.stopPropagation()
    const dragRowNow = row
    setDragId(row.id)
    let currentDrop = null

    const move = (ev) => {
      const rowEls = tbodyRef.current ? [...tbodyRef.current.querySelectorAll('tr[data-id]')] : []
      let matched = false
      for (const el of rowEls) {
        const rc = el.getBoundingClientRect()
        if (ev.clientY >= rc.top && ev.clientY <= rc.bottom) {
          const id = Number(el.getAttribute('data-id'))
          const target = rows.find((r) => r.id === id)
          if (target) {
            const ratio = (ev.clientY - rc.top) / rc.height
            const zone = target.depth === 0
              ? (ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'into')
              : (ratio < 0.5 ? 'before' : 'after')
            const drop = computeDrop(dragRowNow, target, zone, tree)
            currentDrop = drop
            setDropHint(drop ? { id, zone } : null)
          }
          matched = true
          break
        }
      }
      if (!matched) { currentDrop = null; setDropHint(null) }
    }

    const up = async () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.classList.remove('menu-dragging')
      setDragId(null)
      setDropHint(null)
      const drop = currentDrop
      if (!drop) return
      try {
        await menuApi.move(dragRowNow.id, drop)
        if (drop.parentId != null) {
          setCollapsed((prev) => { const next = new Set(prev); next.delete(drop.parentId); return next })
        }
        await load()
        await refreshMenus()
      } catch (err) {
        setError(err.message)
      }
    }

    document.body.classList.add('menu-dragging')
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <Shell>
      <div className="page-head">
        <h2>메뉴 관리</h2>
        <span className="count">{loading ? '' : `${rows.length}개`}</span>
        <div className="page-actions">
          <button className="btn-primary btn-sm" onClick={() => setDialog({ mode: 'create' })}>
            + 메뉴 추가
          </button>
        </div>
      </div>

      <Toast message={error} onClose={() => setError('')} />

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>메뉴명</th>
                  <th className="col-grow">URL</th>
                  <th>위치</th>
                  <th>순서</th>
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    data-id={row.id}
                    className={[
                      'row-clickable',
                      dragId === row.id ? 'dragging' : '',
                      dropHint?.id === row.id ? `drop-${dropHint.zone}` : '',
                    ].filter(Boolean).join(' ')}
                    onDoubleClick={() => setDialog({ mode: 'edit', item: row })}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setMenu({ x: e.clientX, y: e.clientY, item: row })
                    }}
                  >
                    <td className="strong">
                      <span className="tree-cell" style={{ paddingLeft: row.depth * 22 }}>
                        {row.depth === 0 && row.hasChildren ? (
                          <button
                            type="button"
                            className="tree-toggle"
                            aria-expanded={!collapsed.has(row.id)}
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleCollapse(row.id)
                            }}
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            <span className={`chev${collapsed.has(row.id) ? '' : ' open'}`}>▸</span>
                          </button>
                        ) : (
                          <span className="tree-toggle-slot" />
                        )}
                        <span className="drag-grip" title="끌어서 순서 변경" onPointerDown={(e) => startPointerDrag(e, row)}>⠿</span>
                        {row.name}
                      </span>
                    </td>
                    <td className="mono muted-cell">{row.url ?? '-'}</td>
                    <td className="muted-cell">{row.depth === 0 ? '최상위' : row.parentName}</td>
                    <td className="muted-cell">{row.sortOrder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint left table-hint">
            행을 끌어 순서를 바꾸고, 상위 메뉴 위에 겹치면 그 밑으로 들어갑니다. 더블클릭 수정 · 우클릭 메뉴.
          </p>
        </>
      )}

      {menu && (
        <ul
          className="context-menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <li onClick={() => { setDialog({ mode: 'edit', item: menu.item }); setMenu(null) }}>수정</li>
          {menu.item.depth === 0 && (
            <li onClick={() => { setDialog({ mode: 'create', parentId: menu.item.id }); setMenu(null) }}>
              하위 메뉴 추가
            </li>
          )}
          <li
            className="danger"
            onClick={() => { setDialog({ mode: 'delete', item: menu.item }); setMenu(null) }}
          >
            삭제
          </li>
        </ul>
      )}

      {dialog && (
        <MenuDialog
          dialog={dialog}
          topLevel={topLevel}
          onClose={() => setDialog(null)}
          onSaved={saved}
          onError={setError}
        />
      )}
    </Shell>
  )
}

function MenuDialog({ dialog, topLevel, onClose, onSaved, onError }) {
  const { mode, item, parentId } = dialog
  const [form, setForm] = useState({
    name: item?.name ?? '',
    url: item?.url ?? '',
    parentId: item?.parentId ?? parentId ?? '',
    sortOrder: item?.sortOrder ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // 삭제 확인창 — 대상을 반드시 명시한다
  if (mode === 'delete') {
    async function remove() {
      setSaving(true)
      try {
        await menuApi.remove(item.id)
        await onSaved()
      } catch (e) {
        // 하위 메뉴가 있으면 서버가 막는다. 그 이유를 목록 화면에 그대로 띄운다.
        onError(e.message)
        onClose()
      }
    }
    return (
      <Modal title="메뉴 삭제" onClose={onClose}>
        <p className="confirm-text">
          <strong>{item.name}</strong> 메뉴를 삭제하시겠습니까?
        </p>
        <p className="hint left">삭제하면 상단 메뉴에서 즉시 사라집니다. 하위 메뉴가 있으면 먼저 삭제해야 합니다.</p>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn-primary btn-danger-solid" onClick={remove} disabled={saving}>
            {saving ? '처리 중…' : '삭제'}
          </button>
        </div>
      </Modal>
    )
  }

  // 자기 자신을 상위로 고를 수 없다. (하위를 거느린 메뉴를 남의 밑에 넣는 것은 서버가 2단 제한으로 막는다)
  const parentOptions = topLevel.filter((t) => t.id !== item?.id)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const body = {
        name: form.name,
        url: form.url || undefined,
        parentId: form.parentId === '' ? undefined : Number(form.parentId),
        sortOrder: form.sortOrder === '' ? undefined : Number(form.sortOrder),
      }
      if (mode === 'create') await menuApi.create(body)
      else await menuApi.update(item.id, body)
      await onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={mode === 'create' ? '메뉴 추가' : `${item.name} 수정`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Toast message={error} onClose={() => setError('')} />

        <label className="field">
          <span>위치</span>
          <select
            value={form.parentId}
            onChange={(e) => setForm({ ...form, parentId: e.target.value })}
          >
            <option value="">최상위</option>
            {parentOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} 아래
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>메뉴명</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={50}
            required
            autoFocus
          />
        </label>

        <label className="field">
          <span>URL</span>
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="/tenants 또는 https://…"
            maxLength={200}
          />
        </label>

        <label className="field">
          <span>순서 (작을수록 앞, 비우면 맨 뒤)</span>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            min={1}
          />
        </label>

        <p className="hint left">
          URL 없이 저장하면 하위 메뉴를 묶는 제목이 됩니다. <span className="mono">/경로</span> 는 콘솔 안에서
          이동하고, <span className="mono">https://…</span> 는 새 탭으로 엽니다.
        </p>

        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}
