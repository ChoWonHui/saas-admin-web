import { useCallback, useEffect, useRef, useState } from 'react'
import Toast from '../components/Toast'
import { codeApi, staffApi, tenantApi } from '../api/client'
import TableLayoutEditor from '../components/TableLayoutEditor'

// 좌석수 선택지를 공통코드 TABLE_SEATS 에서 불러온다(배치 편집기에 주입). 모듈 함수라 참조가 안정적이다.
function seatOptionsFromCodes() {
  return codeApi.groups().then((groups) => {
    const g = groups.find((x) => x.groupCode === 'TABLE_SEATS')
    return (g?.codes ?? [])
      .filter((c) => c.useYn === 'Y')
      .map((c) => ({ value: Number(c.code), label: c.name }))
      .filter((o) => o.value > 0)
  })
}
import { openPostcode, preloadPostcode } from '../lib/postcode'
import MenuEditor from '../components/MenuEditor'
import StaffModal from '../components/StaffModal'
import Shell from '../components/Shell'

const STATUS_LABEL = {
  PENDING: '대기',
  ACTIVE: '운영중',
  SUSPENDED: '정지',
  CLOSED: '해지',
}

function fmtDate(v) {
  return v ? v.slice(0, 10) : '-'
}

export default function TenantsPage() {
  const [data, setData] = useState({ content: [], totalElements: 0 })
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null) // { mode:'create'|'edit', tenant? }
  const [confirm, setConfirm] = useState(null) // { mode:'delete'|'restore'|'activate'|'suspend', tenant }
  const [menu, setMenu] = useState(null) // 우클릭 메뉴 { x, y, tenant }
  const [branchFor, setBranchFor] = useState(null) // 지점 관리 대상 업체
  const [staffFor, setStaffFor] = useState(null) // 직원 관리 대상 업체
  const [ownerFor, setOwnerFor] = useState(null) // 방금 등록한 업체 — 대표 계정 만들기 단계
  const [firstBranchFor, setFirstBranchFor] = useState(null) // 대표 만든 뒤 — 1호점 등록 단계

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await tenantApi.list({ includeDeleted, size: 100 }))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [includeDeleted])

  useEffect(() => { load() }, [load])
  useEffect(() => { tenantApi.plans().then(setPlans).catch(() => {}) }, [])

  // 우클릭 메뉴: 바깥 클릭·스크롤·Esc 로 닫는다.
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

  const planName = (id) => plans.find((p) => p.planId === id)?.name ?? (id ? `#${id}` : '-')

  const tenants = data.content ?? []
  const statusCount = (s) => tenants.filter((t) => t.status === s).length

  return (
    <Shell>
      <div className="tenant-page">
      <div className="page-hero">
        <div className="page-hero-icon" aria-hidden="true">🏢</div>
        <div className="page-hero-text">
          <h2>업체 관리</h2>
          <p>입점 업체를 등록·수정하고 서비스 개설·중지를 관리합니다.</p>
        </div>
        <div className="page-hero-actions">
          <label className="check">
            <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
            삭제 포함
          </label>
          <button className="btn-primary btn-sm notice-new" onClick={() => setDialog({ mode: 'create' })}>+ 업체 등록</button>
        </div>
      </div>

      <div className="page-stats">
        <div className="stat-card">
          <span className="stat-num">{loading ? '–' : data.totalElements}</span>
          <span className="stat-label">전체 업체</span>
        </div>
        <div className="stat-card">
          <span className="stat-num stat-accent">{loading ? '–' : statusCount('ACTIVE')}</span>
          <span className="stat-label">운영중</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{loading ? '–' : statusCount('PENDING')}</span>
          <span className="stat-label">대기</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{loading ? '–' : statusCount('SUSPENDED')}</span>
          <span className="stat-label">정지</span>
        </div>
      </div>

      <Toast message={error} onClose={() => setError('')} />

      <div className="card">
        {loading ? (
          <p className="muted list-empty">불러오는 중…</p>
        ) : tenants.length === 0 ? (
          <div className="list-empty-state">
            <div className="list-empty-ic" aria-hidden="true">🏢</div>
            <p className="list-empty-title">아직 등록된 업체가 없습니다.</p>
            <p className="list-empty-sub">첫 업체를 등록해 보세요.</p>
            <button className="btn-primary btn-sm" onClick={() => setDialog({ mode: 'create' })}>+ 업체 등록</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="col-grow">업체명</th>
                  <th style={{ width: 90 }}>코드</th>
                  <th style={{ width: 110 }}>slug</th>
                  <th style={{ width: 80 }}>상태</th>
                  <th style={{ width: 80 }}>지점</th>
                  <th style={{ width: 100 }}>요금제</th>
                  <th style={{ width: 90 }}>대표자</th>
                  <th style={{ width: 130 }}>연락처</th>
                  <th style={{ width: 100 }}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr
                    key={t.tenantId}
                    className={`row-clickable${t.deleted ? ' row-deleted' : ''}`}
                    onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, tenant: t }) }}
                    onDoubleClick={() => !t.deleted && setDialog({ mode: 'edit', tenant: t })}
                  >
                    <td className="strong">
                      {t.tenantName}
                      {t.deleted && <span className="badge" style={{ marginLeft: 6 }}>삭제됨</span>}
                    </td>
                    <td className="mono">{t.tenantCode}</td>
                    <td className="mono">{t.tenantSlug}</td>
                    <td>
                      <span className={`badge badge-${t.status?.toLowerCase()}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="branch-chip"
                        title="지점(호점) 관리"
                        onClick={(e) => { e.stopPropagation(); setBranchFor(t) }}
                      >
                        {t.branchCount > 0 ? `${t.branchCount}개` : '지점 +'}
                      </button>
                    </td>
                    <td className="muted-cell">{planName(t.planId)}</td>
                    <td>{t.ownerName ?? '-'}</td>
                    <td className="muted-cell">{t.contactPhone ?? '-'}</td>
                    <td className="muted-cell">{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {tenants.length > 0 && (
        <p className="hint left">행을 우클릭하면 수정·삭제 등 작업 메뉴가 열립니다. (더블클릭 시 수정)</p>
      )}
      </div>

      {menu && (
        <ul className="context-menu" style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          {menu.tenant.deleted ? (
            <li onClick={() => { setConfirm({ mode: 'restore', tenant: menu.tenant }); setMenu(null) }}>복구</li>
          ) : (
            <>
              <li onClick={() => { setDialog({ mode: 'edit', tenant: menu.tenant }); setMenu(null) }}>수정</li>
              <li onClick={() => { setBranchFor(menu.tenant); setMenu(null) }}>지점(호점) 관리</li>
              <li onClick={() => { setStaffFor(menu.tenant); setMenu(null) }}>직원 관리</li>
              {(menu.tenant.status === 'PENDING' || menu.tenant.status === 'SUSPENDED') && (
                <li onClick={() => { setConfirm({ mode: 'activate', tenant: menu.tenant }); setMenu(null) }}>서비스 개설</li>
              )}
              {menu.tenant.status === 'ACTIVE' && (
                <li onClick={() => { setConfirm({ mode: 'suspend', tenant: menu.tenant }); setMenu(null) }}>서비스 중지</li>
              )}
              <li className="danger" onClick={() => { setConfirm({ mode: 'delete', tenant: menu.tenant }); setMenu(null) }}>삭제</li>
            </>
          )}
        </ul>
      )}

      {dialog && (
        <TenantDialog
          dialog={dialog}
          plans={plans}
          onClose={() => setDialog(null)}
          onSaved={(created) => {
            setDialog(null)
            load()
            // 업체를 새로 등록했으면 곧바로 대표 계정 만들기 단계로 넘어간다.
            if (created?.tenantId) setOwnerFor(created)
          }}
          onError={setError}
        />
      )}

      {confirm && (
        <ConfirmDialog
          confirm={confirm}
          onClose={() => setConfirm(null)}
          onDone={() => { setConfirm(null); load() }}
          onError={setError}
        />
      )}

      {branchFor && (
        <BranchModal
          tenant={branchFor}
          onClose={() => setBranchFor(null)}
          onChanged={load}
          onError={setError}
        />
      )}

      {staffFor && (
        <StaffModal
          tenant={staffFor}
          onClose={() => setStaffFor(null)}
          onError={setError}
        />
      )}

      {ownerFor && (
        <OwnerSetupDialog
          tenant={ownerFor}
          onClose={() => setOwnerFor(null)}
          onDone={() => {
            // 대표 계정을 만들었으면 이어서 1호점 등록 단계로.
            const t = ownerFor
            setOwnerFor(null)
            load()
            setFirstBranchFor(t)
          }}
          onError={setError}
        />
      )}

      {firstBranchFor && (
        <FirstBranchDialog
          tenant={firstBranchFor}
          onClose={() => setFirstBranchFor(null)}
          onDone={() => { setFirstBranchFor(null); load() }}
          onError={setError}
        />
      )}
    </Shell>
  )
}

/** 업체 등록 직후 — 대표(로그인) 계정 만들기 단계. 역할은 대표로 고정. */
function OwnerSetupDialog({ tenant, onClose, onDone, onError }) {
  const [form, setForm] = useState({
    loginId: '', email: '', password: '', name: tenant.ownerName ?? '', phone: tenant.contactPhone ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function create() {
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(form.loginId.trim())) {
      onError('아이디는 영문/숫자/._- 조합 3~50자입니다.'); return
    }
    if (form.password.length < 8) { onError('비밀번호는 8자 이상이어야 합니다.'); return }
    if (!form.name.trim()) { onError('대표 이름을 입력하세요.'); return }
    setSaving(true)
    try {
      await staffApi.create(tenant.tenantId, {
        loginId: form.loginId.trim(),
        email: form.email.trim() || undefined,
        password: form.password, name: form.name.trim(),
        phone: form.phone, roleId: 2, // 대표
      })
      onDone()
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <h3>대표 계정 만들기</h3>
        <p className="confirm-text">
          <strong>{tenant.tenantName}</strong>({tenant.tenantCode}) 등록 완료. 이제 로그인할 <strong>대표 계정</strong>을 만드세요.
          <br />로그인은 <strong>업체코드 + 아이디 + 비밀번호</strong>로 합니다.
        </p>

        <label className="field">
          <span>로그인 아이디 <span className="req">*</span></span>
          <input type="text" value={form.loginId} onChange={set('loginId')} placeholder="예: master" maxLength={50} autoFocus />
          <span className="field-hint">가게 안에서만 안 겹치면 됩니다(영문/숫자/._-).</span>
        </label>
        <label className="field">
          <span>초기 비밀번호 <span className="req">*</span></span>
          <input type="text" value={form.password} onChange={set('password')} placeholder="8자 이상" maxLength={64} />
          <span className="field-hint">대표에게 전달할 초기 비밀번호입니다.</span>
        </label>
        <label className="field">
          <span>이메일 <span className="muted">(선택)</span></span>
          <input type="email" value={form.email} onChange={set('email')} placeholder="owner@example.com" maxLength={150} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>대표 이름 <span className="req">*</span></span>
            <input value={form.name} onChange={set('name')} maxLength={50} />
          </label>
          <label className="field">
            <span>연락처</span>
            <input value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" maxLength={20} />
          </label>
        </div>

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>나중에</button>
          <button className="btn-primary" onClick={create} disabled={saving}>{saving ? '만드는 중…' : '대표 계정 만들기'}</button>
        </div>
      </div>
    </div>
  )
}

/** 대표 계정 만든 뒤 — 첫 지점(1호점) 등록 단계. */
function FirstBranchDialog({ tenant, onClose, onDone, onError }) {
  const [form, setForm] = useState({
    name: '', managerName: '', contactPhone: '', postalCode: '', address: '', addressDetail: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => { preloadPostcode() }, [])
  function findAddress() {
    openPostcode(
      ({ zonecode, address }) => setForm((f) => ({ ...f, postalCode: zonecode, address })),
      (e) => onError(e.message),
    )
  }

  async function create() {
    setSaving(true)
    try {
      await tenantApi.addBranch(tenant.tenantId, {
        name: form.name, managerName: form.managerName, contactPhone: form.contactPhone,
        postalCode: form.postalCode, address: form.address, addressDetail: form.addressDetail,
      })
      onDone()
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <h3>1호점 등록</h3>
        <p className="confirm-text">
          <strong>{tenant.tenantName}</strong> 대표 계정까지 만들었어요. 이제 <strong>1호점(첫 지점)</strong>을 등록하세요.
          <br />호점 번호는 자동으로 <strong>1호점</strong>이 부여됩니다.
        </p>

        <div className="field-row">
          <label className="field">
            <span>지점명 <span className="muted">(선택)</span></span>
            <input value={form.name} onChange={set('name')} placeholder="예: 본점, 강남점" maxLength={100} autoFocus />
          </label>
          <label className="field">
            <span>담당자</span>
            <input value={form.managerName} onChange={set('managerName')} maxLength={50} />
          </label>
        </div>
        <label className="field">
          <span>연락처</span>
          <input value={form.contactPhone} onChange={set('contactPhone')} placeholder="02-0000-0000" maxLength={20} />
        </label>
        <label className="field">
          <span>주소</span>
          <div className="addr-row">
            <input className="addr-zip" value={form.postalCode} placeholder="우편번호" readOnly onClick={findAddress} />
            <button type="button" className="btn-ghost btn-sm" onClick={findAddress}>주소 찾기</button>
          </div>
          <input className="addr-main" value={form.address} placeholder="주소를 검색하세요" readOnly onClick={findAddress} />
          <input value={form.addressDetail} onChange={set('addressDetail')} placeholder="상세주소" maxLength={255} />
        </label>

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>나중에</button>
          <button className="btn-primary" onClick={create} disabled={saving}>{saving ? '등록 중…' : '1호점 등록'}</button>
        </div>
      </div>
    </div>
  )
}

/** 업체의 지점(호점) 관리 — 목록 + 추가(호점 자동 채번) + 수정 + 삭제. */
function BranchModal({ tenant, onClose, onChanged, onError }) {
  const [branches, setBranches] = useState(null) // null=로딩중
  const [editing, setEditing] = useState(null) // 편집 중인 지점 { branchId? , form }
  const [delId, setDelId] = useState(null)
  const [layoutFor, setLayoutFor] = useState(null) // 테이블 배치 편집 대상 지점
  const [menuFor, setMenuFor] = useState(null) // 메뉴판 편집 대상 지점

  const load = useCallback(async () => {
    try { setBranches(await tenantApi.branches(tenant.tenantId)) }
    catch (e) { onError(e.message); setBranches([]) }
  }, [tenant.tenantId, onError])

  useEffect(() => { load(); preloadPostcode() }, [load])

  function findBranchAddress() {
    openPostcode(
      ({ zonecode, address }) => setEditing((prev) => ({ ...prev, form: { ...prev.form, postalCode: zonecode, address } })),
      (e) => onError(e.message),
    )
  }

  const emptyForm = { name: '', managerName: '', contactPhone: '', postalCode: '', address: '', addressDetail: '' }

  async function save() {
    const f = editing.form
    try {
      if (editing.branchId) await tenantApi.updateBranch(tenant.tenantId, editing.branchId, f)
      else await tenantApi.addBranch(tenant.tenantId, f)
      setEditing(null)
      await load()
      onChanged() // 목록의 지점 수 갱신
    } catch (e) { onError(e.message) }
  }

  async function remove(branchId) {
    try {
      await tenantApi.removeBranch(tenant.tenantId, branchId)
      setDelId(null)
      await load()
      onChanged()
    } catch (e) { onError(e.message) }
  }

  const setF = (k) => (e) => setEditing({ ...editing, form: { ...editing.form, [k]: e.target.value } })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal branch-modal" onClick={(e) => e.stopPropagation()}>
        <div className="branch-head">
          <h3>지점(호점) 관리</h3>
          <span className="branch-sub">{tenant.tenantName}</span>
        </div>

        {editing ? (
          <div className="branch-form">
            <h4>{editing.branchId ? `${editing.branchNo}호점 수정` : '새 지점 추가'}</h4>
            {!editing.branchId && <p className="field-hint">저장하면 다음 호점 번호가 자동으로 부여됩니다.</p>}
            <label className="field">
              <span>지점명 <span className="muted">(선택)</span></span>
              <input value={editing.form.name} onChange={setF('name')} placeholder="예: 강남점" maxLength={100} autoFocus />
            </label>
            <div className="field-row">
              <label className="field">
                <span>담당자</span>
                <input value={editing.form.managerName} onChange={setF('managerName')} maxLength={50} />
              </label>
              <label className="field">
                <span>연락처</span>
                <input value={editing.form.contactPhone} onChange={setF('contactPhone')} maxLength={20} />
              </label>
            </div>
            <label className="field">
              <span>주소</span>
              <div className="addr-row">
                <input className="addr-zip" value={editing.form.postalCode} placeholder="우편번호" readOnly onClick={findBranchAddress} />
                <button type="button" className="btn-ghost btn-sm" onClick={findBranchAddress}>주소 찾기</button>
              </div>
              <input className="addr-main" value={editing.form.address} placeholder="주소를 검색하세요" readOnly onClick={findBranchAddress} />
              <input value={editing.form.addressDetail} onChange={setF('addressDetail')} placeholder="상세주소" maxLength={255} />
            </label>
            <div className="dialog-actions">
              <button className="btn-ghost" onClick={() => setEditing(null)}>취소</button>
              <button className="btn-primary" onClick={save}>저장</button>
            </div>
          </div>
        ) : (
          <>
            {branches === null ? (
              <p className="muted branch-loading">불러오는 중…</p>
            ) : branches.length === 0 ? (
              <p className="branch-empty">아직 지점이 없습니다. 아래 버튼으로 1호점을 추가하세요.</p>
            ) : (
              <ul className="branch-list">
                {branches.map((b) => (
                  <li key={b.branchId} className="branch-item">
                    <span className="branch-no">{b.branchNo}호점</span>
                    <div className="branch-info">
                      <span className="branch-name">{b.name || `${b.branchNo}호점`}</span>
                      <span className="branch-meta">
                        {[b.managerName, b.contactPhone, b.address].filter(Boolean).join(' · ') || '정보 없음'}
                      </span>
                    </div>
                    <div className="branch-actions">
                      <button className="btn-ghost btn-sm btn-icon-text" onClick={() => setLayoutFor(b)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="12" rx="2" />
                          <path d="M7 20v-4M17 20v-4" />
                        </svg>
                        테이블
                      </button>
                      <button className="btn-ghost btn-sm btn-icon-text" onClick={() => setMenuFor(b)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 5h16M4 12h16M4 19h10" />
                        </svg>
                        메뉴판
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => setEditing({
                        branchId: b.branchId, branchNo: b.branchNo,
                        form: {
                          name: b.name ?? '', managerName: b.managerName ?? '', contactPhone: b.contactPhone ?? '',
                          postalCode: b.postalCode ?? '', address: b.address ?? '', addressDetail: b.addressDetail ?? '',
                        },
                      })}>수정</button>
                      <button className="btn-danger btn-sm" onClick={() => setDelId(b.branchId)}>삭제</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="dialog-actions">
              <button className="btn-ghost" onClick={onClose}>닫기</button>
              <button className="btn-primary" onClick={() => setEditing({ branchId: null, form: emptyForm })}>+ 지점 추가</button>
            </div>
          </>
        )}

        {delId !== null && (
          <div className="modal-backdrop" onClick={() => setDelId(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>지점 삭제</h3>
              <p className="confirm-text">이 지점을 삭제하시겠습니까?</p>
              <div className="dialog-actions">
                <button className="btn-ghost" onClick={() => setDelId(null)}>취소</button>
                <button className="btn-primary btn-danger-solid" onClick={() => remove(delId)}>삭제</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {layoutFor && (
        <TableLayoutEditor
          loadLayout={() => tenantApi.layout(tenant.tenantId, layoutFor.branchId)}
          onSave={(body) => tenantApi.saveLayout(tenant.tenantId, layoutFor.branchId, body)}
          loadTableQr={(table) => tenantApi.tableQr(tenant.tenantId, layoutFor.branchId, table.tableId)}
          loadSeatOptions={seatOptionsFromCodes}
          subtitle={`${layoutFor.branchNo}호점${layoutFor.name ? ` (${layoutFor.name})` : ''}`}
          onClose={() => setLayoutFor(null)}
          onError={onError}
        />
      )}

      {menuFor && (
        <MenuEditor
          tenantId={tenant.tenantId}
          branch={menuFor}
          branches={branches ?? []}
          onClose={() => setMenuFor(null)}
          onError={onError}
        />
      )}
    </div>
  )
}


/** 등록/수정 폼 — 업체 정보만. */
function TenantDialog({ dialog, plans, onClose, onSaved, onError }) {
  const editing = dialog.mode === 'edit'
  const t = dialog.tenant
  const [form, setForm] = useState({
    tenantName: t?.tenantName ?? '',
    tenantSlug: t?.tenantSlug ?? '',
    planId: t?.planId ?? '',
    ownerName: t?.ownerName ?? '',
    businessNo: t?.businessNo ?? '',
    contactPhone: t?.contactPhone ?? '',
    contactEmail: t?.contactEmail ?? '',
    postalCode: t?.postalCode ?? '',
    address: t?.address ?? '',
    addressDetail: t?.addressDetail ?? '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  useEffect(() => { preloadPostcode() }, [])
  function findAddress() {
    openPostcode(
      ({ zonecode, address }) => setForm((f) => ({ ...f, postalCode: zonecode, address })),
      (e) => onError(e.message),
    )
  }

  async function save() {
    if (!form.tenantName.trim()) { onError('업체명을 입력하세요.'); return }
    const slug = form.tenantSlug.trim().toLowerCase()
    if (slug.length < 3) { onError('경로(slug)는 3자 이상이어야 합니다.'); return }
    setSaving(true)
    try {
      const body = {
        tenantName: form.tenantName.trim(),
        tenantSlug: slug,
        planId: form.planId === '' ? null : Number(form.planId),
        ownerName: form.ownerName,
        businessNo: form.businessNo,
        contactPhone: form.contactPhone,
        contactEmail: form.contactEmail,
        postalCode: form.postalCode,
        address: form.address,
        addressDetail: form.addressDetail,
      }
      let created = null
      if (editing) await tenantApi.update(t.tenantId, body)
      else created = await tenantApi.create(body)
      onSaved(created) // 신규 등록이면 created(대표 계정 단계용), 수정이면 null
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  return (
    <Modal title={editing ? '업체 수정' : '업체 등록'} onClose={onClose}>
      {editing && (
        <div className="readonly-field">
          <span>업체 코드</span>
          <strong className="mono">{t.tenantCode}</strong>
        </div>
      )}

      <label className="field">
        <span>업체명 <span className="req">*</span></span>
        <input value={form.tenantName} onChange={set('tenantName')} autoFocus maxLength={100} />
      </label>

      <label className="field">
        <span>경로(slug) <span className="req">*</span></span>
        <input value={form.tenantSlug} onChange={set('tenantSlug')} placeholder="delicious" maxLength={30} />
        <span className="field-hint">
          영소문자·숫자·하이픈, 3~30자.
          {editing ? ' 바꾸면 기존 주소·QR 링크가 새 경로로 바뀝니다.' : ''}
        </span>
      </label>

      <div className="field-row">
        <label className="field">
          <span>요금제</span>
          <select value={form.planId} onChange={set('planId')}>
            <option value="">(없음)</option>
            {plans.map((p) => <option key={p.planId} value={p.planId}>{p.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>대표자명</span>
          <input value={form.ownerName} onChange={set('ownerName')} maxLength={50} />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>사업자등록번호</span>
          <input value={form.businessNo} onChange={set('businessNo')} placeholder="123-45-67890" maxLength={20} />
        </label>
        <label className="field">
          <span>연락처</span>
          <input value={form.contactPhone} onChange={set('contactPhone')} placeholder="02-1234-5678" maxLength={20} />
        </label>
      </div>

      <label className="field">
        <span>연락 이메일</span>
        <input type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="shop@example.com" maxLength={150} />
      </label>

      <label className="field">
        <span>주소</span>
        <div className="addr-row">
          <input className="addr-zip" value={form.postalCode} placeholder="우편번호" readOnly onClick={findAddress} />
          <button type="button" className="btn-ghost btn-sm" onClick={findAddress}>주소 찾기</button>
        </div>
        <input className="addr-main" value={form.address} placeholder="주소를 검색하세요" readOnly onClick={findAddress} />
        <input value={form.addressDetail} onChange={set('addressDetail')} placeholder="상세주소" maxLength={255} />
      </label>

      <div className="dialog-actions">
        <button className="btn-ghost" onClick={onClose}>취소</button>
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
      </div>
    </Modal>
  )
}

/** 삭제/복구/개설/중지 확인. 중지는 사유 입력을 함께 받는다. */
function ConfirmDialog({ confirm, onClose, onDone, onError }) {
  const { mode, tenant } = confirm
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const meta = {
    delete: { title: '업체 삭제', text: '이 업체를 삭제하시겠습니까? 목록에서 숨겨지고 나중에 복구할 수 있습니다.', btn: '삭제', danger: true },
    restore: { title: '업체 복구', text: '삭제된 업체를 복구하시겠습니까?', btn: '복구', danger: false },
    activate: { title: '서비스 개설', text: '이 업체를 개설(ACTIVE)하시겠습니까? 고객 화면에 노출됩니다.', btn: '개설', danger: false },
    suspend: { title: '서비스 중지', text: '이 업체를 중지(SUSPENDED)하시겠습니까?', btn: '중지', danger: true },
  }[mode]

  async function run() {
    setBusy(true)
    try {
      if (mode === 'delete') await tenantApi.remove(tenant.tenantId)
      else if (mode === 'restore') await tenantApi.restore(tenant.tenantId)
      else if (mode === 'activate') await tenantApi.activate(tenant.tenantId)
      else if (mode === 'suspend') await tenantApi.suspend(tenant.tenantId, reason.trim() || '사유 미입력')
      onDone()
    } catch (e) { onError(e.message); onClose() } finally { setBusy(false) }
  }

  return (
    <Modal title={meta.title} onClose={onClose}>
      <p className="confirm-text"><strong>{tenant.tenantName}</strong> — {meta.text}</p>
      {mode === 'suspend' && (
        <label className="field">
          <span>중지 사유</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="예: 요금 미납" />
        </label>
      )}
      <div className="dialog-actions">
        <button className="btn-ghost" onClick={onClose}>취소</button>
        <button className={meta.danger ? 'btn-primary btn-danger-solid' : 'btn-primary'} onClick={run} disabled={busy}>
          {busy ? '처리 중…' : meta.btn}
        </button>
      </div>
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
