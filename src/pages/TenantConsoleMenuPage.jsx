import { useCallback, useEffect, useState } from 'react'
import Shell from '../components/Shell'
import Toast from '../components/Toast'
import { tenantMenuPolicyApi } from '../api/client'

const EMPTY_FORM = { name: '', url: '', icon: '', allowHall: true, allowKitchen: true }

/**
 * 사장님 콘솔 메뉴 정책(전역) — 우리 서비스를 쓰는 모든 업체가 동일하게 적용받는다.
 * 메뉴를 추가·수정·삭제하고 역할(대표/홀/주방)별 노출을 정한다. 대표는 항상 전 메뉴를 본다.
 */
export default function TenantConsoleMenuPage() {
  const [menus, setMenus] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // { mode:'create'|'edit', item? }

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
  const toggle = (m, key) => run(() => tenantMenuPolicyApi.update(m.id, {
    name: m.name, url: m.url, icon: m.icon || '',
    allowHall: key === 'allowHall' ? !m.allowHall : m.allowHall,
    allowKitchen: key === 'allowKitchen' ? !m.allowKitchen : m.allowKitchen,
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
        모든 업체의 <b>사장님 콘솔</b>에 동일하게 적용되는 메뉴 정책입니다. <b>대표</b>는 항상 모든 메뉴를 보고,
        홀·주방은 체크된 메뉴만 봅니다.
      </p>

      <Toast message={error} onClose={() => setError('')} />

      {menus === null ? (
        <p className="muted">불러오는 중…</p>
      ) : (
        <div className="table-wrap">
          <table className="table tmp-table">
            <thead>
              <tr>
                <th>메뉴</th>
                <th className="col-grow">URL</th>
                <th style={{ textAlign: 'center' }}>대표</th>
                <th style={{ textAlign: 'center' }}>홀</th>
                <th style={{ textAlign: 'center' }}>주방</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.id}>
                  <td className="strong">{m.name}</td>
                  <td className="mono muted-cell">{m.url}</td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked readOnly disabled title="대표는 항상 노출" /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={m.allowHall} disabled={busy} onChange={() => toggle(m, 'allowHall')} /></td>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" checked={m.allowKitchen} disabled={busy} onChange={() => toggle(m, 'allowKitchen')} /></td>
                  <td className="tmp-actions">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing({ mode: 'edit', item: m })}>수정</button>
                    <button className="btn-ghost btn-sm danger" onClick={() => del(m)} disabled={busy}>삭제</button>
                  </td>
                </tr>
              ))}
              {menus.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 16 }}>메뉴가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <MenuEditDialog
          dialog={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load() }}
          onError={setError}
        />
      )}
    </Shell>
  )
}

function MenuEditDialog({ dialog, onClose, onSaved, onError }) {
  const { mode, item } = dialog
  const [form, setForm] = useState(item ? {
    name: item.name, url: item.url, icon: item.icon || '', allowHall: item.allowHall, allowKitchen: item.allowKitchen,
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.url.trim()) { onError('메뉴명과 URL 은 필수입니다.'); return }
    setSaving(true)
    try {
      const body = { name: form.name, url: form.url, icon: form.icon, allowHall: form.allowHall, allowKitchen: form.allowKitchen }
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
            <span>노출 역할</span>
            <div style={{ display: 'flex', gap: 16, paddingTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked disabled /> 대표(항상)</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={form.allowHall} onChange={(e) => setForm((f) => ({ ...f, allowHall: e.target.checked }))} /> 홀</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={form.allowKitchen} onChange={(e) => setForm((f) => ({ ...f, allowKitchen: e.target.checked }))} /> 주방</label>
            </div>
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
