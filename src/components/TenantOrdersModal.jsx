import { useCallback, useEffect, useState } from 'react'
import { tenantApi } from '../api/client'
import SoldOutModal from './SoldOutModal'

// 주문 상태 라벨(공통코드 ORDER_STATUS 와 동일).
const STATUS = {
  WAITING: '주문 대기', RECEIVED: '접수', COOKING: '조리 중', READY: '조리 완료',
  SERVING: '서빙 중', SERVED: '서빙 완료', PAID: '결제완료', CANCELLED: '취소', CLOSED: '종료',
}
const PAY = { TRANSFER: '계좌이체', CARD: '카드', KAKAO_PAY: '카카오페이', TOSS_PAY: '토스페이', CASH: '현금' }
const FILTERS = [
  { key: '', label: '전체' },
  { key: 'RECEIVED', label: '접수' },
  { key: 'COOKING,READY', label: '조리' },
  { key: 'SERVED', label: '서빙' },
  { key: 'CLOSED,CANCELLED', label: '종료' },
]
function won(n) { return `${(n ?? 0).toLocaleString()}원` }
function fmt(dt) { return dt ? dt.slice(0, 16).replace('T', ' ') : '-' }
function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function shiftDay(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 플랫폼 관리자 — 업체별 주문 조회(읽기 전용, 날짜별 페이징). 상태 변경은 사장님 콘솔에서 한다. */
export default function TenantOrdersModal({ tenant, onClose, onError }) {
  const tid = tenant.tenantId
  const [filter, setFilter] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [page, setPage] = useState(0)
  const [pageInfo, setPageInfo] = useState({ totalElements: 0, totalPages: 0 })
  const [orders, setOrders] = useState(null)
  const [soldOpen, setSoldOpen] = useState(false)

  const load = useCallback(async () => {
    setOrders(null)
    try {
      const res = await tenantApi.orders(tid, filter, date, page)
      setOrders(res.content)
      setPageInfo({ totalElements: res.totalElements, totalPages: res.totalPages })
    } catch (e) { onError(e.message); setOrders([]) }
  }, [tid, filter, date, page, onError])
  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [filter, date])

  const count = pageInfo.totalElements
  const total = (orders ?? []).reduce((s, o) => s + o.totalAmount, 0)

  return (
    <>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal staff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="branch-head">
          <h3>주문 관리</h3>
          <span className="branch-sub">{tenant.tenantName} ({tenant.tenantCode})</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>
            <button className="btn-ghost btn-sm" onClick={() => setSoldOpen(true)}>품절 관리</button>
            <button className="btn-ghost btn-sm" onClick={load}>새로고침</button>
          </span>
        </div>

        <div className="row-actions" style={{ margin: '2px 0 10px', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn-ghost btn-sm" onClick={() => setDate((d) => shiftDay(d, -1))} aria-label="이전 날">‹</button>
          <input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value || todayLocal())} />
          <button className="btn-ghost btn-sm" disabled={date >= todayLocal()} onClick={() => setDate((d) => (d >= todayLocal() ? d : shiftDay(d, 1)))} aria-label="다음 날">›</button>
          {date !== todayLocal() && <button className="btn-ghost btn-sm" onClick={() => setDate(todayLocal())}>오늘</button>}
        </div>

        <div className="row-actions" style={{ margin: '0 0 12px', flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {orders === null ? (
          <p className="muted" style={{ padding: 30, textAlign: 'center' }}>불러오는 중…</p>
        ) : orders.length === 0 ? (
          <p className="muted" style={{ padding: 30, textAlign: 'center' }}>이 날짜에는 주문이 없습니다.</p>
        ) : (
          <>
            <div className="table-wrap staff-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>주문번호</th><th>테이블</th><th style={{ width: 90 }}>상태</th>
                    <th style={{ width: 90 }}>결제</th><th style={{ width: 110, textAlign: 'right' }}>금액</th>
                    <th style={{ width: 130 }}>시각</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.orderId}>
                      <td className="mono">{o.orderNo}</td>
                      <td>{o.orderType === 'TAKEOUT' ? '포장' : (o.tableLabel || '-')}</td>
                      <td><span className="badge">{STATUS[o.status] || o.status}</span></td>
                      <td className="muted-cell">{o.paid ? (PAY[o.paymentMethod] || o.paymentMethod || '완료') : '미결제'}</td>
                      <td className="strong" style={{ textAlign: 'right' }}>{won(o.totalAmount)}</td>
                      <td className="muted-cell">{fmt(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <p className="hint left" style={{ margin: 0 }}>총 {count}건 · 이 페이지 합계 {won(total)} · 읽기 전용</p>
              {pageInfo.totalPages > 1 && (
                <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn-ghost btn-sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>‹</button>
                  <span className="mono">{page + 1} / {pageInfo.totalPages}</span>
                  <button className="btn-ghost btn-sm" disabled={page >= pageInfo.totalPages - 1} onClick={() => setPage((p) => Math.min(pageInfo.totalPages - 1, p + 1))}>›</button>
                </span>
              )}
            </div>
          </>
        )}

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>

    {soldOpen && (
      <SoldOutModal
        api={{
          getMenu: () => tenantApi.menu(tid),
          setSoldOut: (itemId, soldOut) => tenantApi.menuSoldOut(tid, itemId, soldOut),
        }}
        onClose={() => setSoldOpen(false)}
      />
    )}
    </>
  )
}
