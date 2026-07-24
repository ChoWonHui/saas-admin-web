import { useCallback, useEffect, useState } from 'react'
import Toast from '../components/Toast'
import { calendarPermApi, codeApi, menuApi, orgApi, permissionApi } from '../api/client'
import Shell from '../components/Shell'

// 달력 권한 6종: 범위(전체/팀/개인) × 액션(보기/작성)
const CAL_SCOPES = [
  { key: 'ALL', label: '전사일정' },
  { key: 'TEAM', label: '팀별일정' },
  { key: 'PERSONAL', label: '개인일정' },
]

function flattenMenu(tree, depth = 0, parentId = null, acc = []) {
  for (const node of tree) {
    acc.push({ id: node.id, name: node.name, url: node.url, depth, parentId })
    flattenMenu(node.children ?? [], depth + 1, node.id, acc)
  }
  return acc
}
function flattenOrg(tree, depth = 0, acc = []) {
  for (const node of tree) {
    acc.push({ id: node.id, name: node.name, orgCode: node.orgCode, depth })
    flattenOrg(node.children ?? [], depth + 1, acc)
  }
  return acc
}

export default function PermissionsPage() {
  const [orgs, setOrgs] = useState([])
  const [titles, setTitles] = useState([])
  const [menuRows, setMenuRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [topTab, setTopTab] = useState('MENU') // 'MENU'(메뉴 권한) | 'CALENDAR'(달력 권한)
  const [selectedOrg, setSelectedOrg] = useState(null) // 조직 id
  const [subTab, setSubTab] = useState('DEPT') // 'DEPT'(부서 기본) | 'TITLE'(직책별)
  const [deptChecked, setDeptChecked] = useState(() => new Set()) // 부서 허용 메뉴 (상한선)
  const [selectedTitle, setSelectedTitle] = useState('')
  const [titleChecked, setTitleChecked] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    Promise.all([orgApi.chart(), codeApi.groups(), menuApi.tree()])
      .then(([chart, groups, menus]) => {
        setOrgs(flattenOrg(chart))
        const jt = groups.find((g) => g.groupCode === 'JOB_TITLE')
        setTitles((jt?.codes ?? []).filter((c) => c.useYn === 'Y').map((c) => c.name))
        setMenuRows(flattenMenu(menus))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // 부서 선택 → 부서 기본 권한 로드
  const selectOrg = useCallback(async (orgId) => {
    setSelectedOrg(orgId)
    setSubTab('DEPT')
    setSelectedTitle('')
    setTitleChecked(new Set())
    setNote('')
    try {
      const ids = await permissionApi.get('DEPT', String(orgId))
      setDeptChecked(new Set(ids))
    } catch (e) {
      setError(e.message)
    }
  }, [])

  // 직책 선택 → 그 (부서,직책) 권한 로드
  async function selectTitle(title) {
    setSelectedTitle(title)
    setNote('')
    if (!title) {
      setTitleChecked(new Set())
      return
    }
    try {
      const ids = await permissionApi.get('DEPT_TITLE', `${selectedOrg}:${title}`)
      setTitleChecked(new Set(ids))
    } catch (e) {
      setError(e.message)
    }
  }

  // 트리 연동용: 조상(부모→…→루트)과 자손(모든 하위) 목록
  const menuById = Object.fromEntries(menuRows.map((m) => [m.id, m]))
  function ancestorsOf(id) {
    const res = []
    let cur = menuById[id]?.parentId
    while (cur != null) { res.push(cur); cur = menuById[cur]?.parentId }
    return res
  }
  function descendantsOf(id) {
    const res = []
    const stack = menuRows.filter((m) => m.parentId === id).map((m) => m.id)
    while (stack.length) {
      const cur = stack.pop()
      res.push(cur)
      menuRows.filter((m) => m.parentId === cur).forEach((m) => stack.push(m.id))
    }
    return res
  }

  const childIdsOf = (id) => menuRows.filter((m) => m.parentId === id).map((m) => m.id)
  // 해제 후, 자식이 하나도 안 남은 상위는 위로 거슬러 올라가며 함께 해제한다.
  function pruneEmptyAncestors(set, id) {
    let parent = menuById[id]?.parentId
    while (parent != null) {
      const kids = childIdsOf(parent)
      if (kids.length > 0 && kids.every((k) => !set.has(k))) {
        set.delete(parent)
        parent = menuById[parent]?.parentId
      } else break
    }
  }

  // 하위를 체크하면 상위(조상)도 함께 체크 — 상위 없이 하위만 선택되는 일이 없다.
  // 상위를 해제하면 하위(자손)도 함께 해제. 반대로 하위가 전부 빠지면 상위도 자동 해제.
  function toggleDept(id) {
    setDeptChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        descendantsOf(id).forEach((d) => next.delete(d))
        pruneEmptyAncestors(next, id)
      } else {
        next.add(id)
        ancestorsOf(id).forEach((a) => next.add(a))
      }
      return next
    })
  }
  function toggleTitle(id) {
    if (!deptChecked.has(id)) return // 부서가 허용 안 한 메뉴는 못 고른다
    setTitleChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        descendantsOf(id).forEach((d) => next.delete(d))
        pruneEmptyAncestors(next, id)
      } else {
        next.add(id)
        // 조상도 함께 — 단 부서가 허용한 범위 안에서만
        ancestorsOf(id).filter((a) => deptChecked.has(a)).forEach((a) => next.add(a))
      }
      return next
    })
  }

  async function saveDept() {
    setSaving(true); setError(''); setNote('')
    try {
      await permissionApi.put('DEPT', String(selectedOrg), [...deptChecked])
      setNote('부서 권한을 저장했습니다.')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }
  async function saveTitle() {
    setSaving(true); setError(''); setNote('')
    try {
      await permissionApi.put('DEPT_TITLE', `${selectedOrg}:${selectedTitle}`, [...titleChecked])
      setNote('직책 권한을 저장했습니다.')
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  // 화면 접근 통제는 메뉴 권한(라우트 가드)이 한다 — 여기서 슈퍼 여부로 다시 막지 않는다.
  // 권한 없는 사람이 직접 URL 로 들어와도 App 의 RequireAuth 가 대시보드로 돌려보내고,
  // 설령 도달해도 서버가 ACCESS_DENIED 를 돌려준다.

  const orgName = orgs.find((o) => o.id === selectedOrg)?.name

  return (
    <Shell>
      <div className="page-head">
        <h2>권한 관리</h2>
        <div className="page-actions">
          <div className="perm-tabs">
            <button className={topTab === 'MENU' ? 'on' : ''} onClick={() => setTopTab('MENU')}>메뉴 권한</button>
            <button className={topTab === 'CALENDAR' ? 'on' : ''} onClick={() => setTopTab('CALENDAR')}>달력 권한</button>
          </div>
        </div>
      </div>

      <Toast message={error} onClose={() => setError('')} />

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : topTab === 'CALENDAR' ? (
        <CalendarPermSection orgs={orgs} titles={titles} onError={setError} />
      ) : (
        <div className="master-detail">
          {/* 좌: 부서 */}
          <section className="md-master">
            <div className="md-head"><h3>부서</h3></div>
            <ul className="md-list">
              {orgs.map((o) => (
                <li
                  key={o.id}
                  className={o.id === selectedOrg ? 'md-item on' : 'md-item'}
                  onClick={() => selectOrg(o.id)}
                  style={{ paddingLeft: 10 + o.depth * 14 }}
                >
                  <div className="md-item-main"><span className="md-item-name">{o.name}</span></div>
                  {o.orgCode && <span className="mono md-item-sub">{o.orgCode}</span>}
                </li>
              ))}
            </ul>
          </section>

          {/* 우: 부서 기본 / 직책별 */}
          <section className="md-detail">
            {selectedOrg == null ? (
              <p className="muted md-placeholder">왼쪽에서 부서를 선택하세요.</p>
            ) : (
              <>
                <div className="md-head">
                  <div>
                    <h3>{orgName}</h3>
                    <p className="md-desc">부서 기본이 상한선입니다. 직책은 그 안에서만 좁힐 수 있습니다.</p>
                  </div>
                  <div className="perm-tabs">
                    <button className={subTab === 'DEPT' ? 'on' : ''} onClick={() => setSubTab('DEPT')}>부서 기본</button>
                    <button className={subTab === 'TITLE' ? 'on' : ''} onClick={() => setSubTab('TITLE')}>직책별</button>
                  </div>
                </div>

                {note && <p className="notice perm-saved">{note}</p>}

                {subTab === 'DEPT' ? (
                  <>
                    <div className="perm-bar">
                      <span className="hint left">이 부서 사원이 접근할 수 있는 메뉴</span>
                      <button className="btn-primary btn-sm" onClick={saveDept} disabled={saving}>
                        {saving ? '저장 중…' : '💾 저장'}
                      </button>
                    </div>
                    <ul className="perm-menu-list">
                      {menuRows.map((m) => (
                        <li key={m.id} className="perm-menu-item" style={{ paddingLeft: 14 + m.depth * 22 }}>
                          <label className="check">
                            <input type="checkbox" checked={deptChecked.has(m.id)} onChange={() => toggleDept(m.id)} />
                            {m.name}
                            {m.url && <span className="mono perm-menu-url">{m.url}</span>}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <div className="perm-bar">
                      <select value={selectedTitle} onChange={(e) => selectTitle(e.target.value)} className="dept-select">
                        <option value="">직책 선택…</option>
                        {titles.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button className="btn-primary btn-sm" onClick={saveTitle} disabled={saving || !selectedTitle}>
                        {saving ? '저장 중…' : '💾 저장'}
                      </button>
                    </div>
                    {selectedTitle ? (
                      <ul className="perm-menu-list">
                        {menuRows.map((m) => {
                          const inDept = deptChecked.has(m.id)
                          return (
                            <li
                              key={m.id}
                              className={`perm-menu-item${inDept ? '' : ' disabled'}`}
                              style={{ paddingLeft: 14 + m.depth * 22 }}
                              title={inDept ? undefined : '부서 기본에서 허용되지 않은 메뉴입니다'}
                            >
                              <label className="check">
                                <input
                                  type="checkbox"
                                  checked={titleChecked.has(m.id)}
                                  disabled={!inDept}
                                  onChange={() => toggleTitle(m.id)}
                                />
                                {m.name}
                                {m.url && <span className="mono perm-menu-url">{m.url}</span>}
                                {!inDept && <span className="perm-locked">부서 미허용</span>}
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="muted md-placeholder">직책을 선택하세요. 부서 기본에서 허용한 메뉴만 고를 수 있습니다.</p>
                    )}
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </Shell>
  )
}

/** 달력 권한 탭 — 부서(상한) → 직책(좁힘)으로 범위별 보기/작성 6종을 관리한다. */
function CalendarPermSection({ orgs, titles, onError }) {
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [subTab, setSubTab] = useState('DEPT') // DEPT | TITLE
  const [deptKeys, setDeptKeys] = useState(() => new Set()) // 부서 허용 (상한선)
  const [selectedTitle, setSelectedTitle] = useState('')
  const [titleKeys, setTitleKeys] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')

  const selectOrg = useCallback(async (orgId) => {
    setSelectedOrg(orgId); setSubTab('DEPT'); setSelectedTitle(''); setTitleKeys(new Set()); setNote('')
    try {
      const keys = await calendarPermApi.get('DEPT', String(orgId))
      setDeptKeys(new Set(keys))
    } catch (e) { onError(e.message) }
  }, [onError])

  async function selectTitle(title) {
    setSelectedTitle(title); setNote('')
    if (!title) { setTitleKeys(new Set()); return }
    try {
      const keys = await calendarPermApi.get('DEPT_TITLE', `${selectedOrg}:${title}`)
      setTitleKeys(new Set(keys))
    } catch (e) { onError(e.message) }
  }

  const permKey = (scope, action) => `${scope}_${action}` // ALL_VIEW 등
  function toggleDept(k) {
    setDeptKeys((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  }
  function toggleTitle(k) {
    if (!deptKeys.has(k)) return // 부서가 허용 안 한 범위는 못 준다
    setTitleKeys((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })
  }

  async function saveDept() {
    setSaving(true); setNote('')
    try { await calendarPermApi.put('DEPT', String(selectedOrg), [...deptKeys]); setNote('부서 달력 권한을 저장했습니다.') }
    catch (e) { onError(e.message) } finally { setSaving(false) }
  }
  async function saveTitle() {
    setSaving(true); setNote('')
    try { await calendarPermApi.put('DEPT_TITLE', `${selectedOrg}:${selectedTitle}`, [...titleKeys]); setNote('직책 달력 권한을 저장했습니다.') }
    catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  const orgName = orgs.find((o) => o.id === selectedOrg)?.name
  const isDept = subTab === 'DEPT'
  const active = isDept ? deptKeys : titleKeys
  const toggle = isDept ? toggleDept : toggleTitle

  return (
    <div className="master-detail">
      <section className="md-master">
        <div className="md-head"><h3>부서</h3></div>
        <ul className="md-list">
          {orgs.map((o) => (
            <li key={o.id} className={o.id === selectedOrg ? 'md-item on' : 'md-item'}
                onClick={() => selectOrg(o.id)} style={{ paddingLeft: 10 + o.depth * 14 }}>
              <div className="md-item-main"><span className="md-item-name">{o.name}</span></div>
              {o.orgCode && <span className="mono md-item-sub">{o.orgCode}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="md-detail">
        {selectedOrg == null ? (
          <p className="muted md-placeholder">왼쪽에서 부서를 선택하세요.</p>
        ) : (
          <>
            <div className="md-head">
              <div>
                <h3>{orgName} <span className="muted">— 달력 권한</span></h3>
                <p className="md-desc">부서 기본이 상한선입니다. 직책은 그 안에서만 좁힐 수 있습니다.</p>
              </div>
              <div className="perm-tabs">
                <button className={isDept ? 'on' : ''} onClick={() => setSubTab('DEPT')}>부서 기본</button>
                <button className={!isDept ? 'on' : ''} onClick={() => setSubTab('TITLE')}>직책별</button>
              </div>
            </div>

            {note && <p className="notice perm-saved">{note}</p>}

            {!isDept && (
              <div className="perm-bar">
                <select value={selectedTitle} onChange={(e) => selectTitle(e.target.value)} className="dept-select">
                  <option value="">직책 선택…</option>
                  {titles.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn-primary btn-sm" onClick={saveTitle} disabled={saving || !selectedTitle}>
                  {saving ? '저장 중…' : '💾 저장'}
                </button>
              </div>
            )}
            {isDept && (
              <div className="perm-bar">
                <span className="hint left">이 부서 사원이 다룰 수 있는 일정 범위</span>
                <button className="btn-primary btn-sm" onClick={saveDept} disabled={saving}>
                  {saving ? '저장 중…' : '💾 저장'}
                </button>
              </div>
            )}

            {(!isDept && !selectedTitle) ? (
              <p className="muted md-placeholder">직책을 선택하세요. 부서 기본에서 허용한 범위만 고를 수 있습니다.</p>
            ) : (
              <table className="table cal-perm-table">
                <thead>
                  <tr><th>범위</th><th>보기</th><th>작성</th></tr>
                </thead>
                <tbody>
                  {CAL_SCOPES.map((s) => (
                    <tr key={s.key}>
                      <td className="strong">{s.label}</td>
                      {['VIEW', 'WRITE'].map((action) => {
                        const k = permKey(s.key, action)
                        const inDept = deptKeys.has(k)
                        const disabled = !isDept && !inDept
                        return (
                          <td key={action}>
                            <label className="check">
                              <input type="checkbox" checked={active.has(k)} disabled={disabled}
                                     onChange={() => toggle(k)} />
                              {disabled && <span className="perm-locked">부서 미허용</span>}
                            </label>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </section>
    </div>
  )
}
