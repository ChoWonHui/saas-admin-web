import { useCallback, useEffect, useState } from 'react'
import Toast from '../components/Toast'
import { codeApi } from '../api/client'
import Shell from '../components/Shell'

/**
 * 공통코드 관리 — 좌우 2패널(마스터-디테일).
 *  왼쪽: 대분류(그룹) 목록. 클릭하면 선택된다.
 *  오른쪽: 선택된 그룹의 소분류(코드) 목록.
 */
export default function CodesPage() {
  const [groups, setGroups] = useState([])
  const [selected, setSelected] = useState(null) // 선택된 groupCode
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dialog, setDialog] = useState(null)
  const [menu, setMenu] = useState(null) // 우클릭 { x, y, kind: 'group'|'code', group, code }
  const [dragId, setDragId] = useState(null) // 드래그 중인 소분류 id
  const [dropHint, setDropHint] = useState(null) // { id, zone: 'before'|'after' }

  const load = useCallback(async (keepSelected) => {
    setLoading(true)
    setError('')
    try {
      const data = await codeApi.groups()
      setGroups(data)
      // 선택 유지 — 없으면 첫 그룹을 자동 선택
      setSelected((prev) => {
        const keep = keepSelected ?? prev
        if (keep && data.some((g) => g.groupCode === keep)) return keep
        return data[0]?.groupCode ?? null
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 우클릭 메뉴는 바깥 클릭·Esc·스크롤 시 닫는다. (전 화면 공통 규칙)
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

  const currentGroup = groups.find((g) => g.groupCode === selected) ?? null

  async function saved(keepSelected) {
    setDialog(null)
    await load(keepSelected)
  }

  // --- 소분류 드래그앤드랍 순서 변경 ---
  function onDragOverCode(event, target) {
    if (dragId == null || dragId === target.id) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const zone = (event.clientY - rect.top) / rect.height < 0.5 ? 'before' : 'after'
    setDropHint({ id: target.id, zone })
  }

  async function onDropCode(event, target) {
    event.preventDefault()
    const hint = dropHint
    setDropHint(null)
    if (dragId == null || !hint || hint.id !== target.id) return
    const codes = currentGroup.codes
    const siblings = codes.filter((c) => c.id !== dragId)
    const idx = siblings.findIndex((c) => c.id === target.id)
    if (idx < 0) return
    const position = hint.zone === 'before' ? idx : idx + 1
    try {
      await codeApi.moveCode(dragId, position)
      await load(currentGroup.groupCode)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <h2>공통코드</h2>
        <span className="count">{loading ? '' : `${groups.length}개 대분류`}</span>
      </div>

      <Toast message={error} onClose={() => setError('')} />

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <div className="master-detail">
          {/* 좌: 대분류 */}
          <section className="md-master">
            <div className="md-head">
              <h3>대분류</h3>
              <button className="btn-primary btn-sm" onClick={() => setDialog({ mode: 'createGroup' })}>
                + 추가
              </button>
            </div>
            <ul className="md-list">
              {groups.map((group) => (
                <li
                  key={group.groupCode}
                  className={group.groupCode === selected ? 'md-item on' : 'md-item'}
                  onClick={() => setSelected(group.groupCode)}
                  onDoubleClick={() => setDialog({ mode: 'editGroup', group })}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setSelected(group.groupCode)
                    setMenu({ x: e.clientX, y: e.clientY, kind: 'group', group })
                  }}
                >
                  <div className="md-item-main">
                    <span className="md-item-name">{group.name}</span>
                    <span className="md-item-count">{group.codes.length}</span>
                  </div>
                  <span className="mono md-item-sub">{group.groupCode}</span>
                </li>
              ))}
              {groups.length === 0 && <li className="md-empty">대분류가 없습니다. + 추가로 만드세요.</li>}
            </ul>
          </section>

          {/* 우: 소분류 */}
          <section className="md-detail">
            {currentGroup ? (
              <>
                <div className="md-head">
                  <div>
                    <h3>{currentGroup.name} <span className="mono muted">({currentGroup.groupCode})</span></h3>
                    {currentGroup.description && <p className="md-desc">{currentGroup.description}</p>}
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => setDialog({ mode: 'createCode', group: currentGroup })}
                  >
                    + 소분류 추가
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>코드</th>
                        <th>사용</th>
                        <th className="col-grow">순서</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentGroup.codes.map((code) => (
                        <tr
                          key={code.id}
                          className={[
                            'row-clickable',
                            dragId === code.id ? 'dragging' : '',
                            dropHint?.id === code.id ? `drop-${dropHint.zone}` : '',
                          ].filter(Boolean).join(' ')}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('text/plain', String(code.id))
                            setDragId(code.id)
                          }}
                          onDragEnd={() => { setDragId(null); setDropHint(null) }}
                          onDragOver={(e) => onDragOverCode(e, code)}
                          onDragLeave={() => setDropHint((h) => (h?.id === code.id ? null : h))}
                          onDrop={(e) => onDropCode(e, code)}
                          onDoubleClick={() => setDialog({ mode: 'editCode', group: currentGroup, code })}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setMenu({ x: e.clientX, y: e.clientY, kind: 'code', group: currentGroup, code })
                          }}
                        >
                          <td className="strong">
                            <span className="drag-grip">⠿</span>
                            {code.name}
                          </td>
                          <td className="mono muted-cell">{code.code}</td>
                          <td>
                            <span className={`badge ${code.useYn === 'Y' ? 'badge-active' : 'badge-disabled'}`}>
                              {code.useYn === 'Y' ? '사용' : '중지'}
                            </span>
                          </td>
                          <td className="muted-cell">{code.sortOrder}</td>
                        </tr>
                      ))}
                      {currentGroup.codes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="muted-cell">
                            소분류가 없습니다. 오른쪽 위 + 소분류 추가로 만드세요.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="hint left table-hint">
                  행을 끌어 순서를 바꿉니다. 더블클릭 수정 · 우클릭 메뉴. 그룹코드·코드값은 만든 뒤 바꿀 수 없습니다.
                </p>
              </>
            ) : (
              <p className="muted md-placeholder">왼쪽에서 대분류를 선택하세요.</p>
            )}
          </section>
        </div>
      )}

      {menu && (
        <ul
          className="context-menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <li
            onClick={() => {
              setDialog(menu.kind === 'group'
                ? { mode: 'editGroup', group: menu.group }
                : { mode: 'editCode', group: menu.group, code: menu.code })
              setMenu(null)
            }}
          >
            수정
          </li>
          {menu.kind === 'group' && (
            <li onClick={() => { setDialog({ mode: 'createCode', group: menu.group }); setMenu(null) }}>
              소분류 추가
            </li>
          )}
          <li
            className="danger"
            onClick={() => {
              setDialog(menu.kind === 'group'
                ? { mode: 'deleteGroup', group: menu.group }
                : { mode: 'deleteCode', group: menu.group, code: menu.code })
              setMenu(null)
            }}
          >
            삭제
          </li>
        </ul>
      )}

      {dialog && (
        <CodeDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSaved={saved}
          onError={setError}
        />
      )}
    </Shell>
  )
}

