import { useCallback, useEffect, useState } from 'react'
import { staffApi } from '../api/client'

const ROLE_OPTIONS = [
  { id: 2, name: '대표' },
  { id: 3, name: '매니저' },
  { id: 4, name: '직원' },
]
const STATUS_LABEL = { ACTIVE: '활성', SUSPENDED: '정지', INVITED: '초대됨' }

function fmt(dt) {
  return dt ? dt.slice(0, 16).replace('T', ' ') : '-'
}

/** 업체 직원(로그인 계정) 관리 모달. */
export default function StaffModal({ tenant, onClose, onError }) {
  const tid = tenant.tenantId
  const [staff, setStaff] = useState(null)
  const [dialog, setDialog] = useState(null) // { staff? }
  const [resetFor, setResetFor] = useState(null)
  const [delFor, setDelFor] = useState(null)

  const load = useCallback(async () => {
    try { setStaff(await staffApi.list(tid)) }
    catch (e) { onError(e.message); setStaff([]) }
  }, [tid, onError])
  useEffect(() => { load() }, [load])

  async function remove(s) {
    try { await staffApi.remove(tid, s.tenantUserId); setDelFor(null); await load() }
    catch (e) { onError(e.message); setDelFor(null) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal staff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="branch-head">
          <h3>직원 관리</h3>
          <span className="branch-sub">{tenant.tenantName}</span>
          <button className="btn-primary btn-sm menu-copy-btn" onClick={() => setDialog({})}>＋ 직원 추가</button>
        </div>

        {staff === null ? (
          <p className="muted" style={{ padding: 30, textAlign: 'center' }}>불러오는 중…</p>
        ) : staff.length === 0 ? (
          <p className="muted" style={{ padding: 30, textAlign: 'center' }}>등록된 직원이 없습니다.</p>
        ) : (
          <div className="table-wrap staff-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th><th>아이디</th><th style={{ width: 80 }}>역할</th>
                  <th style={{ width: 70 }}>상태</th><th style={{ width: 130 }}>최근 접속</th>
                  <th style={{ width: 200 }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.tenantUserId} className={s.status === 'SUSPENDED' ? 'row-deleted' : ''}>
                    <td className="strong">{s.name}</td>
                    <td className="mono">{s.loginId || <span className="muted">-</span>}</td>
                    <td><span className={`badge${s.roleId === 2 ? ' badge-active' : ''}`}>{s.roleName}</span></td>
                    <td><span className={`badge badge-${s.status === 'ACTIVE' ? 'active' : 'suspended'}`}>{STATUS_LABEL[s.status] ?? s.status}</span></td>
                    <td className="muted-cell">{fmt(s.lastLoginAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-ghost btn-sm" onClick={() => setDialog({ staff: s })}>수정</button>
                        <button className="btn-ghost btn-sm" onClick={() => setResetFor(s)}>비번</button>
                        {s.roleId !== 2 && <button className="btn-danger btn-sm" onClick={() => setDelFor(s)}>삭제</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>

        {dialog && (
          <StaffDialog
            tid={tid} staff={dialog.staff}
            onClose={() => setDialog(null)}
            onSaved={() => { setDialog(null); load() }}
            onError={onError}
          />
        )}
        {resetFor && (
          <ResetDialog
            tid={tid} staff={resetFor}
            onClose={() => setResetFor(null)}
            onDone={() => setResetFor(null)}
            onError={onError}
          />
        )}
        {delFor && (
          <div className="modal-backdrop" onClick={() => setDelFor(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>직원 삭제</h3>
              <p className="confirm-text"><strong>{delFor.name}</strong>({delFor.email}) 계정을 삭제하시겠습니까? 로그인할 수 없게 됩니다.</p>
              <div className="dialog-actions">
                <button className="btn-ghost" onClick={() => setDelFor(null)}>취소</button>
                <button className="btn-primary btn-danger-solid" onClick={() => remove(delFor)}>삭제</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** 직원 생성/수정. 생성 시 이메일·초기비번, 수정 시 이름·연락처·역할·상태. */
function StaffDialog({ tid, staff, onClose, onSaved, onError }) {
  const editing = !!staff
  const [form, setForm] = useState({
    loginId: staff?.loginId ?? '',
    email: staff?.email ?? '',
    password: '',
    name: staff?.name ?? '',
    phone: staff?.phone ?? '',
    roleId: staff?.roleId ?? 4,
    status: staff?.status ?? 'ACTIVE',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function save() {
    if (!form.name.trim()) { onError('이름을 입력하세요.'); return }
    if (!editing) {
      if (!/^[a-zA-Z0-9._-]{3,50}$/.test(form.loginId.trim())) {
        onError('아이디는 영문/숫자/._- 조합 3~50자입니다.'); return
      }
      if (form.password.length < 8) { onError('초기 비밀번호는 8자 이상이어야 합니다.'); return }
    }
    setSaving(true)
    try {
      if (editing) {
        await staffApi.update(tid, staff.tenantUserId, {
          name: form.name.trim(), phone: form.phone, roleId: Number(form.roleId), status: form.status,
        })
      } else {
        await staffApi.create(tid, {
          loginId: form.loginId.trim(),
          email: form.email.trim() || undefined,
          password: form.password, name: form.name.trim(),
          phone: form.phone, roleId: Number(form.roleId),
        })
      }
      onSaved()
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
        <h3>{editing ? '직원 정보 수정' : '직원 추가'}</h3>

        {editing ? (
          <div className="readonly-field"><span>아이디</span><strong className="mono">{staff.loginId || '-'}</strong></div>
        ) : (
          <label className="field">
            <span>로그인 아이디 <span className="req">*</span></span>
            <input type="text" value={form.loginId} onChange={set('loginId')} placeholder="예: staff01" maxLength={50} autoFocus />
            <span className="field-hint">가게 안에서만 안 겹치면 됩니다(영문/숫자/._-).</span>
          </label>
        )}

        {!editing && (
          <>
            <label className="field">
              <span>초기 비밀번호 <span className="req">*</span></span>
              <input type="text" value={form.password} onChange={set('password')} placeholder="8자 이상" maxLength={64} />
              <span className="field-hint">직원에게 전달할 초기 비밀번호입니다.</span>
            </label>
            <label className="field">
              <span>이메일 <span className="muted">(선택)</span></span>
              <input type="email" value={form.email} onChange={set('email')} placeholder="staff@example.com" maxLength={150} />
            </label>
          </>
        )}

        <div className="field-row">
          <label className="field">
            <span>이름 <span className="req">*</span></span>
            <input value={form.name} onChange={set('name')} maxLength={50} autoFocus={editing} />
          </label>
          <label className="field">
            <span>연락처</span>
            <input value={form.phone} onChange={set('phone')} placeholder="010-0000-0000" maxLength={20} />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>역할</span>
            <select value={form.roleId} onChange={set('roleId')}>
              {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          {editing && (
            <label className="field">
              <span>상태</span>
              <select value={form.status} onChange={set('status')}>
                <option value="ACTIVE">활성</option>
                <option value="SUSPENDED">정지</option>
              </select>
            </label>
          )}
        </div>

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

/** 비밀번호 재설정. */
function ResetDialog({ tid, staff, onClose, onDone, onError }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  async function run() {
    if (pw.length < 8) { onError('비밀번호는 8자 이상이어야 합니다.'); return }
    setBusy(true)
    try { await staffApi.resetPassword(tid, staff.tenantUserId, pw); onDone() }
    catch (e) { onError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 380 }}>
        <h3>비밀번호 재설정</h3>
        <p className="confirm-text"><strong>{staff.name}</strong>({staff.email})</p>
        <label className="field">
          <span>새 비밀번호</span>
          <input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="8자 이상" maxLength={64} autoFocus />
        </label>
        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={run} disabled={busy}>{busy ? '변경 중…' : '변경'}</button>
        </div>
      </div>
    </div>
  )
}
