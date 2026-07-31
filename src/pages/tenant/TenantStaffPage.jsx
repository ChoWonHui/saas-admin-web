import { useCallback, useEffect, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import { tenantStaffApi } from '../../api/tenantClient'

// 역할: 2=대표 3=홀 4=주방. 대표는 콘솔에서 배정 불가(가게당 1명).
const ROLE = {
  2: { label: '대표', cls: 'owner' },
  3: { label: '홀', cls: 'manager' },
  4: { label: '주방', cls: 'staff' },
}
const ASSIGNABLE = [{ id: 3, label: '홀' }, { id: 4, label: '주방' }]
function initial(name) { return (name || '?').trim().charAt(0) }
function when(dt) { return dt ? dt.slice(0, 10) + ' ' + dt.slice(11, 16) : '없음' }

export default function TenantStaffPage() {
  const [staff, setStaff] = useState(null)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null) // { mode, member? }

  const load = useCallback(async () => {
    try { setStaff(await tenantStaffApi.list()) }
    catch (e) { setError(e.message); setStaff([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function saved() { setDialog(null); await load() }

  return (
    <TenantShell>
      <div className="m-topline">
        <div className="m-page-head">
          <h1>직원 관리</h1>
          <p>홀·주방 직원의 로그인 계정을 만들고 역할과 상태를 관리하세요.</p>
        </div>
        <button className="m-btn m-btn-primary" onClick={() => setDialog({ mode: 'create' })}>
          <Icon name="person_add" /> 직원 추가
        </button>
      </div>

      {staff === null ? (
        <Loading label="직원을 불러오는 중…" />
      ) : staff.length === 0 ? (
        <div className="m-card m-empty"><Icon name="group" /><p>등록된 직원이 없습니다. 오른쪽 위 “직원 추가”로 만드세요.</p></div>
      ) : (
        <div className="stf-grid">
          {staff.map((m) => {
            const role = ROLE[m.roleId] || { label: m.roleName, cls: 'staff' }
            const suspended = m.status === 'SUSPENDED'
            const isOwner = m.roleId === 2
            return (
              <div key={m.tenantUserId} className={`m-card stf-card${suspended ? ' off' : ''}`}>
                <div className="stf-top">
                  <span className={`stf-avatar ${role.cls}`}>{initial(m.name)}</span>
                  <div className="stf-id">
                    <div className="stf-name">{m.name}<span className={`stf-role ${role.cls}`}>{role.label}</span></div>
                    <div className="stf-login"><Icon name="badge" />{m.loginId || m.email}</div>
                  </div>
                </div>
                <div className="stf-meta">
                  <span className={`stf-status ${suspended ? 'off' : 'on'}`}>{suspended ? '정지' : '활성'}</span>
                  <span className="stf-last">최근 로그인 {when(m.lastLoginAt)}</span>
                </div>
                <div className="stf-actions">
                  <button className="btn-ghost btn-sm" onClick={() => setDialog({ mode: 'edit', member: m })}>수정</button>
                  <button className="btn-ghost btn-sm" onClick={() => setDialog({ mode: 'password', member: m })}>비번 재설정</button>
                  {!isOwner && (
                    <button className="btn-danger btn-sm" onClick={() => setDialog({ mode: 'delete', member: m })}>삭제</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {dialog && (
        <StaffDialog dialog={dialog} onClose={() => setDialog(null)} onSaved={saved} onError={setError} />
      )}
      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}

function StaffDialog({ dialog, onClose, onSaved, onError }) {
  const { mode, member } = dialog
  const [form, setForm] = useState({
    loginId: '',
    email: member?.email || '',
    password: '',
    name: member?.name || '',
    phone: member?.phone || '',
    roleId: member?.roleId && member.roleId !== 2 ? member.roleId : 4,
    status: member?.status || 'ACTIVE',
    newPassword: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const isOwner = member?.roleId === 2

  // 삭제 확인
  if (mode === 'delete') {
    async function remove() {
      setSaving(true)
      try { await tenantStaffApi.remove(member.tenantUserId); await onSaved() }
      catch (e) { onError(e.message); onClose() }
    }
    return (
      <Modal title="직원 삭제" onClose={onClose}>
        <p className="confirm-text"><strong>{member.name}({member.loginId})</strong> 직원을 삭제하시겠습니까?</p>
        <p className="hint left">로그인 계정이 사라져 더 이상 이 아이디로 로그인할 수 없습니다.</p>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
          <button type="button" className="btn-danger" onClick={remove} disabled={saving}>{saving ? '처리 중…' : '삭제'}</button>
        </div>
      </Modal>
    )
  }

  // 비밀번호 재설정
  if (mode === 'password') {
    async function reset(e) {
      e.preventDefault()
      setSaving(true)
      try { await tenantStaffApi.resetPassword(member.tenantUserId, form.newPassword); await onSaved() }
      catch (err) { onError(err.message) } finally { setSaving(false) }
    }
    return (
      <Modal title={`${member.name} 비밀번호 재설정`} onClose={onClose}>
        <form onSubmit={reset}>
          <label className="field">
            <span>새 비밀번호 (8자 이상)</span>
            <input type="password" value={form.newPassword} onChange={set('newPassword')} minLength={8} required autoFocus />
          </label>
          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중…' : '재설정'}</button>
          </div>
        </form>
      </Modal>
    )
  }

  // 추가 / 수정
  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (mode === 'create') {
        await tenantStaffApi.create({
          loginId: form.loginId.trim(),
          email: form.email.trim() || undefined,
          password: form.password,
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          roleId: Number(form.roleId),
        })
      } else {
        await tenantStaffApi.update(member.tenantUserId, {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          roleId: isOwner ? 2 : Number(form.roleId),
          status: form.status,
        })
      }
      await onSaved()
    } catch (err) { onError(err.message) } finally { setSaving(false) }
  }

  return (
    <Modal title={mode === 'create' ? '직원 추가' : `${member.name} 정보 수정`} onClose={onClose}>
      <form onSubmit={submit}>
        {mode === 'create' && (
          <>
            <label className="field">
              <span>로그인 아이디 (영문/숫자/._- 3~50자)</span>
              <input value={form.loginId} onChange={set('loginId')} placeholder="staff01" required autoFocus />
            </label>
            <label className="field">
              <span>초기 비밀번호 (8자 이상)</span>
              <input type="password" value={form.password} onChange={set('password')} minLength={8} required />
            </label>
          </>
        )}
        {mode === 'edit' && (
          <p className="hint left">로그인 아이디 <b>{member.loginId}</b> — 아이디는 바꿀 수 없습니다.</p>
        )}

        <label className="field">
          <span>이름</span>
          <input value={form.name} onChange={set('name')} maxLength={50} required />
        </label>
        <div className="field-row">
          <label className="field">
            <span>연락처 (선택)</span>
            <input value={form.phone} onChange={set('phone')} maxLength={20} placeholder="010-0000-0000" />
          </label>
          {mode === 'create' && (
            <label className="field">
              <span>이메일 (선택)</span>
              <input type="email" value={form.email} onChange={set('email')} placeholder="비밀번호 찾기용" />
            </label>
          )}
        </div>

        <div className="field-row">
          <label className="field">
            <span>역할</span>
            {isOwner ? (
              <input value="대표" disabled />
            ) : (
              <select value={form.roleId} onChange={set('roleId')}>
                {ASSIGNABLE.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            )}
          </label>
          {mode === 'edit' && (
            <label className="field">
              <span>상태</span>
              <select value={form.status} onChange={set('status')}>
                <option value="ACTIVE">활성</option>
                <option value="SUSPENDED">정지 (로그인 차단)</option>
              </select>
            </label>
          )}
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
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
