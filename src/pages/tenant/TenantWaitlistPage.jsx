import { useCallback, useEffect, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import { tenantWaitlistApi } from '../../api/tenantClient'

const tlabel = (t) => t.label || (t.kind === 'ROOM' ? '룸' : '테이블')
function hhmm(dt) { return dt ? dt.slice(11, 16) : '' }
function fmtReserved(dt) {
  if (!dt) return ''
  const [d, t] = dt.split('T')
  const [, mo, da] = d.split('-')
  return `${Number(mo)}/${Number(da)} ${(t || '').slice(0, 5)}`
}

/** 예약·대기 관리 — 예약 접수 + 만석 시 워킹 손님 대기표 발급(연락처 필수). */
export default function TenantWaitlistPage() {
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(null) // 'RESERVATION' | 'WAITING' | null

  const load = useCallback(async () => {
    try { setBoard(await tenantWaitlistApi.board()) }
    catch (e) { setError(e.message); setBoard({ occupiedTables: 0, totalTables: 0, allFull: false, reservationCount: 0, waitingCount: 0, reservations: [], waiting: [] }) }
  }, [])
  useEffect(() => { load() }, [load])
  // 테이블 점유는 계속 바뀌므로 주기적으로 새로고침.
  useEffect(() => { const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])

  async function run(fn) { try { await fn(); await load() } catch (e) { setError(e.message) } }
  const call = (id) => run(() => tenantWaitlistApi.changeStatus(id, 'CALLED'))
  const seat = (id) => run(() => tenantWaitlistApi.changeStatus(id, 'SEATED'))
  const cancel = (id) => run(() => tenantWaitlistApi.cancel(id))

  const empty = board && board.totalTables === 0
  const free = board ? board.totalTables - board.occupiedTables : 0

  return (
    <TenantShell>
      <div className="m-topline">
        <div className="m-page-head">
          <h1>예약·대기 관리</h1>
          <p>미리 오는 손님은 예약으로 접수하고, 테이블이 꽉 차면 워킹 손님에게 대기표를 발급하세요.</p>
        </div>
      </div>

      {board === null ? (
        <Loading label="예약·대기 현황을 불러오는 중…" />
      ) : (
        <>
          {/* 테이블 점유 현황 */}
          <div className={`m-card wl-status${board.allFull ? ' full' : ''}`}>
            <div className="wl-status-main">
              <span className="wl-status-ic"><Icon name={board.allFull ? 'event_busy' : 'event_available'} /></span>
              <div>
                <div className="wl-status-title">
                  {empty ? '등록된 테이블이 없습니다' : board.allFull ? '모든 테이블 사용 중' : `빈 테이블 ${free}개`}
                </div>
                <div className="wl-status-sub">
                  사용 중 {board.occupiedTables} / 전체 {board.totalTables}
                  <span className="wl-dot">·</span> 예약 {board.reservationCount}건
                  <span className="wl-dot">·</span> 대기 {board.waitingCount}팀
                </div>
              </div>
            </div>
            {board.allFull && <span className="wl-badge">만석 — 대기표 발급</span>}
          </div>

          {/* 예약 */}
          <section className="wl-section">
            <div className="wl-section-head">
              <h2><Icon name="event" /> 예약</h2>
              <button className="m-btn m-btn-primary" onClick={() => setAdding('RESERVATION')}>
                <Icon name="add" /> 예약 추가
              </button>
            </div>
            {board.reservations.length === 0 ? (
              <div className="m-card m-empty"><Icon name="event_note" /><p>등록된 예약이 없습니다. “예약 추가”로 접수하세요.</p></div>
            ) : (
              <div className="wl-grid">
                {board.reservations.map((e) => (
                  <div key={e.id} className="m-card wl-card wl-card-rsv">
                    <div className="wl-rsv-time">
                      <Icon name="schedule" />
                      <span>{fmtReserved(e.reservedAt)}</span>
                    </div>
                    <div className="wl-info">
                      <div className="wl-name">
                        {e.partyName || '손님'}
                        <span className="wl-size"><Icon name="group" />{e.partySize}명</span>
                      </div>
                      {e.tableLabel && <div className="wl-sub"><Icon name="table_restaurant" />{e.tableLabel}{e.floorNo ? ` · ${e.floorNo}층` : ''}</div>}
                      <div className="wl-sub"><Icon name="call" />{e.phone}</div>
                      {e.memo && <div className="wl-sub wl-memo"><Icon name="sticky_note_2" />{e.memo}</div>}
                    </div>
                    <div className="wl-actions">
                      <button className="btn-primary btn-sm" onClick={() => seat(e.id)}><Icon name="check" /> 착석</button>
                      <button className="btn-danger btn-sm" onClick={() => cancel(e.id)}>취소</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 대기표 */}
          <section className="wl-section">
            <div className="wl-section-head">
              <h2><Icon name="confirmation_number" /> 대기표</h2>
              <button className={`m-btn ${board.allFull ? 'm-btn-primary' : 'm-btn-ghost'}`} onClick={() => setAdding('WAITING')}>
                <Icon name="add" /> 대기표 발급
              </button>
            </div>
            {board.waiting.length === 0 ? (
              <div className="m-card m-empty"><Icon name="hourglass_empty" /><p>대기 중인 손님이 없습니다. 만석일 때 “대기표 발급”으로 접수하세요.</p></div>
            ) : (
              <div className="wl-grid">
                {board.waiting.map((e) => (
                  <div key={e.id} className={`m-card wl-card${e.status === 'CALLED' ? ' called' : ''}`}>
                    <div className="wl-no">{e.queueNo}</div>
                    <div className="wl-info">
                      <div className="wl-name">
                        {e.partyName || '손님'}
                        <span className="wl-size"><Icon name="group" />{e.partySize}명</span>
                        {e.status === 'CALLED' && <span className="wl-called">호출됨</span>}
                      </div>
                      <div className="wl-sub"><Icon name="call" />{e.phone}</div>
                      {e.memo && <div className="wl-sub wl-memo"><Icon name="sticky_note_2" />{e.memo}</div>}
                      <div className="wl-sub wl-time"><Icon name="schedule" />{hhmm(e.createdAt)} 접수</div>
                    </div>
                    <div className="wl-actions">
                      {e.status === 'WAITING' && <button className="btn-ghost btn-sm" onClick={() => call(e.id)}><Icon name="campaign" /> 호출</button>}
                      <button className="btn-primary btn-sm" onClick={() => seat(e.id)}><Icon name="check" /> 착석</button>
                      <button className="btn-danger btn-sm" onClick={() => cancel(e.id)}>취소</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {adding && <AddDialog type={adding} board={board} onClose={() => setAdding(null)} onSaved={async () => { setAdding(null); await load() }} onError={setError} />}
      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}

// 예약/대기 접수 다이얼로그 — 유형에 따라 다른 화면을 띄운다.
function AddDialog({ type, board, onClose, onSaved, onError }) {
  return type === 'RESERVATION'
    ? <ReservationDialog board={board} onClose={onClose} onSaved={onSaved} onError={onError} />
    : <WaitingDialog onClose={onClose} onSaved={onSaved} onError={onError} />
}

// 예약 추가 — 층 선택 + 테이블 카드(인석·상태) + 예약 일자/시간 + 예약자 이름.
function ReservationDialog({ board, onClose, onSaved, onError }) {
  const floorCount = board?.floorCount || 1
  const tables = board?.tables || []
  const [floor, setFloor] = useState(1)
  const [tableId, setTableId] = useState(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partyName, setPartyName] = useState('')
  const [busy, setBusy] = useState(false)

  const onFloor = tables.filter((t) => t.floorNo === floor)
  const availableCount = onFloor.filter((t) => !t.occupied).length
  const picked = tables.find((t) => t.tableId === tableId)

  async function submit() {
    if (!tableId) { onError('예약할 테이블을 선택하세요.'); return }
    if (!date || !time) { onError('예약 일자와 시간을 입력하세요.'); return }
    setBusy(true)
    try {
      await tenantWaitlistApi.add({
        type: 'RESERVATION', tableId, reservedAt: `${date}T${time}`,
        partyName, partySize: picked?.seats || 2, phone: '', memo: '',
      })
      await onSaved()
    } catch (e) { onError(e.message); setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wl-rsv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wl-rsv-head">
          <div className="wl-rsv-head-txt">
            <h3>예약 추가</h3>
            <p>테이블을 선택하고 예약 정보를 입력하세요.</p>
          </div>
          <button type="button" className="wl-rsv-x" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
        </div>

        <div className="wl-rsv-body">
          {floorCount > 1 && (
            <div className="wl-rsv-field">
              <span className="wl-rsv-flabel">층 선택</span>
              <div className="wl-rsv-select">
                <select value={floor} onChange={(e) => { setFloor(Number(e.target.value)); setTableId(null) }}>
                  {Array.from({ length: floorCount }, (_, i) => i + 1).map((f) => <option key={f} value={f}>{f}층</option>)}
                </select>
                <Icon name="expand_more" className="wl-rsv-caret" />
              </div>
            </div>
          )}

          <div className="wl-rsv-thead">
            <span className="wl-rsv-flabel">테이블 선택 <b className="req">*</b></span>
            <span className="wl-rsv-avail">예약 가능한 테이블 {availableCount}개</span>
          </div>
          {onFloor.length === 0 ? (
            <div className="wl-rsv-empty">이 층에 테이블이 없습니다.</div>
          ) : (
            <div className="wl-rsv-grid">
              {onFloor.map((t) => {
                const sel = tableId === t.tableId
                return (
                  <button type="button" key={t.tableId}
                    className={`wl-rsv-card${sel ? ' sel' : ''}`}
                    onClick={() => setTableId(t.tableId)}>
                    <span className="wl-rsv-tname">{tlabel(t)}</span>
                    <span className="wl-rsv-seats">{t.seats}인석</span>
                    <span className={`wl-rsv-pill${sel ? ' sel' : t.occupied ? ' occ' : ''}`}>
                      {sel ? '선택됨' : t.occupied ? '사용중' : '이용가능'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="wl-rsv-row">
            <div className="wl-rsv-field">
              <span className="wl-rsv-flabel"><Icon name="calendar_today" /> 예약 일자 <b className="req">*</b></span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="wl-rsv-field">
              <span className="wl-rsv-flabel"><Icon name="schedule" /> 예약 시간 <b className="req">*</b></span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="wl-rsv-field">
            <span className="wl-rsv-flabel">예약자 이름 (선택)</span>
            <input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="예: 홍길동" maxLength={40} />
          </div>
        </div>

        <div className="wl-rsv-foot">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button type="button" className="btn-primary wl-rsv-submit" onClick={submit} disabled={busy}>
            <Icon name="check_circle" filled /> {busy ? '처리 중…' : '예약 접수'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 대기표 발급 — 이름·인원·연락처(필수)·메모.
function WaitingDialog({ onClose, onSaved, onError }) {
  const [form, setForm] = useState({ partyName: '', partySize: 2, phone: '', memo: '' })
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (!form.phone.trim()) { onError('연락처를 입력하세요.'); return }
    setBusy(true)
    try {
      await tenantWaitlistApi.add({
        type: 'WAITING', tableId: null, reservedAt: null,
        partyName: form.partyName, partySize: Number(form.partySize) || 1, phone: form.phone, memo: form.memo,
      })
      await onSaved()
    } catch (e) { onError(e.message); setBusy(false) }
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>대기표 발급</h3>
        <p className="hint" style={{ marginTop: 0 }}>순번은 자동으로 매겨집니다. 연락처는 필수입니다.</p>
        <label className="field"><span>이름 (선택)</span>
          <input value={form.partyName} onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))} placeholder="예: 홍길동" autoFocus />
        </label>
        <div className="field-row">
          <label className="field"><span>인원</span>
            <input type="number" min="1" max="99" value={form.partySize} onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value }))} />
          </label>
          <label className="field"><span>연락처 <b className="req">*</b></span>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" />
          </label>
        </div>
        <label className="field"><span>메모 (선택)</span>
          <input value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} placeholder="예: 유아 의자 필요" />
        </label>
        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? '처리 중…' : '순번 발급'}</button>
        </div>
      </div>
    </div>
  )
}
