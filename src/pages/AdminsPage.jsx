import { useCallback, useEffect, useState } from 'react'
import { adminApi } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Shell from '../components/Shell'

const STATUS_LABEL = { ACTIVE: '재직', LOCKED: '잠김', DISABLED: '중지' }

// 서버(AdminAccount.DEFAULT_PASSWORD)와 같은 값. 안내 문구에만 쓴다.
const DEFAULT_PASSWORD = 'exprism1234!'

export default function AdminsPage() {
  const { user } = useAuth()
  const [admins, setAdmins] = useState([])
  const [total, setTotal] = useState(0)
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [dialog, setDialog] = useState(null) // { mode: 'create' | 'edit' | 'password' | 'retire', admin }
  const [menu, setMenu] = useState(null) // { x, y, admin }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const page = await adminApi.list({ includeDeleted })
      setAdmins(page?.content ?? [])
      setTotal(page?.totalElements ?? 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [includeDeleted])

  useEffect(() => {
    load()
  }, [load])

  // 메뉴는 아무 데나 클릭하거나 Esc 를 누르면 닫힌다. 스크롤해도 닫는다 —
  // 안 그러면 메뉴만 제자리에 남아 엉뚱한 행을 가리키게 된다.
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

  function openMenu(event, admin) {
    event.preventDefault()
    if (admin.deleted) return // 퇴사한 사람에게는 할 수 있는 게 없다
    setMenu({ x: event.clientX, y: event.clientY, admin })
  }

  function openEdit(admin) {
    if (admin.deleted) return
    setDialog({ mode: 'edit', admin })
  }

  return (
    <Shell>
      <div className="page-head">
        <h2>관리자</h2>
        <span className="count">{loading ? '' : `${total}명`}</span>
        <div className="page-actions">
          <label className="check">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
            />
            퇴사자 포함
          </label>
          <button className="btn-primary btn-sm" onClick={() => setDialog({ mode: 'create' })}>
            + 관리자 추가
          </button>
        </div>
      </div>

      {error && <p className="alert">{error}</p>}

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>사번</th>
                  <th>이름</th>
                  <th className="col-grow">이메일</th>
                  <th>연락처</th>
                  <th>상태</th>
                  <th>최근 로그인</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr
                    key={admin.empNo}
                    className={admin.deleted ? 'row-deleted' : 'row-clickable'}
                    onDoubleClick={() => openEdit(admin)}
                    onContextMenu={(e) => openMenu(e, admin)}
                  >
                    <td className="mono strong">{admin.empNo}</td>
                    <td>
                      {admin.name}
                      {admin.empNo === user?.empNo && <span className="tag-self">나</span>}
                    </td>
                    <td className="muted-cell">{admin.email ?? '-'}</td>
                    <td className="muted-cell">{admin.phone ?? '-'}</td>
                    <td>
                      {admin.deleted ? (
                        <span className="badge badge-suspended">퇴사</span>
                      ) : (
                        <span className={`badge badge-${admin.status.toLowerCase()}`}>
                          {admin.locked ? '잠김' : STATUS_LABEL[admin.status]}
                        </span>
                      )}
                    </td>
                    <td className="muted-cell">{formatDate(admin.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint left table-hint">
            행을 더블클릭하면 수정, 우클릭하면 메뉴가 열립니다.
          </p>
        </>
      )}

      {menu && (
        <ul
          className="context-menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <li onClick={() => { setDialog({ mode: 'edit', admin: menu.admin }); setMenu(null) }}>수정</li>
          <li onClick={() => { setDialog({ mode: 'reset', admin: menu.admin }); setMenu(null) }}>
            비밀번호 초기화
          </li>
          <li
            className="danger"
            onClick={() => { setDialog({ mode: 'retire', admin: menu.admin }); setMenu(null) }}
          >
            퇴사처리
          </li>
        </ul>
      )}

      {dialog && (
        <AdminDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null)
            await load()
          }}
          onError={setError}
        />
      )}
    </Shell>
  )
}

function AdminDialog({ dialog, onClose, onSaved, onError }) {
  const { mode, admin } = dialog
  const [form, setForm] = useState({
    name: admin?.name ?? '',
    email: admin?.email ?? '',
    phone: admin?.phone ?? '',
    status: admin?.status ?? 'ACTIVE',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [issuedEmpNo, setIssuedEmpNo] = useState(null)
  const [resetDone, setResetDone] = useState(null) // 초기화된 비밀번호

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

  const title = mode === 'create' ? '관리자 추가' : `${admin.empNo} 수정`

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
        })
        setIssuedEmpNo(created.empNo)
        return // 발급된 사번을 보여준 뒤 닫는다
      }
      await adminApi.update(admin.empNo, {
        name: form.name,
        email: form.email,
        phone: form.phone,
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
      <form onSubmit={handleSubmit}>
        {error && <p className="alert">{error}</p>}

        {(
          <>
            <label className="field">
              <span>이름</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span>이메일 (연락용, 선택)</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="chulsoo@example.com"
              />
            </label>
            <label className="field">
              <span>연락처 (선택)</span>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="010-1234-5678"
              />
            </label>
          </>
        )}

        {mode === 'edit' && (
          <label className="field">
            <span>상태</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">재직</option>
              <option value="DISABLED">중지 (로그인 차단)</option>
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

function formatDate(value) {
  if (!value) return '-'
  return value.slice(0, 16).replace('T', ' ')
}
