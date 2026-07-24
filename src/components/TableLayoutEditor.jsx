import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import Loading from './Loading'

// 좌석수 선택지 기본값(공통코드 TABLE_SEATS 로딩 실패 시 폴백).
const DEFAULT_SEATS = [{ value: 2, label: '2인' }, { value: 4, label: '4인' }, { value: 6, label: '6인' }, { value: 8, label: '8인' }]

// 좌석수 콤보박스 — 공통코드 옵션 + "직접입력"(임의 인원).
function SeatSelect({ value, options, onChange }) {
  const coded = options.some((o) => o.value === value)
  const [custom, setCustom] = useState(!coded)
  useEffect(() => { if (options.some((o) => o.value === value)) setCustom(false) }, [value, options])
  const showCustom = custom || !coded
  return (
    <span className="seat-select">
      <select
        value={showCustom ? '__c' : String(value)}
        onChange={(e) => {
          if (e.target.value === '__c') setCustom(true)
          else { setCustom(false); onChange(Number(e.target.value)) }
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        <option value="__c">직접입력</option>
      </select>
      {showCustom && (
        <input
          type="number" min="1" max="99" className="seat-custom"
          value={value}
          onChange={(e) => onChange(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
        />
      )}
    </span>
  )
}

// 좌석수에 따른 기본 크기(px). 룸은 조금 크게. (코드에 없는 인원은 좌석수로 보간)
const TABLE_SIZE = { 2: [64, 64], 4: [84, 84], 6: [110, 76], 8: [132, 84] }
const ROOM_SIZE = [140, 96]
function sizeForSeats(seats, kind) {
  if (kind === 'ROOM') return ROOM_SIZE
  if (TABLE_SIZE[seats]) return TABLE_SIZE[seats]
  const w = Math.max(60, Math.min(160, 44 + seats * 12))
  return [w, Math.max(60, Math.min(110, 52 + seats * 4))]
}
const CANVAS_W = 760
const CANVAS_H = 460

/**
 * 영업장 테이블 배치 편집기 — 층 탭 + 픽셀 캔버스에 테이블/룸을 드래그 배치.
 * 관리자 콘솔·업체 콘솔 양쪽에서 같은 컴포넌트를 쓴다. API 호출만 props 로 주입한다.
 *
 * props:
 *  - loadLayout(): Promise<layout>
 *  - onSave(body): Promise           저장
 *  - loadTableQr(table): Promise<objectUrl>
 *  - loadSeatOptions?(): Promise<[{value,label}]>  (없으면 기본 2/4/6/8인)
 *  - title, subtitle
 *  - embedded?: boolean              true 면 모달이 아니라 페이지 안에 그대로 박는다
 *  - onClose?()                      모달(관리자)일 때 닫기
 *  - onSaved?()                      임베드(업체)에서 저장 성공 콜백
 *  - onError(msg)
 */
const TableLayoutEditor = forwardRef(function TableLayoutEditor({
  loadLayout, onSave, loadTableQr, loadSeatOptions,
  title = '영업장 테이블 배치', subtitle,
  embedded = false, hideActions = false, onClose, onSaved, onError,
}, ref) {
  const [takeout, setTakeout] = useState(false)
  const [floorCount, setFloorCount] = useState(1)
  const [floor, setFloor] = useState(1)
  const [canvasW, setCanvasW] = useState(CANVAS_W)
  const [canvasH, setCanvasH] = useState(CANVAS_H)
  const [zoom, setZoom] = useState(1)
  const [tables, setTables] = useState([])
  const [selKeys, setSelKeys] = useState(() => new Set())
  const [marquee, setMarquee] = useState(null)
  const [alignMenu, setAlignMenu] = useState(null)
  const [qrTable, setQrTable] = useState(null)
  const [addSeats, setAddSeats] = useState(4)
  const [addKind, setAddKind] = useState('TABLE')
  const [seatOptions, setSeatOptions] = useState(DEFAULT_SEATS)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [confirmState, setConfirmState] = useState(null) // { message, confirmText, onYes }
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const seqRef = useRef(0)

  // 주입된 API 함수는 렌더마다 새 참조라, 마운트 시 1회만 부른다(원본 편집기와 동일).
  useEffect(() => {
    loadLayout()
      .then((l) => {
        setTakeout(l.takeoutOnly)
        setFloorCount(Math.max(1, l.floorCount || 1))
        setCanvasW(l.canvasW || CANVAS_W)
        setCanvasH(l.canvasH || CANVAS_H)
        setTables((l.tables ?? []).map((t) => ({ ...t, key: `db${t.tableId}` })))
        setLoaded(true)
      })
      .catch((e) => { onError(e.message); setLoaded(true) })
    if (loadSeatOptions) {
      loadSeatOptions().then((opts) => {
        if (opts && opts.length) { setSeatOptions(opts); setAddSeats(opts[0].value) }
      }).catch(() => {})
    }
    // eslint-disable-line react-hooks/exhaustive-deps
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 상단 저장 버튼 등 외부에서 저장을 트리거할 수 있게 노출한다.
  useImperativeHandle(ref, () => ({ save, isSaving: () => saving }))

  const onFloor = tables.filter((t) => t.floorNo === floor)
  const selected = selKeys.size === 1 ? tables.find((t) => selKeys.has(t.key)) : null

  function addTable() {
    const [w, h] = sizeForSeats(addSeats, addKind)
    const key = `new${seqRef.current++}`
    const n = onFloor.length
    const x = Math.min(20 + (n % 6) * 30, canvasW - w - 10)
    const y = Math.min(20 + Math.floor(n / 6) * 30, canvasH - h - 10)
    const code = (window.crypto?.randomUUID?.() ?? `t${Date.now()}${key}`)
    setTables((prev) => [...prev, { key, code, floorNo: floor, label: '', seats: addSeats, kind: addKind, x, y, width: w, height: h }])
    setSelKeys(new Set([key]))
  }

  function updateSel(patch) {
    setTables((prev) => prev.map((t) => (selKeys.has(t.key) ? { ...t, ...patch } : t)))
  }
  // 삭제는 확인창을 거친다.
  function deleteSel() {
    const n = selKeys.size
    if (n === 0) return
    setConfirmState({
      message: `선택한 테이블 ${n}개를 삭제하시겠습니까?`,
      confirmText: '삭제',
      onYes: () => {
        setTables((prev) => prev.filter((t) => !selKeys.has(t.key)))
        setSelKeys(new Set())
      },
    })
  }

  function startDrag(e, t) {
    e.stopPropagation()
    if (e.button !== 0) return
    const group = selKeys.has(t.key) && selKeys.size > 1 ? new Set(selKeys) : new Set([t.key])
    if (!(selKeys.has(t.key) && selKeys.size > 1)) setSelKeys(group)
    const rect = canvasRef.current.getBoundingClientRect()
    const startX = (e.clientX - rect.left) / zoom
    const startY = (e.clientY - rect.top) / zoom
    const origins = new Map()
    tables.forEach((x) => { if (group.has(x.key)) origins.set(x.key, { x: x.x, y: x.y }) })
    function move(ev) {
      let dx = (ev.clientX - rect.left) / zoom - startX
      let dy = (ev.clientY - rect.top) / zoom - startY
      origins.forEach((o, k) => {
        const tt = tables.find((x) => x.key === k)
        dx = Math.max(-o.x, Math.min(dx, canvasW - tt.width - o.x))
        dy = Math.max(-o.y, Math.min(dy, canvasH - tt.height - o.y))
      })
      setTables((prev) => prev.map((x) => (origins.has(x.key)
        ? { ...x, x: Math.round(origins.get(x.key).x + dx), y: Math.round(origins.get(x.key).y + dy) } : x)))
    }
    function up() { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function startMarquee(e) {
    if (e.button !== 0) return
    const rect = canvasRef.current.getBoundingClientRect()
    const sx = (e.clientX - rect.left) / zoom
    const sy = (e.clientY - rect.top) / zoom
    const items = onFloor
    setSelKeys(new Set())
    let dragged = false
    function move(ev) {
      const cx = (ev.clientX - rect.left) / zoom
      const cy = (ev.clientY - rect.top) / zoom
      const x = Math.min(sx, cx), y = Math.min(sy, cy), w = Math.abs(cx - sx), h = Math.abs(cy - sy)
      if (w > 3 || h > 3) dragged = true
      setMarquee({ x, y, w, h })
      const hit = new Set()
      items.forEach((t) => {
        if (t.x < x + w && t.x + t.width > x && t.y < y + h && t.y + t.height > y) hit.add(t.key)
      })
      setSelKeys(hit)
    }
    function up() {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setMarquee(null)
      if (!dragged) setSelKeys(new Set())
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function startPan(e) {
    const wrap = wrapRef.current
    if (!wrap) return
    e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const startL = wrap.scrollLeft, startT = wrap.scrollTop
    function move(ev) { wrap.scrollLeft = startL - (ev.clientX - startX); wrap.scrollTop = startT - (ev.clientY - startY) }
    function up() { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function onCanvasMouseDown(e) {
    if (e.button === 1) startPan(e)
    else if (e.button === 0) startMarquee(e)
  }

  function clusterAlign(values, threshold, grid) {
    const sorted = [...new Set(values)].sort((a, b) => a - b)
    const map = new Map()
    let g = [sorted[0]]
    const flush = () => {
      const avg = g.reduce((a, b) => a + b, 0) / g.length
      const target = Math.round(avg / grid) * grid
      g.forEach((v) => map.set(v, target))
    }
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - g[g.length - 1] <= threshold) g.push(sorted[i])
      else { flush(); g = [sorted[i]] }
    }
    flush()
    return map
  }
  function selectedOnFloor() {
    return tables.filter((t) => selKeys.has(t.key) && t.floorNo === floor)
  }
  function alignGrid() {
    const sel = selectedOnFloor()
    if (sel.length < 2) return
    const ax = clusterAlign(sel.map((t) => t.x), 40, 20)
    const ay = clusterAlign(sel.map((t) => t.y), 40, 20)
    setTables((prev) => prev.map((t) => (selKeys.has(t.key) && t.floorNo === floor
      ? { ...t, x: Math.max(0, ax.get(t.x)), y: Math.max(0, ay.get(t.y)) } : t)))
    setAlignMenu(null)
  }
  function distribute(axis) {
    const sel = selectedOnFloor()
    if (sel.length < 3) { setAlignMenu(null); return }
    const k = axis === 'h' ? 'x' : 'y'
    const s = [...sel].sort((a, b) => a[k] - b[k])
    const min = s[0][k], max = s[s.length - 1][k]
    const step = (max - min) / (s.length - 1)
    const pos = new Map(s.map((t, i) => [t.key, Math.round(min + i * step)]))
    setTables((prev) => prev.map((t) => (pos.has(t.key) ? { ...t, [k]: pos.get(t.key) } : t)))
    setAlignMenu(null)
  }

  function fitToView() {
    const wrap = wrapRef.current
    if (!wrap) return
    const availW = wrap.clientWidth - 32
    const availH = wrap.clientHeight - 32
    const z = Math.min(availW / canvasW, availH / canvasH, 1)
    setZoom(Math.max(0.2, Math.round(z * 100) / 100))
    wrap.scrollTo({ left: 0, top: 0 })
  }

  function startResizeCanvas(e) {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const startW = canvasW, startH = canvasH
    function move(ev) {
      setCanvasW(Math.round(Math.max(400, Math.min(startW + (ev.clientX - startX) / zoom, 2000)) / 20) * 20)
      setCanvasH(Math.round(Math.max(300, Math.min(startH + (ev.clientY - startY) / zoom, 1600)) / 20) * 20)
    }
    function up() {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function resizeCanvasBy(dw, dh) {
    setCanvasW((w) => Math.max(400, Math.min(w + dw, 2000)))
    setCanvasH((h) => Math.max(300, Math.min(h + dh, 1600)))
  }

  function addFloor() {
    setFloorCount((n) => n + 1)
    setFloor(floorCount + 1)
  }
  function removeFloor() {
    if (floorCount <= 1) return
    const removed = floorCount
    const onFloorCount = tables.filter((t) => t.floorNo === removed).length
    setConfirmState({
      message: onFloorCount > 0
        ? `맨 위 ${removed}층과 그 층의 테이블 ${onFloorCount}개를 삭제하시겠습니까?`
        : `맨 위 ${removed}층을 삭제하시겠습니까?`,
      confirmText: '삭제',
      onYes: () => {
        setTables((prev) => prev.filter((t) => t.floorNo !== removed))
        setFloorCount((n) => n - 1)
        if (floor === removed) setFloor(removed - 1)
      },
    })
  }

  async function save() {
    setSaving(true)
    try {
      const body = {
        takeoutOnly: takeout,
        floorCount,
        canvasW,
        canvasH,
        tables: takeout ? [] : tables.map((t) => ({
          code: t.code, floorNo: t.floorNo, label: t.label, seats: t.seats, kind: t.kind,
          x: t.x, y: t.y, width: t.width, height: t.height,
        })),
      }
      const result = await onSave(body)
      if (embedded) {
        // 저장하면 서버가 새 code/tableId 를 준다 → 다시 반영해 QR 이 바로 열리게.
        if (result && result.tables) {
          setTables(result.tables.map((t) => ({ ...t, key: `db${t.tableId}` })))
        }
        setJustSaved(true)
        setTimeout(() => setJustSaved(false), 2000)
        onSaved?.()
      } else {
        onClose()
      }
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  const content = (
    <>
      {(title || subtitle) && (
        <div className="branch-head">
          {title && <h3>{title}</h3>}
          {subtitle && <span className="branch-sub">{subtitle}</span>}
        </div>
      )}

      <label className="check layout-takeout">
        <input type="checkbox" checked={takeout} onChange={(e) => setTakeout(e.target.checked)} />
        포장 전문점 (테이블 없음)
      </label>

      {takeout ? (
        <p className="layout-takeout-msg">포장 전문점으로 설정되어 테이블 배치를 입력하지 않습니다.</p>
      ) : !loaded ? (
        <Loading label="배치도를 불러오는 중…" />
      ) : (
        <>
          <div className="floor-tabs">
            {Array.from({ length: floorCount }, (_, i) => i + 1).map((f) => (
              <button
                key={f}
                type="button"
                className={`floor-tab${floor === f ? ' on' : ''}`}
                onClick={() => { setFloor(f); setSelKeys(new Set()) }}
              >
                {f}층
              </button>
            ))}
            <button type="button" className="floor-tab add" onClick={addFloor} title="층 추가">+ 층</button>
            {floorCount > 1 && (
              <button type="button" className="floor-tab del" onClick={removeFloor} title="맨 위 층 삭제">− 층</button>
            )}
          </div>

          <div className="layout-toolbar">
            <div className="lt-group">
              <span className="lt-glabel">추가</span>
              <select value={addKind} onChange={(e) => setAddKind(e.target.value)}>
                <option value="TABLE">테이블</option>
                <option value="ROOM">룸</option>
              </select>
              <SeatSelect value={addSeats} options={seatOptions} onChange={setAddSeats} />
              <button type="button" className="btn-primary btn-sm" onClick={addTable}>＋ 추가</button>
            </div>

            <div className="lt-group">
              <span className="lt-glabel">영업장</span>
              <button type="button" className="szbtn" title="줄이기" onClick={() => resizeCanvasBy(-120, -80)}>－</button>
              <span className="lt-size-val">{canvasW}×{canvasH}</span>
              <button type="button" className="szbtn" title="넓히기" onClick={() => resizeCanvasBy(120, 80)}>＋</button>
            </div>

            <div className="lt-group">
              <span className="lt-glabel">보기</span>
              <button type="button" className="btn-ghost btn-sm" onClick={fitToView}>전체보기</button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setZoom(1)}>100%</button>
              <span className="lt-size-val">{Math.round(zoom * 100)}%</span>
            </div>

            {selected && (
              <div className="lt-group lt-sel">
                <span className="lt-glabel">선택</span>
                <input
                  className="layout-label-input"
                  value={selected.label}
                  onChange={(e) => updateSel({ label: e.target.value })}
                  placeholder="이름(선택)"
                  maxLength={30}
                />
                <SeatSelect
                  value={selected.seats}
                  options={seatOptions}
                  onChange={(v) => {
                    const [w, h] = sizeForSeats(v, selected.kind)
                    updateSel({ seats: v, width: w, height: h })
                  }}
                />
                {selected.tableId
                  ? <button type="button" className="btn-ghost btn-sm" onClick={() => setQrTable(selected)}>QR</button>
                  : <span className="lt-qr-hint" title="저장하면 QR이 생성됩니다">QR(저장 후)</span>}
                <button type="button" className="btn-danger btn-sm" onClick={deleteSel}>삭제</button>
              </div>
            )}
          </div>

          <div className="layout-canvas-wrap" ref={wrapRef}>
            <div className="layout-canvas-scale" style={{ width: canvasW * zoom, height: canvasH * zoom }}>
              <div
                ref={canvasRef}
                className="layout-canvas"
                style={{ width: canvasW, height: canvasH, transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                onMouseDown={onCanvasMouseDown}
                onContextMenu={(e) => {
                  if (selKeys.size >= 2) { e.preventDefault(); setAlignMenu({ x: e.clientX, y: e.clientY }) }
                }}
              >
                {onFloor.map((t) => (
                  <div
                    key={t.key}
                    className={`layout-table${t.kind === 'ROOM' ? ' room' : ''}${selKeys.has(t.key) ? ' sel' : ''}`}
                    style={{ left: t.x, top: t.y, width: t.width, height: t.height }}
                    onMouseDown={(e) => startDrag(e, t)}
                  >
                    <span className="lt-label">{t.label || (t.kind === 'ROOM' ? '룸' : `T`)}</span>
                    <span className="lt-seats">{t.seats}인</span>
                  </div>
                ))}
                {marquee && (
                  <div className="layout-marquee"
                       style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
                )}
                {onFloor.length === 0 && (
                  <div className="layout-empty">
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 3v18" />
                    </svg>
                    <p className="le-title">이 층에 테이블이 없습니다</p>
                    <p className="le-sub">위 “＋ 추가”로 테이블·룸을 놓아보세요</p>
                  </div>
                )}
                <div className="layout-resize" title="끌어서 영업장 크기 조절" onMouseDown={startResizeCanvas} />
              </div>
            </div>
          </div>
          <p className="hint left">테이블을 끌어 옮기고, 빈 곳을 끌면 <b>여러 개를 한 번에 선택</b>할 수 있습니다 · 선택 후 <b>우클릭</b>하면 오와열을 반듯하게 맞춥니다 · 가운데 버튼으로 화면 이동 · 우하단 모서리를 끌면 영업장이 넓어집니다.</p>
        </>
      )}

      {alignMenu && (
        <>
          <div className="context-menu-backdrop" onMouseDown={() => setAlignMenu(null)} onContextMenu={(e) => { e.preventDefault(); setAlignMenu(null) }} />
          <div className="context-menu" style={{ left: alignMenu.x, top: alignMenu.y }}>
            <div className="cm-head">{selKeys.size}개 선택됨</div>
            <button type="button" onClick={alignGrid}>⊞ 오와열 반듯하게</button>
            <button type="button" onClick={() => distribute('h')}>↔ 가로 간격 균등</button>
            <button type="button" onClick={() => distribute('v')}>↕ 세로 간격 균등</button>
          </div>
        </>
      )}

      {!hideActions && (
        <div className="dialog-actions">
          {embedded ? (
            <>
              {justSaved && <span className="save-flash">저장되었습니다 ✓</span>}
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={onClose}>취소</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
            </>
          )}
        </div>
      )}

      {qrTable && (
        <TableQrModal
          table={qrTable}
          loadQr={loadTableQr}
          onClose={() => setQrTable(null)}
          onError={onError}
        />
      )}

      <ConfirmDialog
        open={!!confirmState}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText}
        onConfirm={() => { confirmState?.onYes?.(); setConfirmState(null) }}
        onCancel={() => setConfirmState(null)}
      />
    </>
  )

  if (embedded) {
    return <div className="layout-embedded">{content}</div>
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal layout-modal" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  )
})

export default TableLayoutEditor

/** 테이블 주문 QR 모달 — 인쇄·부착용. 이미지·다운로드 제공. */
function TableQrModal({ table, loadQr, onClose, onError }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let url
    loadQr(table)
      .then((u) => { url = u; setSrc(u) })
      .catch((e) => onError(e.message))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [table, loadQr, onError])

  const title = `${table.floorNo}층 · ${table.label || (table.kind === 'ROOM' ? '룸' : '테이블')} ${table.seats}인`

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal qr-modal" onClick={(e) => e.stopPropagation()}>
        <h3>테이블 주문 QR</h3>
        <p className="qr-sub">{title}</p>
        <div className="qr-box">
          {src ? <img src={src} alt="테이블 주문 QR" width="240" height="240" /> : <span className="muted">생성 중…</span>}
        </div>
        <p className="qr-note">손님이 이 QR을 스캔하면 이 테이블의 주문 화면으로 이동합니다.</p>
        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
          {src && <a className="btn-primary btn-sm qr-dl" href={src} download={`table-qr-${table.tableId}.png`}>PNG 다운로드</a>}
        </div>
      </div>
    </div>
  )
}