function CodeDialog({ dialog, onClose, onSaved, onError }) {
  const { mode, group, code } = dialog
  const [form, setForm] = useState({
    groupCode: group?.groupCode ?? '',
    code: code?.code ?? '',
    name: mode.includes('Group') ? (group?.name ?? '') : (code?.name ?? ''),
    description: group?.description ?? '',
    sortOrder: code?.sortOrder ?? '',
    useYn: code?.useYn ?? 'Y',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // 저장 성공 시 유지할 그룹 — 코드 작업이면 그 그룹을, 그룹 작업이면 그 그룹을 선택 상태로 둔다.
  const keepGroup = group?.groupCode ?? (mode === 'createGroup' ? form.groupCode.trim().toUpperCase() : undefined)

  // 삭제 확인창 — 대상을 반드시 명시한다
  if (mode === 'deleteGroup' || mode === 'deleteCode') {
    const isGroup = mode === 'deleteGroup'
    async function remove() {
      setSaving(true)
      try {
        if (isGroup) await codeApi.removeGroup(group.groupCode)
        else await codeApi.removeCode(code.id)
        await onSaved(isGroup ? undefined : group.groupCode)
      } catch (e) {
        onError(e.message) // 코드가 남은 그룹은 서버가 막는다. 이유를 그대로 띄운다.
        onClose()
      }
    }
    return (
      <Modal title={isGroup ? '대분류 삭제' : '소분류 삭제'} onClose={onClose}>
        <p className="confirm-text">
          <strong>{isGroup ? `${group.name}(${group.groupCode})` : `${code.name}(${code.code})`}</strong>
          {isGroup ? ' 대분류를' : ' 소분류를'} 삭제하시겠습니까?
        </p>
        <p className="hint left">
          {isGroup
            ? '소분류가 남아 있으면 삭제할 수 없습니다.'
            : '과거 데이터가 이 코드를 쓰고 있을 수 있습니다. 지우는 대신 "중지"로 바꾸는 것을 권장합니다.'}
        </p>
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

  const titles = {
    createGroup: '대분류 추가',
    editGroup: `${group?.name} 대분류 수정`,
    createCode: `${group?.name} — 소분류 추가`,
    editCode: `${code?.name} 수정`,
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (mode === 'createGroup') {
        await codeApi.createGroup({
          groupCode: form.groupCode.trim().toUpperCase(),
          name: form.name,
          description: form.description || undefined,
        })
      } else if (mode === 'editGroup') {
        await codeApi.updateGroup(group.groupCode, {
          name: form.name,
          description: form.description || undefined,
        })
      } else if (mode === 'createCode') {
        await codeApi.createCode(group.groupCode, {
          code: form.code.trim().toUpperCase(),
          name: form.name,
          sortOrder: form.sortOrder === '' ? undefined : Number(form.sortOrder),
        })
      } else {
        await codeApi.updateCode(code.id, {
          name: form.name,
          sortOrder: form.sortOrder === '' ? undefined : Number(form.sortOrder),
          useYn: form.useYn,
        })
      }
      await onSaved(keepGroup)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={titles[mode]} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Toast message={error} onClose={() => setError('')} />

        {mode === 'createGroup' && (
          <label className="field">
            <span>그룹코드 (대문자/숫자/_ — 만든 뒤 못 바꿈)</span>
            <input
              value={form.groupCode}
              onChange={(e) => setForm({ ...form, groupCode: e.target.value.toUpperCase() })}
              placeholder="JOB_GRADE"
              maxLength={30}
              required
              autoFocus
            />
          </label>
        )}
        {mode === 'editGroup' && (
          <p className="hint left">
            그룹코드 <span className="mono">{group.groupCode}</span> — 다른 데이터가 이 값으로 대분류를 찾으므로 바꿀 수 없습니다.
          </p>
        )}
        {mode === 'createCode' && (
          <label className="field">
            <span>코드값 (대문자/숫자/_ — 만든 뒤 못 바꿈)</span>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="SENIOR"
              maxLength={30}
              required
              autoFocus
            />
          </label>
        )}
        {mode === 'editCode' && (
          <p className="hint left">
            코드값 <span className="mono">{code.code}</span> — 저장된 데이터가 이 값을 쓰므로 바꿀 수 없습니다.
          </p>
        )}

        <label className="field">
          <span>{mode.includes('Group') ? '대분류명' : '소분류명 (화면에 보이는 이름)'}</span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            maxLength={50}
            required
          />
        </label>

        {mode.includes('Group') ? (
          <label className="field">
            <span>설명 (선택)</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={200}
            />
          </label>
        ) : (
          <div className="field-row">
            <label className="field">
              <span>순서 (비우면 맨 뒤)</span>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                min={1}
              />
            </label>
            {mode === 'editCode' && (
              <label className="field">
                <span>사용 여부</span>
                <select value={form.useYn} onChange={(e) => setForm({ ...form, useYn: e.target.value })}>
                  <option value="Y">사용</option>
                  <option value="N">중지 (선택지에서 제외)</option>
                </select>
              </label>
            )}
          </div>
        )}

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
