import { useCallback, useEffect, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import { tenantWaitlistApi } from '../../api/tenantClient'

const tlabel = (t) => t.label || (t.kind === 'ROOM' ? '룸' : '테이블')
function hhmm(dt) { return dt ? dt.slice(11, 16) : '' }
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
// 예약 날짜 — "8월 3일 (일)". 요일은 로컬 기준으로 계산.
function resDate(dt) {
  if (!dt) return ''
  const [y, mo, da] = dt.slice(0, 10).split('-').map(Number)
  if (!y || !mo || !da) return ''
  const wd = WEEKDAYS[new Date(y, mo - 1, da).getDay()]
  return `${mo}월 ${da}일 (${wd})`
}
// 오늘 날짜(YYYY-MM-DD, 로컬) — date input 의 min·과거 검증에 쓴다.
function todayStr() {
  const d = new Date(); const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
// 예약 시간은 오전/오후 + 12시간 + 분(00/30) 세 개를 조합해서 고른다(긴 목록 대신 짧게).
const HOURS12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
// 24시간 "HH:mm" ↔ (오전/오후, 12시간, 분)
function splitTime(t) {
  if (!t) return { ampm: '오전', hour12: '', minute: '00' }
  const h24 = Number(t.slice(0, 2))
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return { ampm: h24 < 12 ? '오전' : '오후', hour12: String(h12), minute: t.slice(3, 5) === '30' ? '30' : '00' }
}
function combineTime(ampm, hour12, minute) {
  if (!hour12) return ''
  let h = Number(hour12) % 12 // 12시 → 0
  if (ampm === '오후') h += 12
  return `${String(h).padStart(2, '0')}:${minute}`
}
// 대기표 목록에선 개인정보 보호를 위해 가운데 번호를 가린다. 010-8812-1234 → 010-88**-1234
function maskPhone(p) {
  if (!p) return ''
  const parts = p.split('-')
  if (parts.length === 3 && parts[1].length >= 2) {
    return `${parts[0]}-${parts[1].slice(0, 2)}${'*'.repeat(Math.max(2, parts[1].length - 2))}-${parts[2]}`
  }
  return p
}
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
  const [editRsv, setEditRsv] = useState(null) // 수정할 예약 항목
  const [contactFor, setContactFor] = useState(null) // 전화/문자 선택 대상 번호

  const load = useCallback(async () => {
    try { setBoard(await tenantWaitlistApi.board()) }
    catch (e) { setError(e.message); setBoard({ occupiedTables: 0, totalTables: 0, allFull: false, reservationCount: 0, waitingCount: 0, reservations: [], waiting: [] }) }
  }, [])
  useEffect(() => { load() }, [load])
  // 테이블 점유는 계속 바뀌므로 주기적으로 새로고침.
  useEffect(() => { const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])

  async function run(fn) { try { await fn(); await load() } catch (e) { setError(e.message) } }
  const seat = (id) => run(() => tenantWaitlistApi.changeStatus(id, 'SEATED'))
  const cancel = (id) => run(() => tenantWaitlistApi.cancel(id))

  const empty = board && board.totalTables === 0
  const free = board ? board.totalTables - board.occupiedTables : 0

  return (
    <TenantShell>
      <div className="m-topline">
        <div className="m-page-head">
          <span className="m-eyebrow"><Icon name="event_available" /> RESERVATIONS</span>
          <h1>예약·대기 관리</h1>
          <p>미리 오는 손님은 예약으로 접수하고, 테이블이 꽉 차면 워킹 손님에게 대기표를 발급하세요.</p>
        </div>
      </div>

      {board === null ? (
        <Loading label="예약·대기 현황을 불러오는 중…" />
      ) : (
        <>
          {/* 통계 4장 */}
          <div className="wl-stats">
            <div className="wl-stat">
              <span className="wl-stat-ic free"><Icon name="table_restaurant" /></span>
              <div className="wl-stat-txt"><span className="wl-stat-label">빈 테이블</span><b className="wl-stat-num">{Math.max(0, free)}</b></div>
            </div>
            <div className="wl-stat">
              <span className="wl-stat-ic use"><Icon name="person" /></span>
              <div className="wl-stat-txt"><span className="wl-stat-label">사용 중</span><b className="wl-stat-num">{board.occupiedTables}</b></div>
            </div>
            <div className="wl-stat">
              <span className="wl-stat-ic rsv"><Icon name="event" /></span>
              <div className="wl-stat-txt"><span className="wl-stat-label">예약 건수</span><b className="wl-stat-num">{board.reservationCount}</b></div>
            </div>
            <div className="wl-stat">
              <span className="wl-stat-ic wait"><Icon name="schedule" /></span>
              <div className="wl-stat-txt"><span className="wl-stat-label">대기 팀</span><b className="wl-stat-num">{board.waitingCount}</b></div>
            </div>
          </div>

          {/* 예약 */}
          <section className="wl-section">
            <div className="wl-shead">
              <h2><Icon name="event_available" /> 예약</h2>
              <button className="m-btn m-btn-primary btn-sm" onClick={() => setAdding('RESERVATION')}>
                <Icon name="add" /> 예약 추가
              </button>
            </div>
            {board.reservations.length === 0 ? (
              <div className="m-card m-empty"><Icon name="event_note" /><p>등록된 예약이 없습니다. “예약 추가”로 접수하세요.</p></div>
            ) : (
              <div className="wl-grid">
                {board.reservations.map((e) => (
                  <div key={e.id} className="wl-rcard">
                    <div className="wl-rcard-top">
                      <span className="wl-rcard-badge">예약중</span>
                      <span className="wl-rcard-date"><Icon name="event" />{resDate(e.reservedAt)}</span>
                    </div>
                    <div className="wl-rcard-timerow">
                      <div className="wl-rcard-bigtime"><Icon name="schedule" filled />{hhmm(e.reservedAt)}</div>
                      <button className="wl-btn-edit wl-edit-inline" onClick={() => setEditRsv(e)}><Icon name="edit" />수정</button>
                    </div>
                    <div className="wl-rcard-nameline">
                      <span className="wl-rcard-name">{e.partyName || '손님'}</span>
                      {e.phone && (
                        <button type="button" className="wl-rcard-phone" onClick={() => setContactFor(e.phone)}>
                          <Icon name="call" />{maskPhone(e.phone)}
                        </button>
                      )}
                    </div>
                    <div className="wl-rcard-meta">
                      {[[e.floorNo ? `${e.floorNo}층` : null, e.tableLabel].filter(Boolean).join(' '), `${e.partySize}명`].filter(Boolean).join(' · ')}
                    </div>
                    <div className="wl-cbtns">
                      <button className="wl-btn-seat" onClick={() => seat(e.id)}><Icon name="chair" />착석</button>
                      <button className="wl-btn-cancel" onClick={() => cancel(e.id)}>취소</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 대기표 */}
          <section className="wl-section">
            <div className="wl-shead">
              <h2><Icon name="confirmation_number" /> 대기표</h2>
              <button className={`m-btn ${board.allFull ? 'm-btn-primary' : 'm-btn-outline2'} btn-sm`} onClick={() => setAdding('WAITING')}>
                <Icon name="receipt_long" /> 대기표 발급
              </button>
            </div>
            {board.waiting.length === 0 ? (
              <div className="m-card m-empty"><Icon name="hourglass_empty" /><p>대기 중인 손님이 없습니다. 만석일 때 “대기표 발급”으로 접수하세요.</p></div>
            ) : (
              <div className="wl-grid">
                {board.waiting.map((e) => (
                  <div key={e.id} className={`wl-wcard${e.status === 'CALLED' ? ' called' : ''}`}>
                    <div className="wl-wcard-top">
                      <span className="wl-wcard-no">{e.queueNo}</span>
                      <div className="wl-wcard-id">
                        <div className="wl-wcard-name">{e.partyName || '손님'}{e.status === 'CALLED' && <span className="wl-called">호출됨</span>}</div>
                        {e.phone && <div className="wl-wcard-phone">{maskPhone(e.phone)}</div>}
                      </div>
                    </div>
                    <div className="wl-wcard-meta">
                      <span><Icon name="group" />{e.partySize}명</span>
                      <span><Icon name="schedule" />{hhmm(e.createdAt)} 접수</span>
                    </div>
                    {e.phone && (
                      <button className="wl-btn-call" onClick={() => setContactFor(e.phone)}><Icon name="campaign" /> 호출하기</button>
                    )}
                    <div className="wl-cbtns">
                      <button className="wl-btn-seat" onClick={() => seat(e.id)}>착석</button>
                      <button className="wl-btn-cancel" onClick={() => cancel(e.id)}>취소</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {adding && <AddDialog type={adding} board={board} onClose={() => setAdding(null)} onSaved={async () => { setAdding(null); await load() }} onError={setError} />}
      {editRsv && <ReservationDialog board={board} entry={editRsv} onClose={() => setEditRsv(null)} onSaved={async () => { setEditRsv(null); await load() }} onError={setError} />}
      {contactFor && <ContactSheet phone={contactFor} onClose={() => setContactFor(null)} />}
      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}

// 연락처 클릭 시 — 전화 걸기 / 문자 보내기 선택.
function ContactSheet({ phone, onClose }) {
  const tel = String(phone).replace(/[^0-9+]/g, '')
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="contact-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="contact-sheet-head">
          <span className="contact-sheet-num"><Icon name="call" />{phone}</span>
        </div>
        <a className="contact-opt call" href={`tel:${tel}`} onClick={onClose}>
          <Icon name="call" filled /> 전화 걸기
        </a>
        <a className="contact-opt sms" href={`sms:${tel}`} onClick={onClose}>
          <Icon name="chat" filled /> 문자 보내기
        </a>
        <button type="button" className="contact-opt cancel" onClick={onClose}>취소</button>
      </div>
    </div>
  )
}

// 예약/대기 접수 다이얼로그 — 유형에 따라 다른 화면을 띄운다.
function AddDialog({ type, board, onClose, onSaved, onError }) {
  return type === 'RESERVATION'
    ? <ReservationDialog board={board} onClose={onClose} onSaved={onSaved} onError={onError} />
    : <WaitingDialog onClose={onClose} onSaved={onSaved} onError={onError} />
}

// 예약 추가/수정 — 예약 일자/시간(30분 단위) + 예약자 이름·연락처 + 테이블 카드(인석·상태).
function ReservationDialog({ board, entry, onClose, onSaved, onError }) {
  const editing = !!entry
  const floorCount = board?.floorCount || 1
  const tables = board?.tables || []
  const [floor, setFloor] = useState(entry?.floorNo || 1)
  const [tableId, setTableId] = useState(entry?.tableId ?? null)
  const [date, setDate] = useState(entry?.reservedAt ? entry.reservedAt.slice(0, 10) : '')
  const initT = splitTime(entry?.reservedAt ? entry.reservedAt.slice(11, 16) : '')
  const [ampm, setAmpm] = useState(initT.ampm)
  const [hour12, setHour12] = useState(initT.hour12)
  const [minute, setMinute] = useState(initT.minute)
  const time = combineTime(ampm, hour12, minute)
  const [partyName, setPartyName] = useState(entry?.partyName || '')
  const [phone, setPhone] = useState(entry?.phone || '')
  const [busy, setBusy] = useState(false)

  const onFloor = tables.filter((t) => t.floorNo === floor)
  const availableCount = onFloor.filter((t) => !t.occupied).length
  const picked = tables.find((t) => t.tableId === tableId)

  const today = todayStr()

  async function submit() {
    if (!tableId) { onError('예약할 테이블을 선택하세요.'); return }
    if (!date || !time) { onError('예약 일자와 시간을 입력하세요.'); return }
    // 날짜+시간을 합쳐 현재 시각보다 이전이면 막는다(오늘이라도 지난 시간은 불가).
    const when = new Date(`${date}T${time}`)
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      onError('현재 시간보다 이전으로는 예약할 수 없습니다.'); return
    }
    if (!phone.trim()) { onError('연락처를 입력하세요.'); return }
    setBusy(true)
    try {
      const partySize = picked?.seats || entry?.partySize || 2
      if (editing) {
        await tenantWaitlistApi.update(entry.id, {
          tableId, reservedAt: `${date}T${time}`, partyName, partySize, phone: phone.trim(),
        })
      } else {
        await tenantWaitlistApi.add({
          type: 'RESERVATION', tableId, reservedAt: `${date}T${time}`,
          partyName, partySize, phone: phone.trim(), memo: '',
        })
      }
      await onSaved()
    } catch (e) { onError(e.message); setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wl-rsv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wl-rsv-head">
          <div className="wl-rsv-head-txt">
            <h3>{editing ? '예약 수정' : '예약 추가'}</h3>
            <p>예약 정보를 입력하고 테이블을 선택하세요.</p>
          </div>
          <button type="button" className="wl-rsv-x" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
        </div>

        <div className="wl-rsv-body">
          <div className="wl-rsv-field">
            <span className="wl-rsv-flabel"><Icon name="calendar_today" /> 예약 일자 <b className="req">*</b></span>
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="wl-rsv-field">
            <span className="wl-rsv-flabel"><Icon name="schedule" /> 예약 시간 <b className="req">*</b></span>
            <div className="wl-time-3">
              <div className="wl-rsv-select">
                <select value={ampm} onChange={(e) => setAmpm(e.target.value)} aria-label="오전/오후">
                  <option value="오전">오전</option>
                  <option value="오후">오후</option>
                </select>
                <Icon name="expand_more" className="wl-rsv-caret" />
              </div>
              <div className="wl-rsv-select">
                <select value={hour12} onChange={(e) => setHour12(e.target.value)} aria-label="시">
                  <option value="" disabled>시</option>
                  {HOURS12.map((h) => <option key={h} value={h}>{h}시</option>)}
                </select>
                <Icon name="expand_more" className="wl-rsv-caret" />
              </div>
              <div className="wl-rsv-select">
                <select value={minute} onChange={(e) => setMinute(e.target.value)} aria-label="분">
                  <option value="00">00분</option>
                  <option value="30">30분</option>
                </select>
                <Icon name="expand_more" className="wl-rsv-caret" />
              </div>
            </div>
          </div>

          <div className="wl-rsv-row">
            <div className="wl-rsv-field">
              <span className="wl-rsv-flabel">예약자 이름 (선택)</span>
              <input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="예: 홍길동" maxLength={40} />
            </div>
            <div className="wl-rsv-field">
              <span className="wl-rsv-flabel"><Icon name="call" /> 연락처 <b className="req">*</b></span>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" maxLength={20} />
            </div>
          </div>

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
        </div>

        <div className="wl-rsv-foot">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button type="button" className="btn-primary wl-rsv-submit" onClick={submit} disabled={busy}>
            <Icon name="check_circle" filled /> {busy ? '처리 중…' : (editing ? '예약 수정' : '예약 접수')}
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
