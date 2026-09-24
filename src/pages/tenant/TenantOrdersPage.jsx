import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import SoldOutModal from '../../components/SoldOutModal'
import { tenantOrderApi, tenantTableApi, tenantMenuBoardApi, tenantTokenStore } from '../../api/tenantClient'

// 로컬 기준 오늘(yyyy-MM-dd). toISOString(UTC)은 저녁에 하루 밀릴 수 있어 직접 만든다.
function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function shiftDay(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 주문 상태 표시(라벨·색). 코드값은 공통코드 ORDER_STATUS 와 동일.
const STATUS = {
  WAITING: { label: '주문 대기', cls: 'wait' },
  RECEIVED: { label: '접수', cls: 'received' },
  COOKING: { label: '조리 중', cls: 'cooking' },
  READY: { label: '조리 완료', cls: 'ready' },
  SERVING: { label: '서빙 중', cls: 'serving' },
  SERVED: { label: '서빙 완료', cls: 'served' },
  PAYMENT_WAIT: { label: '결제 대기', cls: 'pay' },
  PARTIALLY_PAID: { label: '부분 결제', cls: 'pay' },
  PAID: { label: '결제 완료', cls: 'paid' },
  CANCEL_REQUESTED: { label: '취소 요청', cls: 'cancel' },
  CANCELLED: { label: '주문 취소', cls: 'cancel' },
  CLOSED: { label: '종료', cls: 'closed' },
}
// 선불 모델 — 결제 완료된 주문이 '접수'로 들어와 조리→서빙→완료로 진행. 결제 단계는 없다.
const NEXT = {
  RECEIVED: { to: 'COOKING', label: '조리 시작' },
  COOKING: { to: 'READY', label: '조리 완료' },
  READY: { to: 'SERVED', label: '서빙 완료' },
  SERVED: { to: 'CLOSED', label: '완료' },
}
// 결제가 이미 끝난 주문의 취소는 환불을 뜻한다(모의). 조리 전(접수)·조리 중까지만 허용.
const CANCELLABLE = new Set(['RECEIVED', 'COOKING'])
// 주문 유형 탭 — 유형으로 먼저 거르고, 그 안에서 아래 상태 필터로 다시 거른다.
const TYPE_TABS = [
  { key: 'ALL', label: '전체', icon: 'apps' },
  { key: 'DINE_IN', label: '테이블', icon: 'table_restaurant' },
  { key: 'TAKEOUT', label: '포장', icon: 'takeout_dining' },
  { key: 'PARCEL', label: '택배', icon: 'local_shipping' },
]
const FILTERS = [
  { key: 'ALL', label: '전체', color: '#8b8b9a' },
  { key: 'RECEIVED', label: '결제·접수', color: '#f59e0b' },
  { key: 'COOKING,READY', label: '조리', color: '#ef4444' },
  { key: 'SERVED', label: '서빙 완료', color: '#3b82f6' },
  { key: 'CLOSED,CANCELLED', label: '종료', color: '#22c55e' },
]
// 결제 수단 표시.
const PAY_METHOD = { TRANSFER: '계좌이체', CARD: '카드', KAKAO_PAY: '카카오페이', TOSS_PAY: '토스페이', CASH: '현금' }
// 테이블을 '사용 중'으로 볼 상태 — 종료/취소 전까지(선불이라 접수부터 서빙까지 착석 중).
const ACTIVE = new Set(['WAITING', 'RECEIVED', 'COOKING', 'READY', 'SERVING', 'SERVED'])
// 테이블 카드의 대표 상태 — 여러 주문이면 가장 이른 단계(먼저 처리할 것)를 보여준다.
const STAGE = { WAITING: 0, RECEIVED: 1, PAID: 1, COOKING: 2, READY: 3, SERVING: 4, SERVED: 5, PAYMENT_WAIT: 6, PARTIALLY_PAID: 6, CANCEL_REQUESTED: 7, CANCELLED: 8, CLOSED: 9 }
function tableStatus(orders) {
  let best = orders[0]
  for (const o of orders) if ((STAGE[o.status] ?? 99) < (STAGE[best.status] ?? 99)) best = o
  return STATUS[best.status] || { label: best.status, cls: 'received' }
}
function won(n) { return `${(n ?? 0).toLocaleString()}원` }
function time(dt) { return dt ? dt.slice(11, 16) : '' }
function tableTitle(t) { return t.label || (t.kind === 'ROOM' ? '룸' : '테이블') }

export default function TenantOrdersPage() {
  const [view, setView] = useState('list')       // 'list' | 'board'(테이블 현황)
  const [filter, setFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL') // 유형: ALL | DINE_IN(테이블) | TAKEOUT(포장) | PARCEL(택배)
  const [date, setDate] = useState(todayLocal())  // 조회 날짜(하루치)
  const [page, setPage] = useState(0)             // 0-기반 페이지
  const [pageInfo, setPageInfo] = useState({ totalElements: 0, totalPages: 0 })
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null) // 상태 변경 중인 주문 id

  // 테이블 현황 — 배치도 + 진행 중(활성) 주문.
  const [layout, setLayout] = useState(null)
  const [boardOrders, setBoardOrders] = useState([])
  const [floor, setFloor] = useState(1)
  const [tableModal, setTableModal] = useState(null) // { table, orders }
  const [soldOpen, setSoldOpen] = useState(false)    // 품절 관리 모달
  const [parcel, setParcel] = useState(null)     // 택배 받기 여부 (null=로딩)

  // 택배 사용 여부 로드
  useEffect(() => {
    let alive = true
    tenantOrderApi.parcelStatus()
      .then((r) => { if (alive) setParcel(!!r?.enabled) })
      .catch(() => { if (alive) setParcel(false) })
    return () => { alive = false }
  }, [])

  // 택배 받기 on/off 토글
  async function toggleParcel() {
    try {
      const r = await tenantOrderApi.setParcel(!parcel)
      setParcel(!!r?.enabled)
      setError(`택배 주문 받기를 ${r?.enabled ? '켰습니다' : '껐습니다'}.`)
    } catch (e) {
      setError(e.message)
    }
  }

  const load = useCallback(async (f, t, d, p) => {
    try {
      const res = await tenantOrderApi.list(f, t, d, p)
      setOrders(res.content)
      setPageInfo({ totalElements: res.totalElements, totalPages: res.totalPages })
    } catch (e) { setError(e.message); setOrders([]) }
  }, [])
  const loadBoard = useCallback(async () => {
    try {
      const [lay, ords] = await Promise.all([tenantTableApi.layout(), tenantOrderApi.active()])
      setLayout(lay); setBoardOrders(ords)
    } catch (e) { setError(e.message) }
  }, [])

  // 필터·날짜가 바뀌면 첫 페이지로.
  useEffect(() => { setPage(0) }, [filter, typeFilter, date])
  useEffect(() => { if (view === 'list') load(filter, typeFilter, date, page) }, [view, filter, typeFilter, date, page, load])
  useEffect(() => { if (view === 'board') loadBoard() }, [view, loadBoard])

  // 현재 화면을 다시 불러오는 함수를 ref 로 최신 유지(웹소켓 콜백에서 사용).
  const refreshRef = useRef(() => {})
  refreshRef.current = () => (view === 'board' ? loadBoard() : load(filter, typeFilter, date, page))

  // 안전망 — 8초마다 자동 새로고침.
  useEffect(() => {
    const t = setInterval(() => refreshRef.current(), 8000)
    return () => clearInterval(t)
  }, [])

  // 실시간 — 손님이 결제(주문)하면 웹소켓으로 즉시 새 주문을 받아 새로고침 + 배너.
  const [orderFlash, setOrderFlash] = useState('')
  useEffect(() => {
    let alive = true, ws = null, reconnect = null
    const connect = () => {
      if (!alive) return
      const token = tenantTokenStore.access
      if (!token) { reconnect = setTimeout(connect, 4000); return }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      try { ws = new WebSocket(`${proto}//${window.location.host}/ws/tenant-notify?token=${encodeURIComponent(token)}`) }
      catch { reconnect = setTimeout(connect, 4000); return }
      ws.onmessage = (e) => {
        let msg = {}
        try { msg = JSON.parse(e.data) } catch { /* noop */ }
        if (msg.type !== 'NEW_ORDER') return
        refreshRef.current()
        setOrderFlash(`새 주문이 들어왔어요${msg.tableLabel ? ` · ${msg.tableLabel}` : ''}`)
        setTimeout(() => { if (alive) setOrderFlash('') }, 4500)
      }
      ws.onclose = () => { if (alive) reconnect = setTimeout(connect, 4000) }
      ws.onerror = () => { try { ws.close() } catch { /* noop */ } }
    }
    connect()
    return () => { alive = false; clearTimeout(reconnect); if (ws) { ws.onclose = null; try { ws.close() } catch { /* noop */ } } }
  }, [])

  async function change(order, to) {
    setBusy(order.orderId)
    try { await tenantOrderApi.changeStatus(order.orderId, to); await load(filter, typeFilter, date, page) }
    catch (e) { setError(e.message) } finally { setBusy(null) }
  }

  // 테이블별 '사용 중' 주문 집계.
  const byTable = useMemo(() => {
    const m = {}
    for (const o of boardOrders) {
      if (o.tableId == null || !ACTIVE.has(o.status)) continue
      const cur = m[o.tableId] || { count: 0, amount: 0, orders: [] }
      cur.count += 1; cur.amount += o.totalAmount; cur.orders.push(o)
      m[o.tableId] = cur
    }
    return m
  }, [boardOrders])

  const floorCount = Math.max(1, layout?.floorCount || 1)
  const tablesOnFloor = (layout?.tables || []).filter((t) => t.floorNo === floor)
  const activeTables = Object.keys(byTable).length
  const seatedTotal = Object.values(byTable).reduce((s, t) => s + t.amount, 0)

  return (
    <TenantShell>
      {orderFlash && (
        <div className="ord-newflash" role="status">
          <Icon name="notifications_active" filled /> {orderFlash}
        </div>
      )}
      <div className="m-topline">
        <div className="m-page-head">
          <span className="m-eyebrow"><Icon name="receipt_long" /> ORDER MANAGEMENT</span>
          <h1>주문 관리</h1>
          <p>들어온 주문을 확인하고 상태를 진행하세요. <span className="m-nowrap">(새 주문 실시간 알림)</span></p>
        </div>
        <div className="m-topline-actions">
          <button
            className="m-btn m-btn-outline2"
            onClick={toggleParcel}
            disabled={parcel === null}
            style={parcel ? { borderColor: 'var(--c-primary, #2f6feb)', color: 'var(--c-primary, #2f6feb)' } : undefined}
            title="택배 주문 받기 (택배사 발송)"
          >
            <Icon name="local_shipping" /> 택배 {parcel === null ? '…' : (parcel ? 'ON' : 'OFF')}
          </button>
          <button className="m-btn m-btn-outline2" onClick={() => setSoldOpen(true)}><Icon name="remove_shopping_cart" /> 품절 관리</button>
          <button className="m-btn m-btn-outline2" onClick={() => (view === 'board' ? loadBoard() : load(filter, typeFilter, date, page))}><Icon name="refresh" /> 새로고침</button>
        </div>
      </div>

      {/* 보기 전환 — 주문 목록 / 테이블 현황. 목록일 때 날짜 이동을 토글 옆에 둔다. */}
      <div className="ord-toprow">
        <div className="m-tabs" role="tablist">
          <button className={`m-tab${view === 'list' ? ' on' : ''}`} onClick={() => setView('list')}>
            <Icon name="receipt_long" /> 주문 목록
          </button>
          <button className={`m-tab${view === 'board' ? ' on' : ''}`} onClick={() => setView('board')}>
            <Icon name="grid_view" /> 테이블 현황
          </button>
        </div>

        {view === 'list' && (
          <div className="ord-datebar">
            <button className="ord-daybtn" onClick={() => setDate((d) => shiftDay(d, -1))} aria-label="이전 날">
              <Icon name="chevron_left" />
            </button>
            <input className="ord-dateinput" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value || todayLocal())} />
            <button className="ord-daybtn" onClick={() => setDate((d) => (d >= todayLocal() ? d : shiftDay(d, 1)))} disabled={date >= todayLocal()} aria-label="다음 날">
              <Icon name="chevron_right" />
            </button>
            {date !== todayLocal() && <button className="m-btn m-btn-ghost btn-sm" onClick={() => setDate(todayLocal())}>오늘</button>}
            <span className="ord-total">총 {pageInfo.totalElements}건</span>
          </div>
        )}
      </div>

      {view === 'board' ? (
        <TableBoard
          layout={layout}
          floor={floor}
          floorCount={floorCount}
          tablesOnFloor={tablesOnFloor}
          byTable={byTable}
          activeTables={activeTables}
          seatedTotal={seatedTotal}
          onFloor={setFloor}
          onPick={(t) => setTableModal({ table: t, orders: byTable[t.tableId].orders })}
        />
      ) : (
      <>
      {/* 유형 탭 — 테이블/포장/택배로 먼저 거른다. */}
      <div className="m-tabs ord-type-tabs" role="tablist">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={typeFilter === t.key}
            className={`m-tab${typeFilter === t.key ? ' on' : ''}`}
            onClick={() => setTypeFilter(t.key)}
          >
            <Icon name={t.icon} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flow-toggle" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            className={`flow-node${filter === f.key ? ' on' : ''}`}
            style={{ '--dot': f.color }}
            onClick={() => setFilter(f.key)}
          >
            <span className="flow-dot" />
            <span className="flow-label">{f.label}</span>
          </button>
        ))}
      </div>

      {orders === null ? (
        <Loading label="주문을 불러오는 중…" />
      ) : orders.length === 0 ? (
        <div className="m-card m-empty"><Icon name="receipt_long" /><p>해당하는 주문이 없습니다.</p></div>
      ) : (
        <div className="ord-grid">
          {orders.map((o) => {
            const next = NEXT[o.status]
            return (
              <div key={o.orderId} className="m-card ord-card">
                <div className="ord-card-head">
                  <span className="ord-table">{o.tableLabel || '포장'}</span>
                  <span className={`ord-badge ${STATUS[o.status]?.cls}`}>{STATUS[o.status]?.label || o.status}</span>
                </div>
                <div className="ord-meta">
                  <span className="ord-no">{o.orderNo}</span>
                  <span className="ord-time">{time(o.createdAt)}</span>
                </div>
                <ul className="ord-lines">
                  {(o.items || []).map((it, i) => (
                    <li key={i} className="ord-line">
                      <span className="ord-line-qty">{it.quantity}</span>
                      <span className="ord-line-name">
                        {it.menuName}
                        {it.optionsText && <em className="ord-line-opt"> · {it.optionsText}</em>}
                      </span>
                      <span className="ord-line-amt">{won(it.lineAmount)}</span>
                    </li>
                  ))}
                </ul>
                <div className="ord-body">
                  <span className="ord-items">{o.itemCount}개 항목</span>
                  <span className="ord-amount">{won(o.totalAmount)}</span>
                </div>
                {o.paid && (
                  <div className="ord-paid">
                    <Icon name="check_circle" />
                    선불 결제완료{o.paymentMethod ? ` · ${PAY_METHOD[o.paymentMethod] || o.paymentMethod}` : ''}
                  </div>
                )}
                <div className="ord-actions">
                  {CANCELLABLE.has(o.status) && (
                    <button className="btn-danger btn-sm" disabled={busy === o.orderId} onClick={() => change(o, 'CANCELLED')}>취소</button>
                  )}
                  {next && (
                    <button className="btn-primary btn-sm ord-next" disabled={busy === o.orderId} onClick={() => change(o, next.to)}>
                      {busy === o.orderId ? '…' : next.label} <Icon name="arrow_forward" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {orders !== null && pageInfo.totalPages > 1 && (
        <div className="ord-pager">
          <button className="ord-daybtn" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <Icon name="chevron_left" />
          </button>
          <span className="ord-pageinfo">{page + 1} / {pageInfo.totalPages}</span>
          <button className="ord-daybtn" disabled={page >= pageInfo.totalPages - 1} onClick={() => setPage((p) => Math.min(pageInfo.totalPages - 1, p + 1))}>
            <Icon name="chevron_right" />
          </button>
        </div>
      )}
      </>
      )}

      {tableModal && (
        <TableStatusModal
          data={tableModal}
          onClose={() => setTableModal(null)}
        />
      )}
      {soldOpen && (
        <SoldOutModal
          api={{
            getMenu: () => tenantMenuBoardApi.get(),
            setSoldOut: (itemId, soldOut) => tenantMenuBoardApi.setSoldOut(itemId, soldOut),
          }}
          onClose={() => setSoldOpen(false)}
        />
      )}
      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}

// 테이블 현황 — 층별 배치도 위에 각 테이블의 사용 여부·주문 건수·금액을 얹는다.
function TableBoard({ layout, floor, floorCount, tablesOnFloor, byTable, activeTables, seatedTotal, onFloor, onPick }) {
  if (layout === null) return <Loading label="테이블 현황을 불러오는 중…" />
  const cw = layout.canvasW || 760
  const ch = layout.canvasH || 460
  return (
    <div className="m-card pay-board-card">
      <div className="pay-stats" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, fontSize: 14, color: 'var(--m-secondary)' }}>
        <span>사용 중 <b style={{ color: 'var(--m-primary)' }}>{activeTables}</b>테이블</span>
        <span className="pay-stats-total">착석 합계 <b style={{ color: 'var(--m-on-surface)' }}>{won(seatedTotal)}</b></span>
      </div>
      {floorCount > 1 && (
        <>
          {/* 데스크톱: 층 버튼(pill) */}
          <div className="pay-floors">
            {Array.from({ length: floorCount }, (_, i) => i + 1).map((f) => (
              <button key={f} className={`pay-floor${floor === f ? ' on' : ''}`} onClick={() => onFloor(f)}>{f}층</button>
            ))}
          </div>
          {/* 모바일: 층 선택 드롭다운 */}
          <div className="tb-floorsel">
            <select value={floor} onChange={(e) => onFloor(Number(e.target.value))} aria-label="층 선택">
              {Array.from({ length: floorCount }, (_, i) => i + 1).map((f) => (
                <option key={f} value={f}>{f}층</option>
              ))}
            </select>
            <Icon name="expand_more" className="tb-floorsel-caret" />
          </div>
        </>
      )}
      {/* 데스크톱: 층별 배치도(평면도) */}
      <div className="pay-canvas-wrap">
        <div className="pay-canvas" style={{ width: cw, height: ch }}>
          {tablesOnFloor.map((t) => {
            const agg = byTable[t.tableId]
            const active = !!agg
            return (
              <div
                key={t.tableId}
                className={`pay-table${t.kind === 'ROOM' ? ' room' : ''}${active ? ' due' : ''}`}
                style={{ left: t.x, top: t.y, width: t.width, height: t.height }}
                onClick={active ? () => onPick(t) : undefined}
              >
                <span className="pt-label">{tableTitle(t)}</span>
                {active ? (
                  <>
                    <span className="pt-amount">{won(agg.amount)}</span>
                    <span className="pt-empty">{agg.count}건</span>
                  </>
                ) : (
                  <span className="pt-empty">비어있음</span>
                )}
              </div>
            )
          })}
          {tablesOnFloor.length === 0 && <div className="pay-empty">이 층에 테이블이 없습니다.</div>}
        </div>
      </div>

      {/* 모바일: 테이블 카드 그리드(평면도 대신). 상태 배지·건수·금액, 빈 테이블은 비어있음. */}
      <div className="tb-grid">
        {tablesOnFloor.length === 0 && <div className="tb-empty-floor">이 층에 테이블이 없습니다.</div>}
        {tablesOnFloor.map((t) => {
          const agg = byTable[t.tableId]
          const active = !!agg
          const st = active ? tableStatus(agg.orders) : null
          return (
            <button
              key={t.tableId}
              type="button"
              className={`tb-card${active ? '' : ' empty'}`}
              onClick={active ? () => onPick(t) : undefined}
              disabled={!active}
            >
              <div className="tb-card-head">
                <span className="tb-card-name">{tableTitle(t)}</span>
                {active
                  ? <span className={`ord-badge ${st.cls}`}>{st.label}</span>
                  : <span className="tb-empty-tag">비어있음</span>}
              </div>
              {active ? (
                <div className="tb-card-body">
                  <span className="tb-card-count">{agg.count}건</span>
                  <span className="tb-card-amount">{won(agg.amount)}</span>
                </div>
              ) : (
                <span className="tb-card-plus"><Icon name="add_circle" /></span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 한 테이블의 현재 주문(사용 중) 상세 — 읽기 전용.
function TableStatusModal({ data, onClose }) {
  const { table, orders } = data
  const total = orders.reduce((s, o) => s + o.totalAmount, 0)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pay-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pay-modal-head">
          <h3><Icon name="table_restaurant" /> {tableTitle(table)} 현황</h3>
          <button className="m-icon-btn" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
        </div>
        <div className="pay-bill">
          {orders.map((o) => (
            <div className="pay-order" key={o.orderId}>
              <div className="pay-order-no">{o.orderNo} · {STATUS[o.status]?.label || o.status} · {time(o.createdAt)}</div>
              {(o.items || []).map((it, i) => (
                <div className="pay-line" key={i}>
                  <span className="pay-line-qty">{it.quantity}</span>
                  <span className="pay-line-name">{it.menuName}{it.optionsText && <em className="pay-line-opt"> · {it.optionsText}</em>}</span>
                  <span className="pay-line-amt">{won(it.lineAmount)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="pay-total"><span>합계</span><b>{won(total)}</b></div>
        <div className="pay-modal-actions">
          <button className="btn-ghost" onClick={onClose} style={{ flex: 1 }}>닫기</button>
        </div>
      </div>
    </div>
  )
}
