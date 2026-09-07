import { useCallback, useEffect, useState } from 'react'
import Shell from '../components/Shell'
import Toast from '../components/Toast'
import { tenantApi, tenantMenuPolicyApi } from '../api/client'

const EMPTY_FORM = { name: '', url: '', icon: '' }

/** 요금제 안의 역할 3칸. 순서는 화면·저장 양쪽에서 이 배열 하나만 본다. */
const ROLES = [
  { key: 'allowOwner', label: '대표' },
  { key: 'allowHall', label: '홀' },
  { key: 'allowKitchen', label: '주방' },
]

/** 요금제별 노출 한 칸을 꺼낸다. 서버가 전 요금제를 채워 주지만, 없을 때도 안전하게 꺼진 칸을 준다. */
function accessOf(menu, planId) {
  return (menu.plans ?? []).find((p) => p.planId === planId)
    ?? { planId, allowOwner: false, allowHall: false, allowKitchen: false }
}

/**
 * 사장님 콘솔 메뉴 정책(전역) — 우리 서비스를 쓰는 모든 업체가 동일하게 적용받는다.
 *
 * 노출은 <b>메뉴 × 요금제 × 역할</b> 3차원이다. 같은 "주문" 메뉴라도
 * 베이직에서는 홀까지, 프로에서는 주방까지 열 수 있다. 그래서 표의 머리를 두 줄로 나눠
 * 요금제로 묶고 그 아래 역할 3칸을 둔다.
 */
