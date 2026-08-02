import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import { MenuItemDialog, CategoryDialog, ImageSearchModal } from '../../components/MenuEditor'
import { tenantMenuBoardApi as api, tenantImageApi } from '../../api/tenantClient'

const won = (n) => `₩${(n ?? 0).toLocaleString()}`
const ytId = (u) => (u ? String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/)?.[1] : null)

// 사장님 콘솔 메뉴판 — 모바일 전용(칩 카테고리 · 카드 리스트 · FAB · 바텀시트).
export default function MobileMenuView({ onError }) {
  const [menu, setMenu] = useState(null)
  const [selCat, setSelCat] = useState(null)
  const [q, setQ] = useState('')
  const [sheetId, setSheetId] = useState(null)      // 바텀시트를 연 메뉴 id
  const [itemDialog, setItemDialog] = useState(null) // { item?, categoryId }
  const [catDialog, setCatDialog] = useState(null)   // { mode, category? }
  const [catManage, setCatManage] = useState(false)
  const [addOpen, setAddOpen] = useState(false) // 콤보박스 옆 ＋ 팝업
  const [confirm, setConfirm] = useState(null)       // { kind, id, name }
  const [imgFor, setImgFor] = useState(null)         // 사진 변경 대상 item
  const [preview, setPreview] = useState(null)       // 이미지 미리보기 url

  const load = useCallback(async () => {
    try { setMenu(await api.get()) } catch (e) { onError(e.message); setMenu({ categories: [] }) }
  }, [onError])
  useEffect(() => { load() }, [load])

  const categories = menu?.categories ?? []
  const current = categories.find((c) => c.id === selCat) ?? categories[0]
  useEffect(() => {
    if (categories.length && !categories.some((c) => c.id === selCat)) setSelCat(categories[0].id)
  }, [categories, selCat])

  const allItems = useMemo(() => categories.flatMap((c) => c.items), [categories])
  const query = q.trim()
  const list = query ? allItems.filter((i) => (i.name || '').includes(query)) : (current?.items ?? [])
  const sheetItem = sheetId != null ? allItems.find((i) => i.id === sheetId) : null

  // ── 액션 ───────────────────────────────────────────────
  async function submitCategory(name) {
    const t = name.trim(); if (!t) return
    try {
      if (catDialog.mode === 'rename') { if (t !== catDialog.category.name) setMenu(await api.renameCategory(0, 0, catDialog.category.id, t)) }
      else setMenu(await api.addCategory(0, 0, t))
      setCatDialog(null)
    } catch (e) { onError(e.message) }
  }
  async function runConfirm() {
    try {
      if (confirm.kind === 'cat') setMenu(await api.deleteCategory(0, 0, confirm.id))
      else { setMenu(await api.deleteItem(0, 0, confirm.id)); setSheetId(null) }
      setConfirm(null)
    } catch (e) { onError(e.message); setConfirm(null) }
  }
  function fullBody(item, patch) {
    return {
      name: item.name, price: item.price, description: item.description || '',
      imageUrl: item.imageUrl || '', youtubeUrl: item.youtubeUrl || '',
      soldOut: item.soldOut, categoryId: item.categoryId,
      optionGroups: (item.optionGroups || []).map((g) => ({
        name: g.name, required: g.required, multiple: g.multiple,
        options: g.options.map((o) => ({ name: o.name, extraPrice: o.extraPrice })),
      })),
      ...patch,
    }
  }
  async function toggleSoldOut(item) {
    try { setMenu(await api.updateItem(0, 0, item.id, fullBody(item, { soldOut: !item.soldOut }))) }
    catch (e) { onError(e.message) }
  }
  async function changeImage(item, imageUrl) {
    try { setMenu(await api.updateItem(0, 0, item.id, fullBody(item, { imageUrl }))); setImgFor(null) }
    catch (e) { onError(e.message) }
  }

  const optCount = (it) => (it.optionGroups || []).reduce((s, g) => s + (g.options?.length || 0), 0)

  // 추가 액션(콤보박스 옆 ＋ 팝업)
  const addMenu = () => { setAddOpen(false); if (current) setItemDialog({ categoryId: current.id }); else setCatDialog({ mode: 'add' }) }
  const addCategory = () => { setAddOpen(false); setCatDialog({ mode: 'add' }) }

  return (
    <div className="mm">
      {/* 헤더 */}
      <div className="mm-head">
        <div className="mm-head-txt">
          <span className="m-eyebrow"><Icon name="restaurant_menu" /> MENU MANAGEMENT</span>
          <h1>메뉴판</h1>
          <p>메뉴, 가격, 사진, 옵션을 관리하세요.</p>
        </div>
        <div className="mm-head-actions">
          <button type="button" className="mm-icon" onClick={() => setCatManage(true)} aria-label="더보기"><Icon name="more_vert" /></button>
        </div>
      </div>

      {menu === null ? (
        <Loading label="메뉴판을 불러오는 중…" />
      ) : (
        <>
          {/* 검색 */}
          <div className="mm-search">
            <Icon name="search" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="메뉴 검색" />
            {q && <button type="button" className="mm-search-x" onClick={() => setQ('')} aria-label="지우기">✕</button>}
          </div>

          {/* 카테고리 선택 — 콤보박스 */}
          {!query && categories.length > 0 && (
            <div className="mm-catbar">
              <select className="mm-catselect" value={current?.id ?? ''} onChange={(e) => setSelCat(Number(e.target.value))} aria-label="카테고리 선택">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.items.length})</option>
                ))}
              </select>
              <div className="mm-catadd-wrap">
                <button type="button" className={`mm-catbar-add${addOpen ? ' on' : ''}`} onClick={() => setAddOpen((v) => !v)} aria-label="추가"><Icon name="add" /></button>
                {addOpen && (
                  <>
                    <div className="mm-add-bd" onClick={() => setAddOpen(false)} />
                    <div className="mm-add-menu">
                      <button type="button" onClick={addMenu}><Icon name="restaurant" /> 메뉴 추가</button>
                      <button type="button" onClick={addCategory}><Icon name="category" /> 카테고리 추가</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 카드 리스트 */}
          {categories.length === 0 ? (
            <div className="mm-empty"><Icon name="restaurant_menu" /><p>아직 카테고리가 없습니다.</p><p>오른쪽 아래 <b>＋</b> 로 카테고리를 먼저 추가하세요.</p></div>
          ) : list.length === 0 ? (
            <div className="mm-empty"><Icon name="restaurant_menu" /><p>{query ? `‘${query}’에 해당하는 메뉴가 없습니다.` : '이 카테고리에 메뉴가 없습니다.'}</p></div>
          ) : (
            <div className="mm-cards">
              {list.map((it) => (
                <button key={it.id} type="button" className={`mm-card${it.soldOut ? ' sold' : ''}`} onClick={() => setSheetId(it.id)}>
                  <div className="mm-card-img">
                    {it.imageUrl ? <img src={it.imageUrl} alt="" /> : <span className="mm-card-ph"><Icon name="restaurant" /></span>}
                  </div>
                  <div className="mm-card-body">
                    <span className="mm-card-name">{it.name}</span>
                    <span className="mm-card-price">{won(it.price)}</span>
                    <div className="mm-card-meta">
                      {optCount(it) > 0 && <span className="mm-card-opt">옵션 {optCount(it)}개</span>}
                      {it.soldOut && <span className="mm-badge sold">품절</span>}
                      {ytId(it.youtubeUrl) && <span className="mm-badge yt">▶ 영상</span>}
                    </div>
                  </div>
                  <Icon name="chevron_right" className="mm-card-chev" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* 메뉴 상세 바텀시트 */}
      {sheetItem && (
        <div className="mm-sheet-bd" onMouseDown={() => setSheetId(null)}>
          <div className="mm-sheet" onMouseDown={(e) => e.stopPropagation()}>
            <span className="tsheet-grip" />
            <div className="mm-sheet-head">
              <button type="button" className="mm-sheet-thumb" onClick={() => sheetItem.imageUrl && setPreview(sheetItem.imageUrl)}>
                {sheetItem.imageUrl ? <img src={sheetItem.imageUrl} alt="" /> : <span className="mm-card-ph"><Icon name="restaurant" /></span>}
              </button>
              <div className="mm-sheet-titles">
                <h3>{sheetItem.name}</h3>
                <span className="mm-sheet-price">{won(sheetItem.price)}</span>
                <div className="mm-sheet-badges">
                  {sheetItem.soldOut && <span className="mm-badge sold">품절</span>}
                  {ytId(sheetItem.youtubeUrl) && <span className="mm-badge yt">▶ 영상</span>}
                </div>
              </div>
              <button type="button" className="mm-sheet-x" onClick={() => setSheetId(null)} aria-label="닫기">✕</button>
            </div>

            {sheetItem.description && <p className="mm-sheet-desc">{sheetItem.description}</p>}

            {(sheetItem.optionGroups || []).length > 0 && (
              <div className="mm-sheet-opts">
                {sheetItem.optionGroups.map((g, gi) => (
                  <div key={gi} className="mm-opt-group">
                    <span className="mm-opt-gname">{g.name}{g.required && <em> 필수</em>}</span>
                    <span className="mm-opt-items">{g.options.map((o) => o.name + (o.extraPrice ? ` (+${o.extraPrice.toLocaleString()})` : '')).join(' · ')}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mm-sheet-acts">
              <button type="button" className="mm-act" onClick={() => { setItemDialog({ item: sheetItem, categoryId: sheetItem.categoryId }); setSheetId(null) }}>
                <Icon name="edit" /> 메뉴 수정
              </button>
              <button type="button" className="mm-act" onClick={() => setImgFor(sheetItem)}>
                <Icon name="image" /> 사진 변경
              </button>
              <button type="button" className="mm-act" onClick={() => { setItemDialog({ item: sheetItem, categoryId: sheetItem.categoryId }); setSheetId(null) }}>
                <Icon name="tune" /> 옵션 관리
              </button>
              <button type="button" className="mm-act" onClick={() => toggleSoldOut(sheetItem)}>
                <Icon name={sheetItem.soldOut ? 'check_circle' : 'block'} /> {sheetItem.soldOut ? '품절 해제' : '품절 처리'}
              </button>
              <button type="button" className="mm-act danger" onClick={() => setConfirm({ kind: 'item', id: sheetItem.id, name: sheetItem.name })}>
                <Icon name="delete" /> 메뉴 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사진 변경 시트 */}
      {imgFor && (
        <ImageChangeSheet
          item={imgFor}
          onUpload={async (file) => { try { const { url } = await tenantImageApi.uploadImage(file); await changeImage(imgFor, url) } catch (e) { onError(e.message) } }}
          onSearch={() => { /* handled inside */ }}
          onPick={(url) => changeImage(imgFor, url)}
          onRemove={() => changeImage(imgFor, '')}
          onClose={() => setImgFor(null)}
          onError={onError}
        />
      )}

      {/* 카테고리 관리 시트 */}
      {catManage && (
        <div className="mm-sheet-bd" onMouseDown={() => setCatManage(false)}>
          <div className="mm-sheet" onMouseDown={(e) => e.stopPropagation()}>
            <span className="tsheet-grip" />
            <div className="mm-sheet-head simple">
              <h3>카테고리 관리</h3>
              <button type="button" className="mm-sheet-x" onClick={() => setCatManage(false)} aria-label="닫기">✕</button>
            </div>
            <button type="button" className="mm-catadd" onClick={() => { setCatManage(false); setCatDialog({ mode: 'add' }) }}>
              <Icon name="add" /> 카테고리 추가
            </button>
            <div className="mm-catlist">
              {categories.length === 0 && <p className="mm-catlist-empty">아직 카테고리가 없습니다.</p>}
              {categories.map((c) => (
                <div key={c.id} className="mm-catrow">
                  <span className="mm-catrow-name">{c.name}<span className="mm-catrow-n">{c.items.length}</span></span>
                  <button type="button" className="mm-catrow-btn" onClick={() => { setCatManage(false); setCatDialog({ mode: 'rename', category: c }) }}><Icon name="edit" /></button>
                  <button type="button" className="mm-catrow-btn danger" onClick={() => setConfirm({ kind: 'cat', id: c.id, name: c.name })}><Icon name="delete" /></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 이미지 미리보기 */}
      {preview && (
        <div className="mm-preview" onClick={() => setPreview(null)}>
          <img src={preview} alt="미리보기" />
        </div>
      )}

      {/* 재사용 모달들 */}
      {itemDialog && (
        <MenuItemDialog
          tenantId={0} branchId={0} menuApi={api} imageApi={tenantImageApi}
          categoryId={itemDialog.categoryId} categories={categories} item={itemDialog.item}
          onClose={() => setItemDialog(null)}
          onSaved={(m) => { setMenu(m); setItemDialog(null) }}
          onError={onError}
        />
      )}
      {catDialog && (
        <CategoryDialog mode={catDialog.mode} initial={catDialog.category?.name ?? ''} onClose={() => setCatDialog(null)} onSubmit={submitCategory} />
      )}
      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirm.kind === 'cat' ? '카테고리 삭제' : '메뉴 삭제'}</h3>
            <p className="confirm-text"><strong>{confirm.name}</strong>{confirm.kind === 'cat' ? ' 카테고리와 그 안의 메뉴·옵션을 모두 삭제합니다.' : ' 메뉴를 삭제합니다.'}</p>
            <div className="dialog-actions">
              <button className="btn-ghost" onClick={() => setConfirm(null)}>취소</button>
              <button className="btn-primary btn-danger-solid" onClick={runConfirm}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 사진 변경 — 업로드 / 검색 / 제거.
function ImageChangeSheet({ item, onUpload, onPick, onRemove, onClose, onError }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const fileRef = useRef(null)
  return (
    <div className="mm-sheet-bd" onMouseDown={onClose}>
      <div className="mm-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <span className="tsheet-grip" />
        <div className="mm-sheet-head simple">
          <h3>사진 변경</h3>
          <button type="button" className="mm-sheet-x" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="mm-imgprev">
          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="mm-card-ph"><Icon name="restaurant" /></span>}
        </div>
        <div className="mm-sheet-acts">
          <button type="button" className="mm-act" onClick={() => fileRef.current?.click()}><Icon name="upload" /> 사진 업로드</button>
          <button type="button" className="mm-act" onClick={() => setSearchOpen(true)}><Icon name="search" /> 사진 검색</button>
          {item.imageUrl && <button type="button" className="mm-act danger" onClick={onRemove}><Icon name="delete" /> 사진 제거</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f) }} />
        {searchOpen && (
          <ImageSearchModal imageApi={tenantImageApi} defaultQuery={item.name}
            onPick={(url) => { setSearchOpen(false); onPick(url) }} onClose={() => setSearchOpen(false)} onError={onError} />
        )}
      </div>
    </div>
  )
}
