import { useEffect, useRef, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import IsoRoomEditor from '../../components/IsoRoomEditor'
import { normalizeRoom, DEFAULT_ROOM } from '../../components/iso'
import { tenantHomeApi, tenantImageApi } from '../../api/tenantClient'

const EMPTY = { heroImageUrl: '', tagline: '', intro: '', hours: '', phone: '', address: '', notice: '', miniroom: DEFAULT_ROOM(), published: true }

// 사장님이 손님 QR 화면(가게 메인)을 편집하는 홈.
export default function TenantHomePage() {
  const [form, setForm] = useState(null)
  const [shopName, setShopName] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    tenantHomeApi.get()
      .then((h) => { setShopName(h.shopName || ''); setForm({ ...EMPTY, ...clean(h) }) })
      .catch((e) => { setError(e.message); setForm({ ...EMPTY }) })
  }, [])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function pickImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { const { url } = await tenantImageApi.uploadImage(file); setForm((f) => ({ ...f, heroImageUrl: url })) }
    catch (err) { setError(err.message) } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function save() {
    setSaving(true)
    try {
      const payload = { ...form, miniroom: JSON.stringify(form.miniroom || DEFAULT_ROOM()) }
      const saved = await tenantHomeApi.save(payload)
      setForm({ ...EMPTY, ...clean(saved) })
      setFlash(true); setTimeout(() => setFlash(false), 2000)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  if (form === null) {
    return <TenantShell><Loading label="가게 홈을 불러오는 중…" /></TenantShell>
  }

  return (
    <TenantShell>
      <div className="m-topline m-topline-sticky">
        <div className="m-page-head">
          <span className="m-eyebrow"><Icon name="storefront" /> STORE DESIGN</span>
          <h1>스토어 디자인</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {flash && <span className="save-flash">저장되었습니다 ✓</span>}
          <button className="m-btn m-btn-primary" onClick={save} disabled={saving}>
            <Icon name="save" /> {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {/* 가게 미니룸 — 손님 랜딩에 보이는 우리 가게 방 */}
      <div className="m-card" style={{ padding: 22, marginBottom: 20 }}>
        <div className="m-section-head" style={{ marginBottom: 14 }}>
          <span className="m-step"><Icon name="cottage" /></span>
          <div className="m-section-title">
            <h2>mini-room</h2>
            <p>손님이 가게 페이지에 들어오면 보게 될 우리 가게를 입체로 꾸며보세요. (벽지·바닥 선택 → 가구·가벽 배치)</p>
          </div>
        </div>
        <IsoRoomEditor value={form.miniroom} onChange={(mr) => setForm((f) => ({ ...f, miniroom: mr }))} />
      </div>

      <div className="home-edit">
        {/* 편집 폼 */}
        <div className="m-card home-form">
          <label className="check home-pub span2">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))} />
            손님 화면에 표시하기
          </label>

          <div className="field span2">
            <span>대표 이미지</span>
            <div className="home-hero-pick">
              {form.heroImageUrl
                ? <img className="home-hero-thumb" src={form.heroImageUrl} alt="" />
                : <div className="home-hero-thumb ph"><Icon name="image" /></div>}
              <div className="home-hero-btns">
                <button type="button" className="m-btn m-btn-tonal" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Icon name="upload" /> {uploading ? '올리는 중…' : '이미지 업로드'}
                </button>
                {form.heroImageUrl && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, heroImageUrl: '' }))}>제거</button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
            </div>
          </div>

          <label className="field span2">
            <span>한줄 소개 (가게명 아래 문구)</span>
            <input value={form.tagline} onChange={set('tagline')} maxLength={120} placeholder="예: 정성 가득 집밥 한상" />
          </label>
          <label className="field span2">
            <span>가게 소개</span>
            <textarea rows={2} value={form.intro} onChange={set('intro')} maxLength={1000} placeholder="가게를 소개하는 글을 적어보세요." />
          </label>
          <label className="field">
            <span>영업시간</span>
            <input value={form.hours} onChange={set('hours')} maxLength={200} placeholder="예: 매일 11:00 - 21:00" />
          </label>
          <label className="field">
            <span>전화</span>
            <input value={form.phone} onChange={set('phone')} maxLength={30} placeholder="02-000-0000" />
          </label>
          <label className="field">
            <span>주소</span>
            <input value={form.address} onChange={set('address')} maxLength={255} placeholder="가게 주소" />
          </label>
          <label className="field">
            <span>안내 · 공지 한마디</span>
            <input value={form.notice} onChange={set('notice')} maxLength={500} placeholder="예: 브레이크타임 15:00-17:00" />
          </label>
        </div>

        {/* 손님 화면 미리보기 */}
        <div className="home-preview">
          <span className="home-preview-cap"><Icon name="smartphone" /> 손님 화면 미리보기</span>
          <div className="home-phone">
            <div className="hp-hero" style={form.heroImageUrl ? { backgroundImage: `url(${form.heroImageUrl})` } : undefined}>
              <div className="hp-hero-veil" />
              <div className="hp-hero-text">
                <div className="hp-shop">{shopName || '우리 가게'}</div>
                {form.tagline && <div className="hp-tagline">{form.tagline}</div>}
              </div>
            </div>
            {(form.intro || form.hours || form.phone || form.address || form.notice) ? (
              <div className="hp-info">
                {form.notice && <div className="hp-notice"><Icon name="campaign" />{form.notice}</div>}
                {form.intro && <p className="hp-intro">{form.intro}</p>}
                {form.hours && <div className="hp-row"><Icon name="schedule" /><span>{form.hours}</span></div>}
                {form.phone && <div className="hp-row"><Icon name="call" /><span>{form.phone}</span></div>}
                {form.address && <div className="hp-row"><Icon name="location_on" /><span>{form.address}</span></div>}
              </div>
            ) : (
              <div className="hp-info hp-empty">소개·영업시간을 입력하면 여기에 보여요.</div>
            )}
            <div className="hp-menu-hint"><Icon name="restaurant_menu" /> 아래에 메뉴판이 이어집니다</div>
          </div>
        </div>
      </div>

      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}

// HomeView 응답에서 폼에 쓸 필드만 뽑고 null 을 '' 로.
function clean(h) {
  return {
    heroImageUrl: h.heroImageUrl || '',
    tagline: h.tagline || '',
    intro: h.intro || '',
    hours: h.hours || '',
    phone: h.phone || '',
    address: h.address || '',
    notice: h.notice || '',
    miniroom: normalizeRoom(h.miniroom),
    published: h.published !== false,
  }
}