export default function TenantConsoleMenuPage() {
  const [menus, setMenus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // { mode:'create'|'edit', item? }
  const [plans, setPlans] = useState([])
  useEffect(() => { tenantApi.plans().then(setPlans).catch(() => {}) }, [])

  const load = useCallback(async () => {
    try { setMenus(await tenantMenuPolicyApi.list()) }
    catch (e) { setError(e.message); setMenus([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function run(fn) {
    setBusy(true)
    try { await fn(); await load() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  // 수정 API 는 전체를 덮어쓴다. 체크 하나를 바꿔도 나머지 칸을 그대로 실어 보낸다.
  const toggle = (menu, planId, roleKey) => run(() => tenantMenuPolicyApi.update(menu.id, {
    name: menu.name,
    url: menu.url,
    icon: menu.icon || '',
    plans: plans.map((p) => {
      const a = accessOf(menu, p.planId)
      return p.planId === planId ? { ...a, [roleKey]: !a[roleKey] } : a
    }),
  }))

  const del = (m) => run(() => tenantMenuPolicyApi.remove(m.id))

  return (
    <Shell>
      <div className="page-head">
        <h2>업체 메뉴 정책</h2>
        <span className="count">{menus ? `${menus.length}개` : ''}</span>
        <div className="page-actions">
          <button className="btn-primary btn-sm" onClick={() => setEditing({ mode: 'create' })}>+ 메뉴 추가</button>
        </div>
      </div>

      <p className="hint left" style={{ margin: '0 0 12px' }}>
        모든 업체의 <b>사장님 콘솔</b>에 동일하게 적용되는 메뉴 정책입니다.
        요금제별로 제공되는 메뉴와 역할별 접근 권한을 설정합니다.
      </p>

      <Toast message={error} onClose={() => setError('')} />

      {menus === null ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <div className="table-wrap">
          <table className="table tmp-table">
            <thead>
              <tr>
                <th rowSpan={2}>메뉴</th>
                <th rowSpan={2} className="col-grow">URL</th>
                {plans.map((p, i) => (
                  <th key={p.planId} colSpan={ROLES.length} className={`tmp-plan tmp-plan-${i % 4}`}>
                    {p.name}
                  </th>
                ))}
                <th rowSpan={2} className="tmp-actions-head">관리</th>
              </tr>
              <tr>
                {plans.map((p, i) => ROLES.map((r, j) => (
                  <th key={`${p.planId}-${r.key}`} className={`tmp-role tmp-plan-${i % 4}${j === 0 ? ' tmp-split' : ''}`}>
                    {r.label}
                  </th>
                )))}
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.id}>
                  <td className="strong tmp-name">
                    {m.icon && <span className="material-symbols-outlined">{m.icon}</span>}
                    {m.name}
                  </td>
                  <td className="mono muted-cell">{m.url}</td>
                  {plans.map((p, i) => {
                    const a = accessOf(m, p.planId)
                    return ROLES.map((r, j) => (
                      <td key={`${p.planId}-${r.key}`} className={`tmp-cell tmp-plan-${i % 4}${j === 0 ? ' tmp-split' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!!a[r.key]}
                          disabled={busy}
                          onChange={() => toggle(m, p.planId, r.key)}
                          aria-label={`${m.name} · ${p.name} · ${r.label}`}
                        />
                      </td>
                    ))
                  })}
                  <td className="tmp-actions">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing({ mode: 'edit', item: m })}>수정</button>
                    <button className="btn-ghost btn-sm danger" onClick={() => del(m)} disabled={busy}>삭제</button>
                  </td>
                </tr>
              ))}
              {menus.length === 0 && (
                <tr>
                  <td colSpan={3 + plans.length * ROLES.length} className="muted" style={{ textAlign: 'center', padding: 16 }}>
                    메뉴가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="tmp-note">
        <span className="material-symbols-outlined">info</span>
        체크를 모두 끄면 그 요금제에는 이 메뉴가 아예 없습니다. 대표도 보지 못합니다.
      </p>

      {editing && (
        <MenuEditDialog
          dialog={editing}
          plans={plans}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load() }}
          onError={setError}
        />
      )}
    </Shell>
  )
}

/** 메뉴 추가·수정. 요금제가 여러 개라 노출 설정은 작은 표로 보여 준다. */
function MenuEditDialog({ dialog, plans = [], onClose, onSaved, onError }) {
  const { mode, item } = dialog
  const [form, setForm] = useState(item
    ? { name: item.name, url: item.url, icon: item.icon || '' }
    : { ...EMPTY_FORM })
  // 새 메뉴는 전 요금제에서 대표만 보이게 시작한다. 추가하자마자 사라져 보이는 일을 막는다.
  const [access, setAccess] = useState(() => Object.fromEntries(
    plans.map((p) => [p.planId, item
      ? { ...accessOf(item, p.planId) }
      : { planId: p.planId, allowOwner: true, allowHall: false, allowKitchen: false }]),
  ))
  const [saving, setSaving] = useState(false)

  const flip = (planId, roleKey) => setAccess((prev) => ({
    ...prev,
    [planId]: { ...prev[planId], [roleKey]: !prev[planId][roleKey] },
  }))

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.url.trim()) { onError('메뉴명과 URL 은 필수입니다.'); return }
    setSaving(true)
    try {
      const body = { ...form, plans: plans.map((p) => access[p.planId]) }
      if (mode === 'create') await tenantMenuPolicyApi.add(body)
      else await tenantMenuPolicyApi.update(item.id, body)
      await onSaved()
    } catch (err) { onError(err.message); setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{mode === 'create' ? '메뉴 추가' : `${item.name} 수정`}</h3>
        <form onSubmit={submit}>
          <label className="field"><span>메뉴명</span>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={40} autoFocus />
          </label>
          <label className="field"><span>URL</span>
            <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="/admin/orders 또는 https://…" maxLength={200} />
          </label>
          <label className="field"><span>아이콘 (선택, Material Symbols 이름)</span>
            <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="receipt_long" maxLength={40} />
          </label>

          <div className="field">
            <span>요금제별 노출</span>
            <table className="table tmp-mini">
              <thead>
                <tr>
                  <th>요금제</th>
                  {ROLES.map((r) => <th key={r.key}>{r.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.planId}>
                    <td className="strong">{p.name}</td>
                    {ROLES.map((r) => (
                      <td key={r.key}>
                        <input
                          type="checkbox"
                          checked={!!access[p.planId]?.[r.key]}
                          onChange={() => flip(p.planId, r.key)}
                          aria-label={`${p.name} · ${r.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
