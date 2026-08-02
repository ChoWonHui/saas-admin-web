import { useCallback, useEffect, useRef, useState } from 'react'
import { staffApi } from '../api/client'

const ROLE_OPTIONS = [
  { id: 2, name: '대표' },
  { id: 3, name: '홀' },
  { id: 4, name: '주방' },
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
                  <th>이름</th><th>로그인 이메일</th><th style={{ width: 80 }}>역할</th>
                  <th style={{ width: 70 }}>상태</th><th style={{ width: 130 }}>최근 접속</th>
                  <th style={{ width: 200 }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.tenantUserId} className={s.status === 'SUSPENDED' ? 'row-deleted' : ''}>
                    <td className="strong">{s.name}</td>
                    <td className="mono">{s.email || s.loginId || <span className="muted">-</span>}</td>
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
    email: staff?.email ?? '',
    password: '',
    name: staff?.name ?? '',
    phone: staff?.phone ?? '',
    roleId: staff?.roleId ?? 4,
    status: staff?.status ?? 'ACTIVE',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  // 이메일 다 입력하면(타이핑을 멈추면) 저장 전에 중복 여부를 미리 확인한다.
  // status: idle | invalid | checking | ok | dup
  const [emailCheck, setEmailCheck] = useState({ status: 'idle' })
  const reqIdRef = useRef(0)
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  useEffect(() => {
    if (editing) return
    const email = form.email.trim()
    if (!email) { setEmailCheck({ status: 'idle' }); return }
    if (!EMAIL_RE.test(email)) { setEmailCheck({ status: 'invalid' }); return }
    setEmailCheck({ status: 'checking' })
    const myId = ++reqIdRef.current
    const timer = setTimeout(async () => {
      try {
        const r = await staffApi.emailAvailable(tid, email)
        if (myId !== reqIdRef.current) return // 그 사이 이메일이 또 바뀜 — 무시
        setEmailCheck({ status: r.available ? 'ok' : 'dup' })
      } catch {
        if (myId === reqIdRef.current) setEmailCheck({ status: 'idle' })
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [form.email, editing, tid])

  async function save() {
    if (!form.name.trim()) { onError('이름을 입력하세요.'); return }
    if (!editing) {
      if (!EMAIL_RE.test(form.email.trim())) {
        onError('이메일 형식이 올바르지 않습니다.'); return
      }
      if (emailCheck.status === 'dup') { onError('이미 사용 중인 이메일입니다.'); return }
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
          email: form.email.trim(),
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
          <div className="readonly-field"><span>로그인 이메일</span><strong className="mono">{staff.email || staff.loginId || '-'}</strong></div>
        ) : (
          <label className="field">
            <span>로그인 이메일 <span className="req">*</span></span>
            <input
              type="email" value={form.email} onChange={set('email')}
              placeholder="staff@example.com" maxLength={150} autoFocus
              className={emailCheck.status === 'dup' ? 'input-error' : emailCheck.status === 'ok' ? 'input-ok' : ''}
            />
            {emailCheck.status === 'checking' && <span className="field-hint">중복 확인 중…</span>}
            {emailCheck.status === 'invalid' && <span className="field-hint err">이메일 형식이 올바르지 않습니다.</span>}
            {emailCheck.status === 'dup' && <span className="field-hint err">이미 사용 중인 이메일입니다.</span>}
            {emailCheck.status === 'ok' && <span className="field-hint ok">사용할 수 있는 이메일입니다.</span>}
            {(emailCheck.status === 'idle') && <span className="field-hint">이 이메일로 로그인합니다(업체코드 + 이메일 + 비밀번호).</span>}
          </label>
        )}

        {!editing && (
          <label className="field">
            <span>초기 비밀번호 <span className="req">*</span></span>
            <input type="text" value={form.password} onChange={set('password')} placeholder="8자 이상" maxLength={64} />
            <span className="field-hint">직원에게 전달할 초기 비밀번호입니다.</span>
          </label>
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
          <button className="btn-primary" onClick={save} disabled={saving || (!editing && (emailCheck.status === 'dup' || emailCheck.status === 'checking'))}>{saving ? '저장 중…' : '저장'}</button>
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
