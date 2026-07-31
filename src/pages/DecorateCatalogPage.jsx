import { useCallback, useEffect, useRef, useState } from 'react'
import Toast from '../components/Toast'
import Shell from '../components/Shell'
import { decorateApi } from '../api/client'
import { TableGlyph, CounterGlyph } from '../components/IsoRoomEditor'
import Avatar, { hairMassD, FRINGE_D, BALD_D, hatPresetSvgUrl } from '../components/Avatar'

// 머리스타일 미리보기용 캐릭터.
const PREVIEW_CHAR = { skin: '#f0c49b', hairStyle: 'preview', hairColor: '#5a3a22', outfit: '#4a90d9', apron: true, hat: 'none' }
function safeParse(raw, fb = { type: 'mass', len: -34 }) {
  try { const d = JSON.parse(raw); if (d && d.type) return d } catch { /* noop */ }
  return fb
}
// 아이콘이 이미지 URL 인지(이모지가 아니라).
const isImgIcon = (s) => typeof s === 'string' && (s.startsWith('/') || s.startsWith('http') || s.startsWith('data:'))

// 코드 도형(테이블/카운터/가벽)을 그림판 캔버스에 불러올 수 있게 SVG data URL 로. 바닥은 아래(85%).
function toolShapeSvgUrl(shape) {
  const TW = 46, TH = 23
  let inner = ''
  if (shape === 'table') {
    inner = `<ellipse cx="0" cy="0" rx="${TW * 0.32}" ry="${TH * 0.34}" fill="rgba(0,0,0,0.18)"/>`
      + `<ellipse cx="0" cy="-1" rx="6.5" ry="2.4" fill="#9a7b53"/>`
      + `<rect x="-2.4" y="-19" width="4.8" height="19" rx="1.2" fill="#b58c5c"/>`
      + `<ellipse cx="0" cy="-19" rx="${TW * 0.36}" ry="${TH * 0.4}" fill="#c69a63"/>`
      + `<ellipse cx="0" cy="-20.8" rx="${TW * 0.36}" ry="${TH * 0.4}" fill="#dcbb86" stroke="#a9814f" stroke-width="0.8"/>`
  } else if (shape === 'counter') {
    inner = `<ellipse cx="0" cy="1" rx="20" ry="5" fill="rgba(0,0,0,0.18)"/>`
      + `<polygon points="-17,0 0,-6 0,-30 -17,-24" fill="#8f6238"/>`
      + `<polygon points="0,-6 17,0 17,-24 0,-30" fill="#b0824e"/>`
      + `<polygon points="0,-30 17,-24 0,-18 -17,-24" fill="#dcbb86" stroke="#7a4e2c" stroke-width="0.5"/>`
  } else if (shape === 'wall') {
    inner = `<ellipse cx="0" cy="1" rx="19" ry="5" fill="rgba(0,0,0,0.18)"/>`
      + `<polygon points="-16,-2 16,-2 16,-42 -16,-42" fill="#d8ccb6"/>`
      + `<polygon points="-16,-42 16,-42 20,-46 -12,-46" fill="#e8ddca" stroke="#b6a488" stroke-width="0.4"/>`
      + `<line x1="-16" y1="-22" x2="16" y2="-22" stroke="#c3b596" stroke-width="0.6"/>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="-30 -51 60 60">${inner}</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
// 길이 슬라이더 ↔ len(-46 짧음 … -18 긺)
const LEN_MIN = -46, LEN_MAX = -18
const lenToSlider = (len) => Math.round(((len - LEN_MIN) / (LEN_MAX - LEN_MIN)) * 100)
const sliderToLen = (v) => Math.round(LEN_MIN + (Number(v) / 100) * (LEN_MAX - LEN_MIN))

// 항목 미리보기 — 에디터와 동일하게: 색은 스와치, 테이블·카운터는 벡터, 머리스타일은 미니 캐릭터, 그 외는 이모지.
function ItemPreview({ it }) {
  if (it.renderKind === 'hairstyle') {
    return <span className="dc-hair-ic"><Avatar char={{ ...PREVIEW_CHAR, hairColor: '#3a2f2a' }} hairDesign={safeParse(it.renderData)} className="dc-avatar-sm" /></span>
  }
  if (it.renderKind === 'hat') {
    return <span className="dc-hair-ic"><Avatar char={{ ...PREVIEW_CHAR, hairColor: '#3a2f2a', hat: it.itemKey }} hatDesign={safeParse(it.renderData, { type: 'preset', preset: 'none' })} className="dc-avatar-sm" /></span>
  }
  if (it.renderKind === 'image' && it.renderData) return <span className="dc-emoji"><img src={it.renderData} alt="" className="dc-item-img" /></span>
  if (it.color) return <span className="dc-swatch" style={{ background: it.color }} />
  if (it.renderKind === 'table') return <span className="dc-emoji"><TableGlyph /></span>
  if (it.renderKind === 'counter') return <span className="dc-emoji"><CounterGlyph /></span>
  if (it.renderKind === 'wall') return <span className="dc-emoji">🚧</span>
  const fallback = it.renderKind === 'hat' ? '🧢' : '▦'
  return <span className="dc-emoji">{it.emoji || fallback}</span>
}

/**
 * 가게 꾸미기(store decorate) 카탈로그 관리.
 *  대분류(고정: 벽지·바닥·도구·벽배너·캐릭터) → 소분류(분류, CRUD) → 항목(선택지, CRUD).
 *  잠긴(locked) 분류/항목은 코드가 그린다 — 삭제·키 변경 불가, 라벨/노출만 바꾼다.
 */
const GROUPS = [
  { key: 'WALLPAPER', label: '벽지' },
  { key: 'FLOOR', label: '바닥' },
  { key: 'OBJECT', label: '도구' },
  { key: 'BANNER', label: '벽배너' },
  { key: 'CHARACTER', label: '사장님 캐릭터' },
]
const COLOR_CHAR = ['SKIN', 'HAIRCOLOR', 'OUTFIT']

// 항목 입력 형태: color(색) / object(도구 이모지) / hair(머리스타일 파라미터) / style(코드 스타일 — 신규 불가)
function itemType(cat) {
  if (cat.group === 'OBJECT') return 'object'
  if (cat.group === 'CHARACTER') {
    if (cat.categoryKey === 'HAIRSTYLE') return 'hair'
    if (cat.categoryKey === 'HAT') return 'hat'
    return COLOR_CHAR.includes(cat.categoryKey) ? 'color' : 'style'
  }
  return 'color'
}
// 항목 → 수정 요청 바디(누락 필드가 지워지지 않게 현재값을 모두 싣는다).
function itemBody(it, over = {}) {
  return {
    label: it.label, color: it.color || '', emoji: it.emoji || '', renderKind: it.renderKind || '',
    sz: it.sz ?? null, wallH: it.wallH ?? null, renderData: it.renderData || '', sortOrder: it.sortOrder, useYn: it.useYn, ...over,
  }
}

export default function DecorateCatalogPage() {
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null) // { mode, ... }

  const load = useCallback(async () => {
    try { setCats(await decorateApi.catalog()) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const byGroup = (g) => cats.filter((c) => c.group === g)
  const totalItems = cats.reduce((s, c) => s + c.items.length, 0)

  async function run(fn) {
    try { await fn(); await load() }
    catch (e) { setError(e.message) }
  }
  const toggleCat = (c) => run(() => decorateApi.updateCategory(c.id, { label: c.label, icon: c.icon || '', sortOrder: c.sortOrder, useYn: c.useYn === 'Y' ? 'N' : 'Y' }))
  const toggleItem = (it) => run(() => decorateApi.updateItem(it.id, itemBody(it, { useYn: it.useYn === 'Y' ? 'N' : 'Y' })))

  return (
    <Shell>
      <div className="page-head">
        <h2>가게꾸미기 카탈로그</h2>
        <span className="count">{cats.length}개 분류 · {totalItems}개 항목</span>
      </div>
      <p className="hint">store decorate(사장님 콘솔)의 벽지·바닥·도구·벽배너·캐릭터 선택지와 분류를 관리합니다. 모든 업체가 공유합니다. 🔒 항목은 코드로 그려서 삭제 불가 — 노출만 바꿉니다.</p>

      {loading ? <div className="boot">불러오는 중…</div> : GROUPS.map((g) => (
        <section className="dc-group" key={g.key}>
          <div className="dc-group-head">
            <h3>{g.label}</h3>
            {g.key !== 'CHARACTER' && (
              <button className="btn-ghost btn-sm" onClick={() => setDialog({ mode: 'createCat', group: g.key })}>＋ 분류 추가</button>
            )}
          </div>
          {byGroup(g.key).length === 0 && <p className="dc-empty">분류가 없습니다.</p>}
          {byGroup(g.key).map((c) => (
            <div className={`dc-cat${c.useYn === 'N' ? ' off' : ''}`} key={c.id}>
              <div className="dc-cat-head">
                <span className="dc-cat-title">
                  {c.group === 'OBJECT' && <span className="dc-cat-ic">{isImgIcon(c.icon) ? <img src={c.icon} alt="" /> : (c.icon || '▦')}</span>}
                  {c.label}
                  {c.locked && <span className="dc-lock" title="시스템 분류(삭제 불가)">🔒</span>}
                  <span className="dc-count">{c.items.length}</span>
                </span>
                <div className="dc-btns">
                  <button className="btn-ghost btn-xs" onClick={() => toggleCat(c)}>{c.useYn === 'Y' ? '노출중' : '중지'}</button>
                  <button className="btn-ghost btn-xs" onClick={() => setDialog({ mode: 'editCat', cat: c })}>수정</button>
                  {!c.locked && <button className="btn-ghost btn-xs danger" onClick={() => setDialog({ mode: 'delCat', cat: c })}>삭제</button>}
                  {itemType(c) !== 'style' && <button className="btn-primary btn-xs" onClick={() => setDialog({ mode: 'createItem', cat: c })}>＋ 항목</button>}
                </div>
              </div>
              <div className="dc-items">
                {c.items.length === 0 && <span className="dc-empty">항목이 없습니다.</span>}
                {c.items.map((it) => (
                  <div className={`dc-item${it.useYn === 'N' ? ' off' : ''}`} key={it.id}>
                    <ItemPreview it={it} />
                    <span className="dc-item-label">{it.label}{it.locked && <span className="dc-lock" title="코드로 그림(삭제 불가)">🔒</span>}</span>
                    <span className="dc-item-actions">
                      <button className="dc-x" title={it.useYn === 'Y' ? '노출중 — 누르면 중지' : '중지 — 누르면 노출'} onClick={() => toggleItem(it)}>{it.useYn === 'Y' ? '●' : '○'}</button>
                      <button className="dc-x" title="수정" onClick={() => setDialog({ mode: 'editItem', cat: c, item: it })}>✎</button>
                      {!it.locked && <button className="dc-x danger" title="삭제" onClick={() => setDialog({ mode: 'delItem', item: it })}>✕</button>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {dialog && <CatalogDialog dialog={dialog} onClose={() => setDialog(null)} onError={setError} onSaved={async () => { setDialog(null); await load() }} />}
      <Toast message={error} onClose={() => setError('')} />
    </Shell>
  )
}

// ── 생성/수정/삭제 모달 ──
function CatalogDialog({ dialog, onClose, onError, onSaved }) {
  const { mode } = dialog
  const cat = dialog.cat
  const item = dialog.item
  const type = cat ? itemType(cat) : null

  const initHair = type === 'hair' && item?.renderData ? safeParse(item.renderData) : { type: 'mass', len: -34 }
  const initHat = type === 'hat' && item?.renderData ? safeParse(item.renderData, { type: 'preset', preset: 'none' }) : { type: 'preset', preset: 'none' }
  const [catForm, setCatForm] = useState(() => ({ label: cat?.label || '', icon: cat?.icon || '', sortOrder: cat?.sortOrder ?? '' }))
  // 분류 아이콘을 도구(OBJECT)에서 편집. 대분류는 생성 시 dialog.group, 수정 시 cat.group.
  const catGroup = dialog.group || cat?.group
  const catHasIcon = catGroup === 'OBJECT'
  // 벡터(코드)로 그리는 도구 — 이모지가 표시에 쓰이지 않으므로 이름만 바꾼다.
  const SHAPES = ['table', 'counter', 'wall']
  // 도구 표현: 이모지 스프라이트면 'emoji', 그 외(이미지·코드도형)는 'vector'(그림)
  const initToolMode = type === 'object' ? (item?.renderKind === 'sprite' || !item ? 'emoji' : 'vector') : 'emoji'
  const initToolUrl = type === 'object' && item?.renderKind === 'image' ? (item.renderData || '') : ''
  const [itForm, setItForm] = useState(() => ({
    label: item?.label || '', color: item?.color || '#4a90d9', emoji: item?.emoji || '',
    sz: item?.sz ?? 24, hairType: initHair.type, hairLen: initHair.len ?? -34,
    hairUrl: initHair.url || (type === 'hat' ? (initHat.url || '') : '') || initToolUrl,
    hatKind: initHat.type === 'image' ? 'image' : (initHat.preset || 'none'),
    toolMode: initToolMode,
  }))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dirty, setDirty] = useState(false)   // 수정 화면에서 그림판/파일로 머리를 실제로 바꿨는지
  const fileRef = useRef(null)

  // 수정이면 콤보 없이 그림판으로 바로 편집. 결과는 이미지.
  const hairEdit = type === 'hair' && mode === 'editItem'
  const hatEdit = type === 'hat' && mode === 'editItem'

  // 미리보기용 머리 디자인
  const hairDesign = type !== 'hair' ? undefined : hairEdit
    ? (dirty ? { type: 'image', url: itForm.hairUrl } : initHair)
    : itForm.hairType === 'mass' ? { type: 'mass', len: Number(itForm.hairLen) }
      : itForm.hairType === 'image' ? { type: 'image', url: itForm.hairUrl }
        : { type: itForm.hairType }

  // 미리보기용 모자 디자인
  const hatDesign = type !== 'hat' ? undefined : hatEdit
    ? (dirty ? { type: 'image', url: itForm.hairUrl } : initHat)
    : itForm.hatKind === 'image' ? { type: 'image', url: itForm.hairUrl }
      : { type: 'preset', preset: itForm.hatKind }

  // 도구 벡터 편집 프리로드 — 현재 모양을 그림판에 불러온다(이미지=그대로, 코드도형=래스터).
  const toolPreload = (() => {
    if (type !== 'object' || !item) return {}
    if (item.renderKind === 'image') return { preloadImageUrl: item.renderData }
    if (SHAPES.includes(item.renderKind)) return { preloadImageUrl: toolShapeSvgUrl(item.renderKind) }
    return {}
  })()

  // 그림판 프리로드(현재 모양을 캔버스에 불러오기). 수정일 때만.
  const paintPreload = (() => {
    if (hairEdit) {
      if (initHair.type === 'image') return { preloadImageUrl: initHair.url }
      return {
        preloadDraw: (c) => {
          c.save(); c.setTransform(5, 0, 0, 5, 120, 450); c.fillStyle = '#5a3a22'
          if (initHair.type === 'mass') {
            c.fill(new Path2D(hairMassD(initHair.len)))
            c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(0, -60, 14.5, 0, Math.PI * 2); c.fill()
            c.globalCompositeOperation = 'source-over'
          }
          if (initHair.type !== 'bald') c.fill(new Path2D(FRINGE_D))
          if (initHair.type === 'bald') { c.globalAlpha = 0.85; c.fill(new Path2D(BALD_D)); c.globalAlpha = 1 }
          c.restore()
        },
      }
    }
    if (hatEdit) {
      if (initHat.type === 'image') return { preloadImageUrl: initHat.url }
      if (initHat.preset && initHat.preset !== 'none') return { preloadImageUrl: hatPresetSvgUrl(initHat.preset, '#4a90d9') }
    }
    return {}
  })()

  async function uploadHair(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { const { url } = await decorateApi.uploadImage(file); setItForm((f) => ({ ...f, hairUrl: url, hairType: 'image', hatKind: 'image' })); setDirty(true) }
    catch (err) { onError(err.message) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function uploadCatIcon(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { const { url } = await decorateApi.uploadImage(file); setCatForm((f) => ({ ...f, icon: url })) }
    catch (err) { onError(err.message) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  // 그림판 dataURL → PNG 업로드 → CDN url
  async function uploadDataUrl(dataUrl) {
    const blob = await (await fetch(dataUrl)).blob()
    const file = new File([blob], 'hair.png', { type: 'image/png' })
    const { url } = await decorateApi.uploadImage(file)
    return url
  }

  async function submit() {
    setBusy(true)
    try {
      // 머리/모자 renderData 계산(수정: 안 바꿨으면 원본 유지 / 그림판·파일은 이미지로 업로드).
      let hairData = null
      if (type === 'hair' && (mode === 'createItem' || mode === 'editItem')) {
        if (hairEdit && !dirty) {
          hairData = item.renderData || JSON.stringify(initHair)
        } else {
          let design = hairEdit ? { type: 'image', url: itForm.hairUrl }
            : itForm.hairType === 'mass' ? { type: 'mass', len: Number(itForm.hairLen) }
              : itForm.hairType === 'image' ? { type: 'image', url: itForm.hairUrl }
                : { type: itForm.hairType }
          if (design.type === 'image') {
            if (!design.url) { onError('머리를 그리거나 이미지를 올려주세요.'); setBusy(false); return }
            if (design.url.startsWith('data:')) design = { type: 'image', url: await uploadDataUrl(design.url) }
          }
          hairData = JSON.stringify(design)
        }
      }
      if (type === 'hat' && (mode === 'createItem' || mode === 'editItem')) {
        if (hatEdit && !dirty) {
          hairData = item.renderData || JSON.stringify(initHat)
        } else {
          let design = hatEdit ? { type: 'image', url: itForm.hairUrl }
            : itForm.hatKind === 'image' ? { type: 'image', url: itForm.hairUrl }
              : { type: 'preset', preset: itForm.hatKind }
          if (design.type === 'image') {
            if (!design.url) { onError('모자를 그리거나 이미지를 올려주세요.'); setBusy(false); return }
            if (design.url.startsWith('data:')) design = { type: 'image', url: await uploadDataUrl(design.url) }
          }
          hairData = JSON.stringify(design)
        }
      }
      // 도구 — 이모지 / 벡터(그림)
      if (type === 'object' && (mode === 'createItem' || mode === 'editItem')) {
        let body = { label: itForm.label }
        if (itForm.toolMode === 'vector') {
          if (mode === 'editItem' && !dirty) {
            // 안 그렸으면 원본(코드 도형 또는 기존 이미지) 유지 — 크기만 반영
            body = { ...body, renderKind: item.renderKind, renderData: item.renderData || '', emoji: item.emoji || '', color: item.color || '', wallH: item.wallH ?? null, sz: Number(itForm.sz) || item.sz }
          } else {
            let url = itForm.hairUrl
            if (!url) { onError('도구를 그리거나 이미지를 올려주세요.'); setBusy(false); return }
            if (url.startsWith('data:')) url = await uploadDataUrl(url)
            body = { ...body, renderKind: 'image', renderData: url, sz: Number(itForm.sz) || 30, emoji: '', color: '', wallH: null }
          }
        } else {
          body = { ...body, renderKind: 'sprite', emoji: itForm.emoji, sz: Number(itForm.sz) || 24, color: '', wallH: null, renderData: '' }
        }
        if (mode === 'createItem') await decorateApi.createItem(cat.id, body)
        else await decorateApi.updateItem(item.id, body)
        await onSaved(); return
      }
      if (mode === 'createCat') {
        const key = window.prompt('소분류 키(영문, 예: drinks) — 생성 후 변경 불가', '')
        if (key == null) { setBusy(false); return }
        await decorateApi.createCategory({ group: dialog.group, categoryKey: key.trim(), label: catForm.label, icon: catForm.icon, sortOrder: catForm.sortOrder === '' ? null : Number(catForm.sortOrder) })
      } else if (mode === 'editCat') {
        await decorateApi.updateCategory(cat.id, { label: catForm.label, icon: catForm.icon, sortOrder: catForm.sortOrder === '' ? null : Number(catForm.sortOrder), useYn: cat.useYn })
      } else if (mode === 'delCat') {
        await decorateApi.removeCategory(cat.id)
      } else if (mode === 'createItem') {
        const body = type === 'object'
          ? { label: itForm.label, emoji: itForm.emoji, renderKind: 'sprite', sz: Number(itForm.sz) || 24 }
          : type === 'hair'
            ? { label: itForm.label, renderKind: 'hairstyle', renderData: hairData }
            : type === 'hat'
              ? { label: itForm.label, renderKind: 'hat', renderData: hairData }
              : { label: itForm.label, color: itForm.color }
        await decorateApi.createItem(cat.id, body)
      } else if (mode === 'editItem') {
        const over = type === 'object'
          ? { label: itForm.label, emoji: itForm.emoji, sz: Number(itForm.sz) || item.sz }
          : type === 'hair' || type === 'hat'
            ? { label: itForm.label, renderData: hairData }
            : type === 'color'
              ? { label: itForm.label, color: itForm.color }
              : { label: itForm.label } // style — 라벨만
        await decorateApi.updateItem(item.id, itemBody(item, over))
      } else if (mode === 'delItem') {
        await decorateApi.removeItem(item.id)
      }
      await onSaved()
    } catch (e) { onError(e.message); setBusy(false) }
  }

  const title = {
    createCat: '소분류 추가', editCat: '소분류 수정', delCat: '소분류 삭제',
    createItem: '항목 추가', editItem: '항목 수정', delItem: '항목 삭제',
  }[mode]
  const isDelete = mode === 'delCat' || mode === 'delItem'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal${((type === 'hair' || type === 'hat' || (type === 'object' && itForm.toolMode === 'vector')) && !isDelete) ? ' dc-hair-modal' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>

        {isDelete ? (
          <p>정말 삭제할까요? {mode === 'delCat' && '이 분류의 항목도 함께 삭제됩니다.'}<br />
            <strong>{(cat || {}).label || (item || {}).label}</strong></p>
        ) : (mode === 'createCat' || mode === 'editCat') ? (
          <>
            <label className="field"><span>분류 이름</span>
              <input value={catForm.label} onChange={(e) => setCatForm((f) => ({ ...f, label: e.target.value }))} placeholder="예: 가구" autoFocus />
            </label>
            {catHasIcon && (
              <div className="field"><span>탭 아이콘</span>
                <div className="dc-caticon">
                  <span className="dc-caticon-prev">{isImgIcon(catForm.icon) ? <img src={catForm.icon} alt="" /> : (catForm.icon || '▦')}</span>
                  <input className="dc-caticon-emoji" value={isImgIcon(catForm.icon) ? '' : catForm.icon} maxLength={4}
                    onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))} placeholder="이모지 (예: 🪑)" />
                  <input ref={fileRef} type="file" accept="image/png,image/webp,image/gif,image/jpeg" hidden onChange={uploadCatIcon} />
                  <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? '업로드 중…' : '이미지'}
                  </button>
                  {catForm.icon && <button type="button" className="dc-x danger" title="비우기" onClick={() => setCatForm((f) => ({ ...f, icon: '' }))}>✕</button>}
                </div>
                <p className="hint" style={{ margin: '4px 0 0' }}>도구 팔레트 탭에 쓰입니다. 이모지 또는 이미지.</p>
              </div>
            )}
            <label className="field"><span>표시 순서(선택)</span>
              <input type="number" value={catForm.sortOrder} onChange={(e) => setCatForm((f) => ({ ...f, sortOrder: e.target.value }))} placeholder="비우면 맨 뒤" />
            </label>
          </>
        ) : (
          <>
            <label className="field"><span>이름</span>
              <input value={itForm.label} onChange={(e) => setItForm((f) => ({ ...f, label: e.target.value }))} placeholder={type === 'color' ? '예: 하늘' : '예: 냉장고'} autoFocus />
            </label>
            {type === 'color' && (
              <label className="field"><span>색</span>
                <span className="dc-colorpick">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(itForm.color) ? itForm.color : '#4a90d9'} onChange={(e) => setItForm((f) => ({ ...f, color: e.target.value }))} />
                  <input value={itForm.color} onChange={(e) => setItForm((f) => ({ ...f, color: e.target.value }))} placeholder="#4a90d9" />
                </span>
              </label>
            )}
            {type === 'object' && (
              <>
                <label className="field"><span>표현</span>
                  <select value={itForm.toolMode} onChange={(e) => setItForm((f) => ({ ...f, toolMode: e.target.value }))}>
                    <option value="emoji">이모지</option>
                    <option value="vector">벡터 (그림)</option>
                  </select>
                </label>
                {itForm.toolMode === 'emoji' && (
                  <label className="field"><span>이모지</span>
                    <input value={itForm.emoji} onChange={(e) => setItForm((f) => ({ ...f, emoji: e.target.value }))} placeholder="예: 🧊" maxLength={8} />
                  </label>
                )}
                {itForm.toolMode === 'vector' && (
                  <div className="field"><span>벡터 그리기</span>
                    <HairPaint guide="tile" w={220} h={220} {...toolPreload}
                      onChange={(dataUrl) => { setItForm((f) => ({ ...f, hairUrl: dataUrl })); setDirty(true) }} />
                    <div className="dc-hairup" style={{ marginTop: 6 }}>
                      <input ref={fileRef} type="file" accept="image/png,image/webp,image/gif,image/jpeg" hidden onChange={uploadHair} />
                      <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        {uploading ? '불러오는 중…' : '파일에서 불러오기'}
                      </button>
                      <span className="hint" style={{ margin: 0 }}>현재 모양이 보여요. 바닥 안내 위에서 수정하세요.</span>
                    </div>
                  </div>
                )}
                <label className="field"><span>크기</span>
                  <input type="number" value={itForm.sz} onChange={(e) => setItForm((f) => ({ ...f, sz: e.target.value }))} />
                </label>
              </>
            )}
            {type === 'hair' && (
              <div className="dc-hair-form">
                <div className="dc-hair-fields">
                  {/* 신규만 형태 선택. 수정은 현재 머리를 그림판에 불러와 바로 편집. */}
                  {!hairEdit && (
                    <>
                      <label className="field"><span>형태</span>
                        <select value={itForm.hairType} onChange={(e) => setItForm((f) => ({ ...f, hairType: e.target.value }))}>
                          <option value="fringe">짧은 머리</option>
                          <option value="mass">긴 머리 (길이 조절)</option>
                          <option value="bald">민머리</option>
                          <option value="image">직접 디자인 (그림판)</option>
                        </select>
                      </label>
                      {itForm.hairType === 'mass' && (
                        <label className="field"><span>길이</span>
                          <span className="dc-lenrow">
                            <span className="dc-lenlbl">짧게</span>
                            <input type="range" min="0" max="100" value={lenToSlider(itForm.hairLen)}
                              onChange={(e) => setItForm((f) => ({ ...f, hairLen: sliderToLen(e.target.value) }))} />
                            <span className="dc-lenlbl">길게</span>
                          </span>
                        </label>
                      )}
                    </>
                  )}
                  {(hairEdit || itForm.hairType === 'image') && (
                    <div className="field">
                      <span>{hairEdit ? '머리 수정 (그림판)' : '직접 그리기'}</span>
                      <HairPaint {...(hairEdit ? paintPreload : {})}
                        onChange={(dataUrl) => { setItForm((f) => ({ ...f, hairUrl: dataUrl })); setDirty(true) }} />
                      <div className="dc-hairup" style={{ marginTop: 6 }}>
                        <input ref={fileRef} type="file" accept="image/png,image/webp,image/gif,image/jpeg" hidden onChange={uploadHair} />
                        <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                          {uploading ? '불러오는 중…' : '파일에서 불러오기'}
                        </button>
                        <span className="hint" style={{ margin: 0 }}>얼굴 안내 주변에 머리를 그리세요.</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="dc-hair-preview">
                  <Avatar char={{ ...PREVIEW_CHAR, hairColor: '#5a3a22' }} hairDesign={hairDesign} className="dc-avatar-lg" />
                  <span className="dc-preview-cap">미리보기</span>
                </div>
              </div>
            )}
            {type === 'hat' && (
              <div className="dc-hair-form">
                <div className="dc-hair-fields">
                  {!hatEdit && (
                    <label className="field"><span>모자</span>
                      <select value={itForm.hatKind} onChange={(e) => setItForm((f) => ({ ...f, hatKind: e.target.value }))}>
                        <option value="none">없음</option>
                        <option value="chef">요리사</option>
                        <option value="cap">캡모자</option>
                        <option value="beanie">비니</option>
                        <option value="image">직접 디자인 (그림판)</option>
                      </select>
                    </label>
                  )}
                  {(hatEdit || itForm.hatKind === 'image') && (
                    <div className="field">
                      <span>{hatEdit ? '모자 수정 (그림판)' : '직접 그리기'}</span>
                      <HairPaint {...(hatEdit ? paintPreload : {})}
                        onChange={(dataUrl) => { setItForm((f) => ({ ...f, hairUrl: dataUrl })); setDirty(true) }} />
                      <div className="dc-hairup" style={{ marginTop: 6 }}>
                        <input ref={fileRef} type="file" accept="image/png,image/webp,image/gif,image/jpeg" hidden onChange={uploadHair} />
                        <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                          {uploading ? '불러오는 중…' : '파일에서 불러오기'}
                        </button>
                        <span className="hint" style={{ margin: 0 }}>머리 위(얼굴 안내 상단)에 모자를 그리세요.</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="dc-hair-preview">
                  <Avatar char={{ ...PREVIEW_CHAR, hairColor: '#5a3a22', hat: 'preview' }} hatDesign={hatDesign} className="dc-avatar-lg" />
                  <span className="dc-preview-cap">미리보기</span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className={isDelete ? 'btn-danger-solid' : 'btn-primary'} onClick={submit} disabled={busy}>
            {busy ? '처리 중…' : isDelete ? '삭제' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 그림판: 얼굴 안내(가이드) 위에 머리카락을 그린다. 결과는 투명 PNG dataURL. ──
// 좌표: 아바타 박스 x[-24,24] y[-90,-26](48×64)을 240×320 캔버스로. (ax+24)*5, (ay+90)*5.
function HairPaint({ preloadImageUrl, preloadDraw, onChange, guide = 'face', w = 240, h = 320 }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [tool, setTool] = useState('brush')
  const [color, setColor] = useState('#7a4a25')
  const [size, setSize] = useState(16)

  useEffect(() => {
    const cv = canvasRef.current
    cv.width = w; cv.height = h
    const c = cv.getContext('2d')
    c.lineCap = 'round'; c.lineJoin = 'round'
    // 현재 저장된 모양을 캔버스에 불러온다(수정 시작점). 사용자가 그리기 전엔 emit 하지 않는다.
    if (preloadImageUrl) {
      const img = new Image()
      if (!preloadImageUrl.startsWith('data:')) img.crossOrigin = 'anonymous'
      img.onload = () => { try { c.drawImage(img, 0, 0, w, h) } catch { /* taint */ } }
      img.src = preloadImageUrl
    } else if (preloadDraw) {
      preloadDraw(c)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const xy = (e) => { const r = canvasRef.current.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * w, (e.clientY - r.top) / r.height * h] }
  const ctx = () => canvasRef.current.getContext('2d')
  function setup(c) {
    c.lineWidth = size
    if (tool === 'eraser') { c.globalCompositeOperation = 'destination-out'; c.strokeStyle = c.fillStyle = 'rgba(0,0,0,1)' }
    else { c.globalCompositeOperation = 'source-over'; c.strokeStyle = c.fillStyle = color }
  }
  function down(e) {
    e.preventDefault(); drawing.current = true; last.current = xy(e)
    try { canvasRef.current.setPointerCapture(e.pointerId) } catch { /* noop */ }
    const c = ctx(); setup(c); c.beginPath(); c.arc(last.current[0], last.current[1], size / 2, 0, Math.PI * 2); c.fill()
  }
  function move(e) {
    if (!drawing.current) return
    const p = xy(e); const c = ctx(); setup(c)
    c.beginPath(); c.moveTo(last.current[0], last.current[1]); c.lineTo(p[0], p[1]); c.stroke(); last.current = p
  }
  function end() { if (!drawing.current) return; drawing.current = false; onChange(canvasRef.current.toDataURL('image/png')) }
  function clear() { ctx().clearRect(0, 0, w, h); onChange(canvasRef.current.toDataURL('image/png')) }

  return (
    <div className="hp">
      <div className="hp-toolbar">
        <button type="button" className={`hp-tool${tool === 'brush' ? ' on' : ''}`} onClick={() => setTool('brush')}>✏️ 붓</button>
        <button type="button" className={`hp-tool${tool === 'eraser' ? ' on' : ''}`} onClick={() => setTool('eraser')}>🧽 지우개</button>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="색" />
        <input type="range" min="2" max="46" value={size} onChange={(e) => setSize(Number(e.target.value))} title="굵기" className="hp-size" />
        <button type="button" className="hp-tool" onClick={clear}>전체 지우기</button>
      </div>
      <div className="hp-stage" style={{ width: w, height: h }}>
        {guide === 'face' && (
          <svg className="hp-guide" viewBox="0 0 240 320" aria-hidden="true">
            <line x1="0" y1="205" x2="240" y2="205" stroke="#c9ced8" strokeDasharray="5 5" />
            <circle cx="120" cy="150" r="72.5" fill="#f0c49b" opacity="0.35" />
            <circle cx="95" cy="150" r="7" fill="#3a2f2a" opacity="0.28" />
            <circle cx="145" cy="150" r="7" fill="#3a2f2a" opacity="0.28" />
            <path d="M107,174 q13,10 26,0" stroke="#b0654a" strokeWidth="4" fill="none" opacity="0.28" strokeLinecap="round" />
            <text x="200" y="200" textAnchor="middle" fontSize="10" fill="#9aa0ac">어깨</text>
          </svg>
        )}
        {guide === 'tile' && (
          <svg className="hp-guide" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
            <polygon points={`${w / 2},${h * 0.7} ${w * 0.82},${h * 0.82} ${w / 2},${h * 0.94} ${w * 0.18},${h * 0.82}`} fill="#cfd6df" opacity="0.5" />
            <text x={w / 2} y={h * 0.99} textAnchor="middle" fontSize="11" fill="#9aa0ac">바닥</text>
          </svg>
        )}
        <canvas ref={canvasRef} className="hp-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
      </div>
    </div>
  )
}
