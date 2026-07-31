import { useEffect, useRef, useState } from 'react'
import Toast from '../components/Toast'
import { useNavigate } from 'react-router-dom'
import { adminApi, adApi, fileApi, tenantApi } from '../api/client'
import Shell from '../components/Shell'

// 로그인 후 첫 화면. 전체 현황을 숫자로 보여주고, 카드를 누르면 해당 목록으로 간다.
// 전용 대시보드 API 는 아직 없다 — 목록 API 의 totalElements 만 쓴다 (size=1 로 본문은 안 받는다).
export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([
      adminApi.list({ size: 1 }),
      tenantApi.list({ size: 1 }),
      tenantApi.list({ status: 'ACTIVE', size: 1 }),
      tenantApi.list({ status: 'PENDING', size: 1 }),
    ])
      .then(([admins, tenants, active, pending]) => {
        if (!alive) return
        setStats({
          admins: admins.totalElements,
          tenants: tenants.totalElements,
          active: active.totalElements,
          pending: pending.totalElements,
        })
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [])

  const cards = [
    { label: '재직 관리자', value: stats?.admins, to: '/admins' },
    { label: '전체 업체', value: stats?.tenants, to: '/tenants' },
    { label: '운영중 업체', value: stats?.active, to: '/tenants' },
    { label: '개설 대기 업체', value: stats?.pending, to: '/tenants' },
  ]

  return (
    <Shell>
      <div className="page-head">
        <h2>대시보드</h2>
      </div>

      <Toast message={error} onClose={() => setError('')} />

      <div className="stat-grid">
        {cards.map((card) => (
          <button key={card.label} type="button" className="stat-card" onClick={() => navigate(card.to)}>
            <span className="stat-label">{card.label}</span>
            <span className="stat-value">{card.value ?? '—'}</span>
          </button>
        ))}
      </div>

      <AdManager onError={setError} />
    </Shell>
  )
}

// 플랫폼(본사) 광고 배너 — 전 매장 손님 화면 하단에 공통 노출. 본사만 관리.
function AdManager({ onError }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [flash, setFlash] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    adApi.get()
      .then((a) => setForm({ imageUrl: a.imageUrl || '', link: a.link || '', text: a.text || '', enabled: a.enabled !== false }))
      .catch((e) => { onError(e.message); setForm({ imageUrl: '', link: '', text: '', enabled: true }) })
  }, [onError])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function pick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { const { url } = await fileApi.uploadImage(file); setForm((f) => ({ ...f, imageUrl: url })) }
    catch (err) { onError(err.message) } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function save() {
    setSaving(true)
    try {
      const a = await adApi.save(form)
      setForm({ imageUrl: a.imageUrl || '', link: a.link || '', text: a.text || '', enabled: a.enabled !== false })
      setFlash(true); setTimeout(() => setFlash(false), 2000)
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  if (!form) return null

  return (
    <section className="ad-manager">
      <div className="ad-manager-head">
        <div>
          <h3>손님 화면 광고 배너</h3>
          <p className="muted">전 매장 손님 페이지 하단에 공통으로 노출됩니다. (본사 전용)</p>
        </div>
        <div className="ad-manager-actions">
          {flash && <span className="save-flash">저장되었습니다 ✓</span>}
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>

      <div className="ad-manager-body">
        <div className="ad-pick">
          {form.imageUrl
            ? <img className="ad-thumb" src={form.imageUrl} alt="" />
            : <div className="ad-thumb ph">이미지 없음</div>}
          <div className="ad-pick-btns">
            <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? '올리는 중…' : '이미지 업로드'}
            </button>
            {form.imageUrl && <button type="button" className="btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}>제거</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        </div>
        <div className="ad-fields">
          <label className="field">
            <span>광고 문구 (선택)</span>
            <input value={form.text} onChange={set('text')} maxLength={200} placeholder="예: 배달앱 첫 주문 3천원 할인" />
          </label>
          <label className="field">
            <span>클릭 시 이동 링크 (선택)</span>
            <input value={form.link} onChange={set('link')} maxLength={500} placeholder="https://..." />
          </label>
          <label className="check">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
            손님 화면에 노출
          </label>
        </div>
      </div>
    </section>
  )
}
