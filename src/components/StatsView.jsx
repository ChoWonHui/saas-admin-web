import { useCallback, useEffect, useMemo, useState } from 'react'

function won(n) { return `${(n ?? 0).toLocaleString()}원` }
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function today() { return new Date() }
function shift(days) { const d = today(); d.setDate(d.getDate() + days); return d }
function monthStart() { const d = today(); return new Date(d.getFullYear(), d.getMonth(), 1) }
function oneMonthAgo() { const d = today(); d.setMonth(d.getMonth() - 1); return d }

const PRESETS = [
  { key: 'today', label: '오늘', range: () => [today(), today()] },
  { key: '7d', label: '최근 7일', range: () => [shift(-6), today()] },
  { key: 'month', label: '이번 달', range: () => [monthStart(), today()] },
  { key: 'period', label: '기간별', range: () => [oneMonthAgo(), today()] },
]
const DEFAULT_PRESET = 'period'

/**
 * 매출 통계 뷰(관리자·업체 공용). fetcher(from, to) 로 데이터를 가져와 요약·일별·결제수단·인기메뉴를 그린다.
 * 자체 `.stv-*` 스타일이라 두 콘솔 어디서든 동일하게 보인다.
 */
export default function StatsView({ fetcher, onError, onCancelPayment }) {
  const [tab, setTab] = useState('stats') // 'stats' | 'payments'
  const [busy, setBusy] = useState(false)
  const [confirmId, setConfirmId] = useState(null)
  const [preset, setPreset] = useState(DEFAULT_PRESET)
  const [range, setRange] = useState(() => PRESETS.find((p) => p.key === DEFAULT_PRESET).range())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const [from, to] = range
  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await fetcher(ymd(from), ymd(to))) }
    catch (e) { onError?.(e.message); setData(null) }
    finally { setLoading(false) }
  }, [fetcher, from, to, onError])
  useEffect(() => { load() }, [load])

  const doCancel = async (orderId) => {
    setBusy(true)
    try { await onCancelPayment(orderId); setConfirmId(null); await load() }
    catch (e) { onError?.(e.message) }
    finally { setBusy(false) }
  }

  const pickPreset = (p) => { setPreset(p.key); setRange(p.range()) }
  const setCustom = (which, val) => {
    if (!val) return
    const d = new Date(`${val}T00:00:00`)
    setPreset('period') // 날짜를 직접 고르면 '기간별' 로 유지
    setRange((r) => (which === 'from' ? [d, r[1]] : [r[0], d]))
  }

  const maxDaily = useMemo(() => Math.max(1, ...(data?.daily || []).map((d) => d.amount)), [data])
  const maxMenu = useMemo(() => Math.max(1, ...(data?.topMenus || []).map((m) => m.amount)), [data])

  return (
    <div className="stv">
      {/* 탭 — 매출 통계 / 결제 목록 */}
      <div className="stv-tabs">
        <button className={`stv-tab${tab === 'stats' ? ' on' : ''}`} onClick={() => setTab('stats')}>매출 통계</button>
        <button className={`stv-tab${tab === 'payments' ? ' on' : ''}`} onClick={() => setTab('payments')}>결제 목록</button>
      </div>

      {/* 기간 선택 (두 탭 공통) */}
      <div className="stv-range">
        <div className="stv-presets">
          {PRESETS.map((p) => (
            <button key={p.key} className={`stv-preset${preset === p.key ? ' on' : ''}`} onClick={() => pickPreset(p)}>{p.label}</button>
          ))}
        </div>
        <div className="stv-dates">
          <input type="date" value={ymd(from)} max={ymd(to)} onChange={(e) => setCustom('from', e.target.value)} />
          <span>~</span>
          <input type="date" value={ymd(to)} max={ymd(today())} onChange={(e) => setCustom('to', e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p className="stv-muted">불러오는 중…</p>
      ) : !data ? (
        <p className="stv-muted">데이터를 불러오지 못했습니다.</p>
      ) : tab === 'stats' ? (
        <>
          {/* 요약 카드 */}
          <div className="stv-cards">
            <div className="stv-card"><span className="stv-card-cap">총 매출</span><b className="stv-card-val">{won(data.totalRevenue)}</b></div>
            <div className="stv-card"><span className="stv-card-cap">결제 건수</span><b className="stv-card-val">{(data.orderCount ?? 0).toLocaleString()}건</b></div>
            <div className="stv-card"><span className="stv-card-cap">평균 객단가</span><b className="stv-card-val">{won(data.avgOrder)}</b></div>
          </div>

          {/* 일별 매출 막대 */}
          <div className="stv-sec">
            <div className="stv-sec-head">일별 매출</div>
            {data.totalRevenue === 0 ? (
              <p className="stv-muted">이 기간에 결제된 주문이 없습니다.</p>
            ) : (
              <div className="stv-bars" style={{ '--n': data.daily.length }}>
                {data.daily.map((d) => (
                  <div key={d.date} className="stv-bar-col" title={`${d.date} · ${won(d.amount)} · ${d.count}건`}>
                    <div className="stv-bar" style={{ height: `${(d.amount / maxDaily) * 100}%` }} />
                    <span className="stv-bar-x">{Number(d.date.slice(8, 10))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 결제수단별 + 인기 메뉴 */}
          <div className="stv-grid">
            <div className="stv-sec">
              <div className="stv-sec-head">결제수단별</div>
              {data.methods.length === 0 ? <p className="stv-muted">—</p> : (
                <div className="stv-list">
                  {data.methods.map((m) => (
                    <div key={m.method} className="stv-row">
                      <span className="stv-row-name">{m.label}</span>
                      <span className="stv-row-sub">{m.count}건</span>
                      <b className="stv-row-amt">{won(m.amount)}</b>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="stv-sec">
              <div className="stv-sec-head">인기 메뉴 TOP {data.topMenus.length}</div>
              {data.topMenus.length === 0 ? <p className="stv-muted">—</p> : (
                <div className="stv-list">
                  {data.topMenus.map((m, i) => (
                    <div key={m.menuName} className="stv-menu">
                      <span className="stv-menu-rank">{i + 1}</span>
                      <div className="stv-menu-main">
                        <div className="stv-menu-top"><span className="stv-menu-name">{m.menuName}</span><b className="stv-menu-amt">{won(m.amount)}</b></div>
                        <div className="stv-menu-track"><div className="stv-menu-fill" style={{ width: `${(m.amount / maxMenu) * 100}%` }} /></div>
                        <span className="stv-menu-qty">{m.quantity}개 판매</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        /* 결제 목록 탭 */
        <div className="stv-sec">
          <div className="stv-sec-head">결제 목록 {(data.payments || []).length}건 · 합계 {won(data.totalRevenue)}</div>
          {(data.payments || []).length === 0 ? (
            <p className="stv-muted">이 기간에 결제된 주문이 없습니다.</p>
          ) : (
            <div className="stv-paywrap">
              <table className="stv-table">
                <thead>
                  <tr>
                    <th>일시</th><th>주문번호</th><th>테이블</th><th>결제수단</th><th className="r">금액</th>
                    {onCancelPayment && <th className="r">결제취소</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.orderId}>
                      <td>{p.at}</td>
                      <td className="mono">{p.orderNo}</td>
                      <td>{p.table}</td>
                      <td>{p.method}</td>
                      <td className="r strong">{won(p.amount)}</td>
                      {onCancelPayment && (
                        <td className="r">
                          {confirmId === p.orderId ? (
                            <span className="stv-confirm">
                              <button className="stv-x-yes" disabled={busy} onClick={() => doCancel(p.orderId)}>취소 확정</button>
                              <button className="stv-x-no" disabled={busy} onClick={() => setConfirmId(null)}>닫기</button>
                            </span>
                          ) : (
                            <button className="stv-x" disabled={busy} onClick={() => setConfirmId(p.orderId)}>결제취소</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
