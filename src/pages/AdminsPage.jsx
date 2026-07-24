import { useCallback, useEffect, useRef, useState } from 'react'
import Toast from '../components/Toast'
import { adminApi, codeApi, orgApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Shell from '../components/Shell'

const STATUS_LABEL = { ACTIVE: '재직', LOCKED: '잠김', DISABLED: '중지' }

// 서버(AdminAccount.DEFAULT_PASSWORD)와 같은 값. 안내 문구에만 쓴다.
const DEFAULT_PASSWORD = 'exprism1234!'

/** 조직 트리를 평평하게 편다. id→이름 조회, 부서 콤보박스·검색에 쓴다. */
function flattenOrgs(chart, depth = 0, path = [], acc = []) {
  for (const node of chart) {
    acc.push({ id: node.id, name: node.name, orgCode: node.orgCode, depth, path: path.join(' › ') })
    flattenOrgs(node.children ?? [], depth + 1, [...path, node.name], acc)
  }
  return acc
}

/** 이 조직 직접 소속 + 모든 하위 조직 인원까지 합산한 총원. */
function totalMembers(node) {
  return node.members.length + (node.children ?? []).reduce((sum, c) => sum + totalMembers(c), 0)
}

/** 조직도 멤버 → 관리자 원본 객체를 찾는다 (더블클릭/우클릭이 좌측과 같은 동작을 하도록). */
function findAdmin(admins, empNo) {
  return admins.find((a) => a.empNo === empNo) ?? null
}

/** targetId 가 orgId 자신이거나 그 하위(자손)인가. 조직을 자기 하위로 옮기는 것을 막는 데 쓴다. */
function isDescendantOrg(chart, orgId, targetId) {
  const find = (nodes) => {
    for (const n of nodes) {
      if (n.id === orgId) return n
      const hit = find(n.children ?? [])
      if (hit) return hit
    }
    return null
  }
  const start = find(chart)
  if (!start) return false
  const walk = (node) => {
    if (node.id === targetId) return true
    return (node.children ?? []).some(walk)
  }
  return walk(start)
}

export default function AdminsPage() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState([])
  const [chart, setChart] = useState([])
  const [includeDeleted, setIncludeDeleted] = useState(false)
  // 부서 필터: 'ALL'(전체) | 'UNASSIGNED'(미배치) | 조직 id(number)
  const [filterOrg, setFilterOrg] = useState('ALL')
  const [deptSearchOpen, setDeptSearchOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dialog, setDialog] = useState(null) // 관리자 { mode, admin }
  const [orgDialog, setOrgDialog] = useState(null) // 조직 { mode, org, parentId }
  const [menu, setMenu] = useState(null) // 우클릭 { x, y, kind, ... }
  const [collapsed, setCollapsed] = useState(() => new Set())

  const [dragEmpNo, setDragEmpNo] = useState(null) // 드래그 중인 사원
  const [dragOrgId, setDragOrgId] = useState(null) // 드래그 중인 조직(부서 이동)
  const [dropOrgId, setDropOrgId] = useState(null) // 드랍 대상 조직(하이라이트)

  // 부서코드 선택지 — 공통코드 DEPARTMENT 에서 온다. 조직의 부서코드는 여기 있는 것만 쓸 수 있다.
  const [deptCodes, setDeptCodes] = useState([])
  useEffect(() => {
    codeApi
      .groups()
      .then((groups) => {
        const dept = groups.find((g) => g.groupCode === 'DEPARTMENT')
        setDeptCodes((dept?.codes ?? []).filter((c) => c.useYn === 'Y').map((c) => ({ code: c.code, name: c.name })))
      })
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [page, orgChart] = await Promise.all([
        adminApi.list({ includeDeleted, size: 200 }),
        orgApi.chart(),
      ])
      setAdmins(page?.content ?? [])
      setChart(orgChart ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [includeDeleted])

  useEffect(() => {
    load()
  }, [load])

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

  const orgList = flattenOrgs(chart)
  const orgNameById = Object.fromEntries(orgList.map((o) => [o.id, o.name]))

  // 좌측 목록: 부서 필터 적용. 특정 부서를 고르면 그 부서 소속 사원만 보인다.
  const visibleAdmins = admins.filter((a) => {
    if (filterOrg === 'ALL') return true
    if (filterOrg === 'UNASSIGNED') return !a.orgId && !a.deleted
    return a.orgId === filterOrg
  })
  const filterLabel =
    filterOrg === 'ALL' ? '전체 부서' : filterOrg === 'UNASSIGNED' ? '미배치' : orgNameById[filterOrg] ?? '부서'

  function toggleCollapse(id) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function reload() {
    setDialog(null)
    setOrgDialog(null)
    await load()
  }

  // --- 드래그앤드랍: 사원 → 조직 배치 ---
  async function assignTo(orgId) {
    const empNo = dragEmpNo
    setDropOrgId(null)
    setDragEmpNo(null)
    if (!empNo) return
    const me = admins.find((a) => a.empNo === empNo)
    if (me && me.orgId === orgId) return // 제자리
    try {
      await orgApi.assignMember(empNo, orgId)
      // 접힌 조직에 넣으면 방금 넣은 사람이 안 보인다 — 자동으로 펼친다.
      if (orgId) {
        setCollapsed((prev) => {
          const next = new Set(prev)
          next.delete(orgId)
          return next
        })
      }
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  // --- 드래그앤드랍: 조직(부서) → 다른 조직의 하위로 이동 ---
  // targetOrgId 가 null 이면 최상위로 뺀다. 자기 자신/하위로는 옮길 수 없다(서버도 막는다).
  async function moveOrg(targetOrgId) {
    const orgId = dragOrgId
    setDropOrgId(null)
    setDragOrgId(null)
    if (!orgId) return
    if (orgId === targetOrgId) return // 제자리
    if (targetOrgId != null && isDescendantOrg(chart, orgId, targetOrgId)) {
      setError('자기 자신이나 하위 조직으로는 옮길 수 없습니다.')
      return
    }
    try {
      // position 은 크게 보내면 서버가 형제 목록 끝으로 클램프한다 → 대상의 마지막 하위로 붙는다.
      await orgApi.move(orgId, { parentId: targetOrgId, position: 9999 })
      if (targetOrgId) {
        setCollapsed((prev) => { const next = new Set(prev); next.delete(targetOrgId); return next })
      }
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  // 사원이 드래그 중이면 사원 배치, 조직이 드래그 중이면 조직 이동으로 분기한다.
  function onNodeDrop(targetOrgId) {
    if (dragEmpNo) assignTo(targetOrgId)
    else if (dragOrgId) moveOrg(targetOrgId)
  }

  async function setLeader(orgId, empNo) {
    try {
      await orgApi.assignLeader(orgId, empNo)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Shell>
      <div className="page-head">
        <h2>관리자 · 조직도</h2>
        <span className="count">{loading ? '' : `${admins.filter((a) => !a.deleted).length}명`}</span>
      </div>

      <Toast message={error} onClose={() => setError('')} />

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <div className="master-detail">
          {/* 좌: 사원 목록 */}
          <section
            className={`md-master emp-panel${dragEmpNo ? ' drop-unassign' : ''}`}
            onDragOver={(e) => {
              if (dragEmpNo) e.preventDefault()
            }}
            onDrop={() => dragEmpNo && assignTo(null)}
          >
            <div className="md-head">
              {/* 부서 콤보박스 + 돋보기(부서 검색). 선택한 부서의 사원만 아래 목록에 보인다. */}
              <div className="dept-filter">
                <select
                  className="dept-select"
                  value={String(filterOrg)}
                  onChange={(e) => {
                    const v = e.target.value
                    setFilterOrg(v === 'ALL' || v === 'UNASSIGNED' ? v : Number(v))
                  }}
                >
                  <option value="ALL">전체 부서</option>
                  <option value="UNASSIGNED">미배치</option>
                  {orgList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {' '.repeat(o.depth * 2)}{o.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost dept-search-btn"
                  title="부서 검색"
                  onClick={() => setDeptSearchOpen(true)}
                >
                  🔍
                </button>
              </div>
              <button className="btn-primary btn-sm" onClick={() => setDialog({ mode: 'create' })}>
                + 관리자 추가
              </button>
            </div>
            <div className="emp-filters">
              <span className="filter-tag">{filterLabel} · {visibleAdmins.filter((a) => !a.deleted).length}명</span>
              <label className="check">
                <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
                퇴사자 포함
              </label>
            </div>
            <ul className="emp-list">
              {visibleAdmins.map((admin) => (
                <li
                  key={admin.empNo}
                  className={`emp-item${admin.deleted ? ' deleted' : ''}`}
                  draggable={!admin.deleted}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', admin.empNo)
                    setDragEmpNo(admin.empNo)
                  }}
                  onDragEnd={() => {
                    setDragEmpNo(null)
                    setDropOrgId(null)
                  }}
                  onDoubleClick={() => !admin.deleted && setDialog({ mode: 'edit', admin })}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (admin.deleted) return
                    setMenu({ x: e.clientX, y: e.clientY, kind: 'admin', admin })
                  }}
                >
                  <div className="emp-main">
                    <span className="emp-name">
                      {admin.name}
                      {admin.empNo === user?.empNo && <span className="tag-self">나</span>}
                    </span>
                    <span className="mono emp-no">{admin.empNo}</span>
                  </div>
                  <div className="emp-sub">
                    <span>{admin.jobGrade ?? '-'}{admin.jobTitle ? ` · ${admin.jobTitle}` : ''}</span>
                    {admin.deleted ? (
                      <span className="badge badge-suspended">퇴사</span>
                    ) : admin.orgId ? (
                      <span className="emp-org">{orgNameById[admin.orgId] ?? '소속'}</span>
                    ) : (
                      <span className="emp-org none">미배치</span>
                    )}
                  </div>
                </li>
              ))}
              {visibleAdmins.length === 0 && <li className="md-empty">표시할 사원이 없습니다.</li>}
            </ul>
            <p className="hint left emp-hint">
              사원을 오른쪽 조직으로 끌어 배치합니다. 여기로 다시 끌면 미배치로 돌아갑니다.
            </p>
          </section>

          {/* 우: 조직도 */}
          <section className="md-detail org-panel">
            <div className="md-head">
              <h3>조직도</h3>
              <button className="btn-primary btn-sm" onClick={() => setOrgDialog({ mode: 'createOrg', parentId: null })}>
                + 최상위 조직
              </button>
            </div>
            <div
              className={`org-tree${dragOrgId ? ' org-dragging' : ''}`}
              // 부서를 조직도 빈 곳으로 끌어다 놓으면 최상위로 뺀다. (조직 노드 위 드랍은 노드가 stopPropagation 으로 가로챈다)
              onDragOver={(e) => { if (dragOrgId) e.preventDefault() }}
              onDrop={() => { if (dragOrgId) moveOrg(null) }}
            >
              {chart.map((node) => (
                <OrgTreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  collapsed={collapsed}
                  toggleCollapse={toggleCollapse}
                  dropOrgId={dropOrgId}
                  dragging={!!dragEmpNo || !!dragOrgId}
                  dragOrgId={dragOrgId}
                  onDragOverNode={(id) => setDropOrgId(id)}
                  onDropNode={onNodeDrop}
                  onDragMemberStart={setDragEmpNo}
                  onDragMemberEnd={() => { setDragEmpNo(null); setDropOrgId(null) }}
                  onDragOrgStart={setDragOrgId}
                  onDragOrgEnd={() => { setDragOrgId(null); setDropOrgId(null) }}
                  onOrgMenu={(e, org) => setMenu({ x: e.clientX, y: e.clientY, kind: 'org', org })}
                  onMemberMenu={(e, org, member) => setMenu({ x: e.clientX, y: e.clientY, kind: 'member', org, member })}
                  onMemberOpen={(member) => {
                    const admin = findAdmin(admins, member.empNo)
                    if (admin && !admin.deleted) setDialog({ mode: 'edit', admin })
                  }}
                />
              ))}
              {chart.length === 0 && <p className="muted md-placeholder">조직이 없습니다. + 최상위 조직으로 만드세요.</p>}
            </div>
            <p className="hint left">
              부서를 다른 부서로 끌면 그 하위로, 조직도 빈 곳으로 끌면 최상위로 이동합니다.
            </p>
          </section>
        </div>
      )}

      {menu && (
        <ul className="context-menu" style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          {menu.kind === 'admin' && (
            <>
              <li onClick={() => { setDialog({ mode: 'edit', admin: menu.admin }); setMenu(null) }}>수정</li>
              <li onClick={() => { setDialog({ mode: 'reset', admin: menu.admin }); setMenu(null) }}>비밀번호 초기화</li>
              <li className="danger" onClick={() => { setDialog({ mode: 'retire', admin: menu.admin }); setMenu(null) }}>퇴사처리</li>
            </>
          )}
          {menu.kind === 'org' && (
            <>
              <li onClick={() => { setOrgDialog({ mode: 'createOrg', parentId: menu.org.id }); setMenu(null) }}>하위 조직 추가</li>
              <li onClick={() => { setOrgDialog({ mode: 'renameOrg', org: menu.org }); setMenu(null) }}>수정 (코드·이름)</li>
              <li className="danger" onClick={() => { setOrgDialog({ mode: 'deleteOrg', org: menu.org }); setMenu(null) }}>삭제</li>
            </>
          )}
          {menu.kind === 'member' && (() => {
            // 조직도에서 우클릭해도 좌측 사원 목록과 동일한 관리자 동작을 제공한다.
            const admin = findAdmin(admins, menu.member.empNo)
            return (
              <>
                {admin && (
                  <>
                    <li onClick={() => { setDialog({ mode: 'edit', admin }); setMenu(null) }}>수정</li>
                    <li onClick={() => { setDialog({ mode: 'reset', admin }); setMenu(null) }}>비밀번호 초기화</li>
                  </>
                )}
                {menu.member.leader ? (
                  <li onClick={() => { setLeader(menu.org.id, ''); setMenu(null) }}>부서장 해제</li>
                ) : (
                  <li onClick={() => { setLeader(menu.org.id, menu.member.empNo); setMenu(null) }}>부서장 지정</li>
                )}
                <li onClick={() => { setDragEmpNo(menu.member.empNo); assignTo(null); setMenu(null) }}>
                  조직에서 빼기
                </li>
                {admin && (
                  <li className="danger" onClick={() => { setDialog({ mode: 'retire', admin }); setMenu(null) }}>
                    퇴사처리
                  </li>
                )}
              </>
            )
          })()}
        </ul>
      )}

      {dialog && (
        <AdminDialog dialog={dialog} onClose={() => setDialog(null)} onSaved={reload} onError={setError} />
      )}
      {orgDialog && (
        <OrgDialog dialog={orgDialog} deptCodes={deptCodes} onClose={() => setOrgDialog(null)} onSaved={reload} onError={setError} />
      )}
      {deptSearchOpen && (
        <DeptSearchModal
          orgList={orgList}
          onPick={(id) => { setFilterOrg(id); setDeptSearchOpen(false) }}
          onClose={() => setDeptSearchOpen(false)}
        />
      )}
    </Shell>
  )
}

/** 돋보기 버튼으로 여는 부서 검색 모달. 열면 전 부서가 나오고, 부서명·코드로 걸러 고를 수 있다. */
function DeptSearchModal({ orgList, onPick, onClose }) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const filtered = query
    ? orgList.filter((o) => o.name.toLowerCase().includes(query) || (o.orgCode ?? '').toLowerCase().includes(query))
    : orgList

  return (
    <Modal title="🔍 부서 검색" onClose={onClose}>
      <input
        className="dept-search-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="부서명 또는 코드로 검색 (비우면 전체)"
        autoFocus
      />
      <ul className="dept-search-list">
        <li className="dept-search-item all" onClick={() => onPick('ALL')}>
          전체 부서 보기
        </li>
        {filtered.map((o) => (
          <li key={o.id} className="dept-search-item" onClick={() => onPick(o.id)}>
            <span className="dept-search-main">
              {o.orgCode && <span className="org-code">{o.orgCode}</span>}
              {o.name}
            </span>
            {o.path && <span className="dept-search-path">{o.path}</span>}
          </li>
        ))}
        {filtered.length === 0 && <li className="dept-search-empty">검색 결과가 없습니다.</li>}
      </ul>
    </Modal>
  )
}

/** 조직도의 한 노드 — 부서장/팀원 + 하위 조직. 드랍 대상이다. */
function OrgTreeNode({
  node, depth, collapsed, toggleCollapse, dropOrgId, dragging, dragOrgId,
  onDragOverNode, onDropNode, onDragMemberStart, onDragMemberEnd, onDragOrgStart, onDragOrgEnd,
  onOrgMenu, onMemberMenu, onMemberOpen,
}) {
  const isCollapsed = collapsed.has(node.id)
  const hasKids = (node.children?.length ?? 0) > 0
  // 접으면 이 조직의 직원과 하위 조직을 모두 숨긴다. 그래서 둘 중 하나라도 있으면 접기 버튼을 단다.
  const hasContent = node.members.length > 0 || hasKids
  // 지금 끌고 있는 조직이 자기 자신이면 드랍 대상이 될 수 없다.
  const isSelfDragged = dragOrgId === node.id

  return (
    <div className="org-node" style={{ marginLeft: depth ? 18 : 0 }}>
      <div
        className={`org-head${dropOrgId === node.id ? ' drop-on' : ''}${isSelfDragged ? ' org-self-drag' : ''}`}
        draggable
        onDragStart={(e) => {
          e.stopPropagation()
          onDragOrgStart(node.id) // 상태를 먼저 잡는다(dataTransfer 접근 실패와 무관하게)
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', `org:${node.id}`)
          }
        }}
        onDragEnd={onDragOrgEnd}
        onDragOver={(e) => {
          if (!dragging || isSelfDragged) return
          e.preventDefault()
          e.stopPropagation()
          onDragOverNode(node.id)
        }}
        onDragLeave={() => dropOrgId === node.id && onDragOverNode(null)}
        onDrop={(e) => {
          if (isSelfDragged) return
          e.preventDefault()
          e.stopPropagation() // 최상위(org-tree) 드랍으로 새지 않게
          onDropNode(node.id)
        }}
        onContextMenu={(e) => { e.preventDefault(); onOrgMenu(e, node) }}
      >
        {hasContent ? (
          <button type="button" className="tree-toggle" onClick={() => toggleCollapse(node.id)}>
            <span className={`chev${isCollapsed ? '' : ' open'}`}>▸</span>
          </button>
        ) : (
          <span className="tree-toggle-slot" />
        )}
        {node.orgCode && <span className="org-code">{node.orgCode}</span>}
        <span className="org-name">{node.name}</span>
        {/* 하위 조직 인원까지 합산한 총원. 직접 소속과 다르면 (직접) 을 함께 보여준다. */}
        <span
          className="org-count"
          title={hasKids ? `직접 소속 ${node.members.length} · 하위 포함 ${totalMembers(node)}` : undefined}
        >
          {totalMembers(node)}
        </span>
      </div>

      {/* 소속 사원 — 부서장 먼저. 접으면 함께 숨는다. */}
      {!isCollapsed && node.members.length > 0 && (
        <div className="org-members">
          {node.members.map((m) => (
            <div
              key={m.empNo}
              className={`org-member${m.leader ? ' leader' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', m.empNo)
                onDragMemberStart(m.empNo)
              }}
              onDragEnd={onDragMemberEnd}
              onDoubleClick={() => onMemberOpen(m)}
              onContextMenu={(e) => { e.preventDefault(); onMemberMenu(e, node, m) }}
              title={m.leader ? '부서장' : undefined}
            >
              {/* 직책명 · 이름 · 직급명 순. 부서장은 파란 테두리로만 구분한다. */}
              {m.jobTitle && <span className="member-title">{m.jobTitle}</span>}
              <span className="member-name">{m.name}</span>
              {m.jobGrade && <span className="member-grade">{m.jobGrade}</span>}
            </div>
          ))}
        </div>
      )}

      {/* 하위 조직 */}
      {!isCollapsed && hasKids && (
        <div className="org-children">
          {node.children.map((child) => (
            <OrgTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              toggleCollapse={toggleCollapse}
              dropOrgId={dropOrgId}
              dragging={dragging}
              onDragOverNode={onDragOverNode}
              onDropNode={onDropNode}
              onDragMemberStart={onDragMemberStart}
              onDragMemberEnd={onDragMemberEnd}
              onOrgMenu={onOrgMenu}
              onMemberMenu={onMemberMenu}
              onMemberOpen={onMemberOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** 조직 추가/수정/삭제 다이얼로그. 부서코드는 공통코드 DEPARTMENT 에서 고른다. */
function OrgDialog({ dialog, onClose, onSaved, onError, deptCodes }) {
  const { mode, org, parentId } = dialog
  const [name, setName] = useState(org?.name ?? '')
  const [orgCode, setOrgCode] = useState(org?.orgCode ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (mode === 'deleteOrg') {
    async function remove() {
      setSaving(true)
      try {
        await orgApi.remove(org.id)
        await onSaved()
      } catch (e) {
        onError(e.message)
        onClose()
      }
    }
    return (
      <Modal title="조직 삭제" onClose={onClose}>
        <p className="confirm-text"><strong>{org.name}</strong> 조직을 삭제하시겠습니까?</p>
        <p className="hint left">하위 조직이나 소속 사원이 있으면 삭제할 수 없습니다.</p>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
          <button type="button" className="btn-primary btn-danger-solid" onClick={remove} disabled={saving}>
            {saving ? '처리 중…' : '삭제'}
          </button>
        </div>
      </Modal>
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const code = orgCode.trim().toUpperCase()
      if (mode === 'createOrg') await orgApi.create({ orgCode: code, name, parentId: parentId ?? undefined })
      else await orgApi.rename(org.id, { orgCode: code, name })
      await onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // 부서코드를 고르면 조직명을 코드명으로 자동 채운다 (비어 있거나 방금 자동채운 값 그대로일 때만 —
  // 사용자가 이름을 손수 고쳤으면 덮어쓰지 않는다).
  const lastAutoName = useRef('')
  function pickCode(code) {
    setOrgCode(code)
    const picked = deptCodes.find((d) => d.code === code)
    if (picked && (!name || name === lastAutoName.current)) {
      setName(picked.name)
      lastAutoName.current = picked.name
    }
  }

  return (
    <Modal title={mode === 'createOrg' ? (parentId ? '하위 조직 추가' : '최상위 조직 추가') : `${org.name} 수정`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Toast message={error} onClose={() => setError('')} />
        <label className="field">
          <span>부서코드 (공통코드 · 부서에서 선택)</span>
          <select value={orgCode} onChange={(e) => pickCode(e.target.value)} required autoFocus>
            <option value="" disabled>부서를 선택하세요</option>
            {deptCodes.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>조직명</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required />
        </label>
        <p className="hint left">
          부서코드는 <strong>설정 &gt; 공통코드 &gt; 부서</strong>에서 관리합니다. 여기에 없으면 공통코드에서 먼저 등록하세요.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </Modal>
  )
}

function AdminDialog({ dialog, onClose, onSaved, onError }) {
  const { mode, admin } = dialog
  const [form, setForm] = useState({
    name: admin?.name ?? '',
    email: admin?.email ?? '',
    phone: admin?.phone ?? '',
    department: admin?.department ?? '',
    jobGrade: admin?.jobGrade ?? '',
    jobTitle: admin?.jobTitle ?? '',
    status: admin?.status ?? 'ACTIVE',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [issuedEmpNo, setIssuedEmpNo] = useState(null)
  const [resetDone, setResetDone] = useState(null) // 초기화된 비밀번호

  // 부서/직급/직책 선택지 — 공통코드에서 온다(드롭다운). 실패해도 (없음)만 뜨고 화면은 동작한다.
  const [suggest, setSuggest] = useState({ DEPARTMENT: [], JOB_GRADE: [], JOB_TITLE: [] })
  useEffect(() => {
    codeApi
      .groups()
      .then((groups) => {
        const byGroup = {}
        for (const g of groups) {
          byGroup[g.groupCode] = g.codes.filter((c) => c.useYn === 'Y').map((c) => c.name)
        }
        setSuggest({
          DEPARTMENT: byGroup.DEPARTMENT ?? [],
          JOB_GRADE: byGroup.JOB_GRADE ?? [],
          JOB_TITLE: byGroup.JOB_TITLE ?? [],
        })
      })
      .catch(() => {})
  }, [])

  // 비밀번호 초기화 — 새 비밀번호를 입력받지 않는다. 서버가 기본값으로 되돌리고 알려준다.
  if (mode === 'reset') {
    if (resetDone) {
      return (
        <Modal title="비밀번호를 초기화했습니다" onClose={onSaved}>
          <p className="issued">
            초기 비밀번호 <strong className="mono">{resetDone}</strong>
          </p>
          <p className="hint left">
            이 비밀번호를 본인에게 전달하세요. 본인이 로그인하면 <strong>새 비밀번호로 변경해야</strong>{' '}
            콘솔을 쓸 수 있습니다.
          </p>
          <div className="dialog-actions">
            <button className="btn-primary" onClick={onSaved}>
              확인
            </button>
          </div>
        </Modal>
      )
    }

    async function reset() {
      setSaving(true)
      try {
        const result = await adminApi.resetPassword(admin.empNo)
        setResetDone(result.password)
      } catch (e) {
        onError(e.message)
        onClose()
      }
    }

    return (
      <Modal title="비밀번호 초기화" onClose={onClose}>
        <p className="confirm-text">
          <strong>
            {admin.empNo} {admin.name}
          </strong>
          님의 비밀번호를 초기화하시겠습니까?
        </p>
        <p className="hint left">
          기존 비밀번호는 즉시 무효가 되고 로그인 중이던 세션도 끊깁니다.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn-primary" onClick={reset} disabled={saving}>
            {saving ? '처리 중…' : '초기화'}
          </button>
        </div>
      </Modal>
    )
  }

  // 퇴사처리 확인창
  if (mode === 'retire') {
    async function retire() {
      setSaving(true)
      try {
        await adminApi.remove(admin.empNo)
        await onSaved()
      } catch (e) {
        // 자기 자신 / 마지막 관리자는 서버가 막는다. 그 이유를 목록 화면에 그대로 띄운다.
        onError(e.message)
        onClose()
      }
    }
    return (
      <Modal title="퇴사처리" onClose={onClose}>
        <p className="confirm-text">
          <strong>
            {admin.empNo} {admin.name}
          </strong>
          님을 퇴사처리 하시겠습니까?
        </p>
        <p className="hint left">
          계정 기록은 남지만 로그인할 수 없게 되고, 발급된 토큰도 즉시 폐기됩니다.
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="button" className="btn-primary btn-danger-solid" onClick={retire} disabled={saving}>
            {saving ? '처리 중…' : '퇴사처리'}
          </button>
        </div>
      </Modal>
    )
  }

  const title = mode === 'create' ? '👤 직원 추가' : '👤 직원 정보'

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (mode === 'create') {
        // 사번도 비밀번호도 보내지 않는다. 서버가 채번하고 기본 비밀번호로 만든다.
        const created = await adminApi.create({
          name: form.name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          department: form.department || undefined,
          jobGrade: form.jobGrade || undefined,
          jobTitle: form.jobTitle || undefined,
        })
        setIssuedEmpNo(created.empNo)
        return // 발급된 사번을 보여준 뒤 닫는다
      }
      await adminApi.update(admin.empNo, {
        name: form.name,
        email: form.email,
        phone: form.phone,
        department: form.department,
        jobGrade: form.jobGrade,
        jobTitle: form.jobTitle,
        status: form.status,
      })
      await onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // 생성 직후: 발급된 사번과 초기 비밀번호를 알려준다. 둘 다 본인에게 전달해야 한다.
  if (issuedEmpNo) {
    return (
      <Modal title="관리자를 만들었습니다" onClose={onSaved}>
        <p className="issued">
          발급된 사번 <strong className="mono">{issuedEmpNo}</strong>
        </p>
        <p className="issued">
          초기 비밀번호 <strong className="mono">{DEFAULT_PASSWORD}</strong>
        </p>
        <p className="hint left">
          둘 다 본인에게 전달하세요. 본인이 로그인하면 <strong>새 비밀번호로 변경해야</strong> 콘솔을 쓸
          수 있습니다.
        </p>
        <div className="dialog-actions">
          <button className="btn-primary" onClick={onSaved}>
            확인
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} className="emp-form">
        <Toast message={error} onClose={() => setError('')} />

        {/* 사번은 수정 시 바뀌지 않는 식별자 — 읽기 전용으로 위에 보여준다 */}
        {mode === 'edit' && (
          <div className="readonly-field">
            <span>사번</span>
            <strong className="mono">{admin.empNo}</strong>
          </div>
        )}

        <label className="field">
          <span>이름 <span className="req">*</span></span>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoFocus
          />
        </label>

        {/* 부서·직급·직책 — 공통코드에서 고른다 (드롭다운) */}
        <div className="field-row">
          <label className="field">
            <span>부서</span>
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">(없음)</option>
              {suggest.DEPARTMENT.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>직급</span>
            <select value={form.jobGrade} onChange={(e) => setForm({ ...form, jobGrade: e.target.value })}>
              <option value="">(없음)</option>
              {suggest.JOB_GRADE.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>직책</span>
            <select value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}>
              <option value="">(없음)</option>
              {suggest.JOB_TITLE.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
        </div>

        {/* 이메일·연락처 — 한 줄에 나란히 */}
        <div className="field-row">
          <label className="field">
            <span>이메일</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="chulsoo@example.com"
            />
          </label>
          <label className="field">
            <span>연락처</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="010-1234-5678"
            />
          </label>
        </div>

        {mode === 'edit' && (
          <label className="field">
            <span>상태</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">🟢 재직</option>
              <option value="DISABLED">⛔ 중지 (로그인 차단)</option>
            </select>
          </label>
        )}

        {/* 비밀번호는 입력받지 않는다. 만드는 사람이 남의 비밀번호를 알아서는 안 된다. */}
        {mode === 'create' && (
          <p className="hint left">
            사번은 서버가 자동으로 채번하고, 비밀번호는 <strong className="mono">{DEFAULT_PASSWORD}</strong>{' '}
            로 시작합니다. 본인이 첫 로그인 때 반드시 변경합니다.
          </p>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? '저장 중…' : '💾 저장'}
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

function formatDate(value) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}
