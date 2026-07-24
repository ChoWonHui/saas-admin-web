import { useCallback, useEffect, useRef, useState } from 'react'
import { fileApi, tenantMenuApi } from '../api/client'
import Loading from './Loading'

function won(n) {
  return `${(n ?? 0).toLocaleString()}원`
}

// 유튜브 URL 에서 영상 ID 를 뽑는다(watch?v= / youtu.be / embed / shorts 지원).
function youtubeId(url) {
  if (!url) return null
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/)
  return m ? m[1] : null
}
function youtubeThumb(url) {
  const id = youtubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null
}

/**
 * 지점 메뉴판 편집기 — 좌: 분류 / 우: 메뉴. 상단에 다른 지점 복사.
 * API 는 props 로 주입한다(기본값은 관리자용). 업체 콘솔은 tenant 어댑터를 넘겨 같은 UI 를 쓴다.
 */
export default function MenuEditor({
  tenantId, branch, branches, onClose, onError,
  menuApi = tenantMenuApi, imageApi = fileApi,
  embedded = false, title = '메뉴판', subtitle,
}) {
  const [menu, setMenu] = useState(null) // { categories }
  const [selCat, setSelCat] = useState(null)
  const [itemDialog, setItemDialog] = useState(null) // { item? , categoryId }
  const [copyOpen, setCopyOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // { kind:'cat'|'item', id, name }
  const [catDialog, setCatDialog] = useState(null) // { mode:'add'|'rename', category? }

  const bid = branch.branchId
  const load = useCallback(async () => {
    try { setMenu(await menuApi.get(tenantId, bid)) }
    catch (e) { onError(e.message); setMenu({ categories: [] }) }
  }, [tenantId, bid, onError])
  useEffect(() => { load() }, [load])

  // 선택 분류 유지(없으면 첫 분류)
  const categories = menu?.categories ?? []
  const current = categories.find((c) => c.id === selCat) ?? categories[0]
  useEffect(() => {
    if (categories.length && !categories.some((c) => c.id === selCat)) setSelCat(categories[0].id)
  }, [categories, selCat])

  // 분류 추가/이름수정은 디자인된 입력 모달(CategoryDialog)로 받는다.
  async function submitCategory(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      if (catDialog.mode === 'rename') {
        if (trimmed !== catDialog.category.name) {
          setMenu(await menuApi.renameCategory(tenantId, bid, catDialog.category.id, trimmed))
        }
      } else {
        setMenu(await menuApi.addCategory(tenantId, bid, trimmed))
      }
      setCatDialog(null)
    } catch (e) { onError(e.message) }
  }
  async function runConfirm() {
    try {
      if (confirm.kind === 'cat') setMenu(await menuApi.deleteCategory(tenantId, bid, confirm.id))
      else setMenu(await menuApi.deleteItem(tenantId, bid, confirm.id))
      setConfirm(null)
    } catch (e) { onError(e.message); setConfirm(null) }
  }

  const otherBranches = (branches ?? []).filter((b) => b.branchId !== bid)
  const headSub = subtitle ?? `${branch.branchNo}호점${branch.name ? ` (${branch.name})` : ''}`

  const content = (
    <>
        {(!embedded || title) && (
          <div className="branch-head">
            <h3>{title}</h3>
            <span className="branch-sub">{headSub}</span>
            {otherBranches.length > 0 && (
              <button type="button" className="btn-ghost btn-sm menu-copy-btn" onClick={() => setCopyOpen(true)}>
                다른 지점에서 복사
              </button>
            )}
          </div>
        )}

        {menu === null ? (
          <Loading label="메뉴판을 불러오는 중…" />
        ) : (
          <div className="menu-body">
            {/* 좌: 분류 */}
            <div className="menu-cats">
              <div className="menu-cats-head">
                <span>분류</span>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setCatDialog({ mode: 'add' })}>＋</button>
              </div>
              {categories.length === 0 ? (
                <p className="menu-cats-empty">분류를 먼저 추가하세요</p>
              ) : (
                <ul className="menu-cat-list">
                  {categories.map((c) => (
                    <li
                      key={c.id}
                      className={`menu-cat${current?.id === c.id ? ' on' : ''}`}
                      onClick={() => setSelCat(c.id)}
                    >
                      <span className="menu-cat-name">{c.name}</span>
                      <span className="menu-cat-count">{c.items.length}</span>
                      <button type="button" className="menu-cat-x" title="이름 수정"
                        onClick={(e) => { e.stopPropagation(); setCatDialog({ mode: 'rename', category: c }) }}>✎</button>
                      <button type="button" className="menu-cat-x danger" title="삭제"
                        onClick={(e) => { e.stopPropagation(); setConfirm({ kind: 'cat', id: c.id, name: c.name }) }}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 우: 메뉴 */}
            <div className="menu-items">
              {!current ? (
                <p className="menu-items-empty">왼쪽에서 분류를 선택하거나 추가하세요.</p>
              ) : (
                <>
                  <div className="menu-items-head">
                    <h4>{current.name}</h4>
                    <button type="button" className="btn-primary btn-sm" onClick={() => setItemDialog({ categoryId: current.id })}>＋ 메뉴 추가</button>
                  </div>
                  {current.items.length === 0 ? (
                    <p className="menu-items-empty">이 분류에 메뉴가 없습니다. “＋ 메뉴 추가”로 등록하세요.</p>
                  ) : (
                    <ul className="menu-item-list">
                      {current.items.map((it) => (
                        <li key={it.id} className={`menu-item-card${it.soldOut ? ' sold' : ''}`}>
                          {it.imageUrl
                            ? <img className="menu-item-img" src={it.imageUrl} alt="" />
                            : <div className="menu-item-img ph">🍽</div>}
                          <div className="menu-item-info">
                            <div className="menu-item-top">
                              <span className="menu-item-name">{it.name}</span>
                              {it.soldOut && <span className="badge">품절</span>}
                              {it.youtubeUrl && <span className="badge yt-badge">▶ 영상</span>}
                            </div>
                            <span className="menu-item-price">{won(it.price)}</span>
                            {it.description && <span className="menu-item-desc">{it.description}</span>}
                            {it.optionGroups.length > 0 && (
                              <span className="menu-item-opts">
                                옵션: {it.optionGroups.map((g) => g.name).join(', ')}
                              </span>
                            )}
                          </div>
                          <div className="menu-item-actions">
                            <button type="button" className="btn-ghost btn-sm" onClick={() => setItemDialog({ item: it, categoryId: current.id })}>수정</button>
                            <button type="button" className="btn-danger btn-sm" onClick={() => setConfirm({ kind: 'item', id: it.id, name: it.name })}>삭제</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {!embedded && (
          <div className="dialog-actions">
            <button className="btn-ghost" onClick={onClose}>닫기</button>
          </div>
        )}

        {itemDialog && (
          <MenuItemDialog
            tenantId={tenantId} branchId={bid}
            menuApi={menuApi} imageApi={imageApi}
            categoryId={itemDialog.categoryId}
            categories={categories}
            item={itemDialog.item}
            onClose={() => setItemDialog(null)}
            onSaved={(m) => { setMenu(m); setItemDialog(null) }}
            onError={onError}
          />
        )}

        {copyOpen && (
          <CopyMenuDialog
            tenantId={tenantId} branchId={bid} branches={otherBranches}
            menuApi={menuApi}
            onClose={() => setCopyOpen(false)}
            onCopied={(m) => { setMenu(m); setCopyOpen(false) }}
            onError={onError}
          />
        )}

        {catDialog && (
          <CategoryDialog
            mode={catDialog.mode}
            initial={catDialog.category?.name ?? ''}
            onClose={() => setCatDialog(null)}
            onSubmit={submitCategory}
          />
        )}

        {confirm && (
          <div className="modal-backdrop" onClick={() => setConfirm(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>{confirm.kind === 'cat' ? '분류 삭제' : '메뉴 삭제'}</h3>
              <p className="confirm-text">
                <strong>{confirm.name}</strong>
                {confirm.kind === 'cat' ? ' 분류와 그 안의 메뉴·옵션을 모두 삭제합니다.' : ' 메뉴를 삭제합니다.'}
              </p>
              <div className="dialog-actions">
                <button className="btn-ghost" onClick={() => setConfirm(null)}>취소</button>
                <button className="btn-primary btn-danger-solid" onClick={runConfirm}>삭제</button>
              </div>
            </div>
          </div>
        )}
    </>
  )

  if (embedded) return <div className="menu-embedded">{content}</div>
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal menu-modal" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  )
}

/** 메뉴 추가/수정 — 이름·가격·설명·사진·품절 + 옵션그룹. */
function MenuItemDialog({ tenantId, branchId, menuApi, imageApi, categoryId, categories, item, onClose, onSaved, onError }) {
  const editing = !!item
  const [form, setForm] = useState({
    name: item?.name ?? '',
    price: item?.price ?? 0,
    description: item?.description ?? '',
    imageUrl: item?.imageUrl ?? '',
    youtubeUrl: item?.youtubeUrl ?? '',
    soldOut: item?.soldOut ?? false,
    categoryId: item?.categoryId ?? categoryId,
    optionGroups: (item?.optionGroups ?? []).map((g) => ({
      name: g.name, required: g.required, multiple: g.multiple,
      options: g.options.map((o) => ({ name: o.name, extraPrice: o.extraPrice })),
    })),
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const fileRef = useRef(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function uploadFile(file) {
    if (!file || !file.type?.startsWith('image/')) return
    setUploading(true)
    try { const { url } = await imageApi.uploadImage(file); set('imageUrl', url) }
    catch (err) { onError(err.message) } finally { setUploading(false) }
  }
  function pickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    uploadFile(file)
  }

  // 옵션그룹 조작
  const addGroup = () => set('optionGroups', [...form.optionGroups, { name: '', required: false, multiple: false, options: [{ name: '', extraPrice: 0 }] }])
  const setGroup = (gi, patch) => set('optionGroups', form.optionGroups.map((g, i) => (i === gi ? { ...g, ...patch } : g)))
  const removeGroup = (gi) => set('optionGroups', form.optionGroups.filter((_, i) => i !== gi))
  const addOption = (gi) => setGroup(gi, { options: [...form.optionGroups[gi].options, { name: '', extraPrice: 0 }] })
  const setOption = (gi, oi, patch) => setGroup(gi, { options: form.optionGroups[gi].options.map((o, i) => (i === oi ? { ...o, ...patch } : o)) })
  const removeOption = (gi, oi) => setGroup(gi, { options: form.optionGroups[gi].options.filter((_, i) => i !== oi) })

  async function save() {
    if (!form.name.trim()) { onError('메뉴명을 입력하세요.'); return }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        price: Number(form.price) || 0,
        description: form.description,
        imageUrl: form.imageUrl,
        youtubeUrl: form.youtubeUrl.trim(),
        soldOut: form.soldOut,
        categoryId: form.categoryId,
        optionGroups: form.optionGroups
          .filter((g) => g.name.trim())
          .map((g) => ({
            name: g.name.trim(), required: g.required, multiple: g.multiple,
            options: g.options.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), extraPrice: Number(o.extraPrice) || 0 })),
          })),
      }
      const m = editing
        ? await menuApi.updateItem(tenantId, branchId, item.id, body)
        : await menuApi.addItem(tenantId, branchId, categoryId, body)
      onSaved(m)
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal menu-item-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? '메뉴 수정' : '메뉴 추가'}</h3>

        <div className="mi-row">
          <div className="mi-image-col">
            <button
              type="button"
              className={`mi-image${dragOver ? ' drag' : ''}`}
              onClick={() => fileRef.current.click()}
              title="클릭하거나 사진을 끌어다 놓으세요"
              onDragOver={(e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) { e.preventDefault(); setDragOver(true) } }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFile(e.dataTransfer.files?.[0]) }}
            >
              {form.imageUrl
                ? <img src={form.imageUrl} alt="" />
                : <span>{uploading ? '업로드…' : dragOver ? '여기에 놓기' : '＋ 사진\n끌어다 놓기'}</span>}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
            <button type="button" className="mi-search-btn" onClick={() => setSearchOpen(true)}>🔍 사진 검색</button>
          </div>
          <div className="mi-fields">
            <label className="field">
              <span>메뉴명 <span className="req">*</span></span>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} autoFocus />
            </label>
            <div className="field-row">
              <label className="field">
                <span>가격(원)</span>
                <input type="number" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
              </label>
              <label className="field">
                <span>분류</span>
                <select value={form.categoryId} onChange={(e) => set('categoryId', Number(e.target.value))}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>

        <label className="field">
          <span>설명</span>
          <input value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} placeholder="예: 돼지고기 듬뿍" />
        </label>

        <label className="field">
          <span>유튜브 영상 <span className="muted">(선택)</span></span>
          <input value={form.youtubeUrl} onChange={(e) => set('youtubeUrl', e.target.value)} maxLength={300}
                 placeholder="https://youtu.be/... 또는 https://www.youtube.com/watch?v=..." />
          {form.youtubeUrl.trim() && (
            youtubeThumb(form.youtubeUrl)
              ? <div className="yt-preview"><img src={youtubeThumb(form.youtubeUrl)} alt="영상 미리보기" /><span className="yt-play">▶</span></div>
              : <span className="field-hint" style={{ color: 'var(--danger-text)' }}>유튜브 주소 형식이 아닙니다.</span>
          )}
        </label>

        <label className="check">
          <input type="checkbox" checked={form.soldOut} onChange={(e) => set('soldOut', e.target.checked)} />
          품절
        </label>

        {/* 옵션 그룹 → 각 그룹 안에 선택 항목을 하나씩 */}
        <div className="mi-opts">
          <div className="mi-opts-head">
            <span>옵션</span>
            <button type="button" className="btn-ghost btn-sm" onClick={addGroup}>＋ 옵션 그룹 추가</button>
          </div>
          <p className="mi-opts-guide">
            옵션 <b>그룹</b>을 만들고 그 안에 <b>선택 항목</b>을 하나씩 추가합니다.
            예) 그룹 <b>“소스”</b> → 항목 <b>매운맛 · 덜매운맛 · 순한맛</b>
          </p>
          {form.optionGroups.length === 0 && (
            <p className="mi-opts-empty">아직 옵션이 없습니다. “＋ 옵션 그룹 추가”로 시작하세요.</p>
          )}
          {form.optionGroups.map((g, gi) => (
            <div key={gi} className="mi-group">
              <div className="mi-group-head">
                <span className="mi-group-badge">그룹 {gi + 1}</span>
                <input className="mi-group-name" value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} placeholder="그룹명 (예: 소스, 맵기, 사이즈)" maxLength={50} />
                <label className="check sm" title="반드시 하나 이상 골라야 함"><input type="checkbox" checked={g.required} onChange={(e) => setGroup(gi, { required: e.target.checked })} />필수</label>
                <label className="check sm" title="여러 개 고를 수 있음(체크박스)"><input type="checkbox" checked={g.multiple} onChange={(e) => setGroup(gi, { multiple: e.target.checked })} />여러 개 선택</label>
                <button type="button" className="mi-x" onClick={() => removeGroup(gi)} title="그룹 삭제">✕</button>
              </div>
              <div className="mi-opt-list">
                <div className="mi-opt-listhead"><span>선택 항목</span><span className="mi-opt-pricehead">추가금액</span></div>
                {g.options.length === 0 && <p className="mi-opt-none">항목이 없습니다. 아래에서 추가하세요.</p>}
                {g.options.map((o, oi) => (
                  <div key={oi} className="mi-option">
                    <input className="mi-opt-name" value={o.name} onChange={(e) => setOption(gi, oi, { name: e.target.value })} placeholder={`항목명 (예: ${['매운맛', '덜매운맛', '순한맛'][oi] ?? '옵션'})`} maxLength={50} />
                    <input className="mi-opt-price" type="number" value={o.extraPrice} onChange={(e) => setOption(gi, oi, { extraPrice: e.target.value })} title="추가 금액" />
                    <span className="mi-opt-won">원</span>
                    <button type="button" className="mi-x" onClick={() => removeOption(gi, oi)} title="항목 삭제">✕</button>
                  </div>
                ))}
                <button type="button" className="mi-add-opt" onClick={() => addOption(gi)}>＋ 항목 추가</button>
              </div>
            </div>
          ))}
        </div>

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={save} disabled={saving || uploading}>{saving ? '저장 중…' : '저장'}</button>
        </div>

        {searchOpen && (
          <ImageSearchModal
            imageApi={imageApi}
            defaultQuery={form.name}
            onPick={(url) => { set('imageUrl', url); setSearchOpen(false) }}
            onClose={() => setSearchOpen(false)}
            onError={onError}
          />
        )}
      </div>
    </div>
  )
}

/** 이미지 검색(Pixabay) — 키워드로 검색 후 클릭하면 S3 에 저장해 삽입. */
function ImageSearchModal({ imageApi, defaultQuery, onPick, onClose, onError }) {
  const [q, setQ] = useState(defaultQuery ?? '')
  const [results, setResults] = useState(null) // null=검색전
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function search(e) {
    e?.preventDefault()
    if (!q.trim()) return
    setLoading(true)
    try { setResults(await imageApi.searchImages(q.trim())) }
    catch (err) { onError(err.message); setResults([]) } finally { setLoading(false) }
  }

  async function pick(url) {
    if (saving) return
    setSaving(true)
    try { const r = await imageApi.saveFromUrl(url); onPick(r.url) }
    catch (err) { onError(err.message) } finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal imgsearch-modal" onClick={(e) => e.stopPropagation()}>
        <h3>사진 검색</h3>
        <form className="imgsearch-bar" onSubmit={search}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 김치찌개, 파스타, 커피" autoFocus />
          <button type="submit" className="btn-primary btn-sm" disabled={loading || !q.trim()}>{loading ? '검색 중…' : '검색'}</button>
        </form>

        {saving && <p className="imgsearch-saving">사진을 저장하는 중…</p>}

        {results === null ? (
          <p className="imgsearch-hint">키워드를 입력해 사진을 검색하세요. 무료 이미지(Pixabay)입니다.</p>
        ) : results.length === 0 ? (
          <p className="imgsearch-hint">{loading ? '' : '검색 결과가 없습니다. 다른 키워드로 시도하세요.'}</p>
        ) : (
          <div className="imgsearch-grid">
            {results.map((r, i) => (
              <button key={i} type="button" className="imgsearch-cell" onClick={() => pick(r.url)} disabled={saving}>
                <img src={r.thumb} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}

/** 분류 추가/이름수정 입력 모달. */
function CategoryDialog({ mode, initial, onClose, onSubmit }) {
  const [name, setName] = useState(initial)
  const submit = (e) => { e.preventDefault(); if (name.trim()) onSubmit(name) }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal cat-dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>{mode === 'rename' ? '분류 이름 수정' : '분류 추가'}</h3>
        <label className="field">
          <span>분류명</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 메인, 사이드, 음료"
                 maxLength={50} autoFocus />
        </label>
        <div className="dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            {mode === 'rename' ? '수정' : '추가'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** 다른 지점 메뉴 복사 — 원본 지점 선택 후 대체. */
function CopyMenuDialog({ tenantId, branchId, branches, menuApi, onClose, onCopied, onError }) {
  const [from, setFrom] = useState(branches[0]?.branchId ?? '')
  const [busy, setBusy] = useState(false)
  async function run() {
    if (!from) return
    setBusy(true)
    try { onCopied(await menuApi.copy(tenantId, branchId, Number(from))) }
    catch (e) { onError(e.message); onClose() } finally { setBusy(false) }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>다른 지점 메뉴 복사</h3>
        <p className="confirm-text">선택한 지점의 메뉴판으로 <strong>이 지점의 기존 메뉴가 대체</strong>됩니다.</p>
        <label className="field">
          <span>원본 지점</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {branches.map((b) => <option key={b.branchId} value={b.branchId}>{b.branchNo}호점{b.name ? ` (${b.name})` : ''}</option>)}
          </select>
        </label>
        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={run} disabled={busy || !from}>{busy ? '복사 중…' : '복사'}</button>
        </div>
      </div>
    </div>
  )
}
