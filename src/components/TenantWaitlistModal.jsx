import { useCallback, useEffect, useState } from 'react'
import { tenantApi } from '../api/client'
import TablePickerBoard from './TablePickerBoard'

function hhmm(dt) { return dt ? dt.slice(11, 16) : '' }
function fmtReserved(dt) {
  if (!dt) return ''
  const [d, t] = dt.split('T')
  const [, mo, da] = d.split('-')
  return `${Number(mo)}/${Number(da)} ${(t || '').slice(0, 5)}`
}
const EMPTY = { occupiedTables: 0, totalTables: 0, allFull: false, reservationCount: 0, waitingCount: 0, reservations: [], waiting: [] }

/** 플랫폼 관리자 — 업체별 예약·대기 확인·수정(접수/호출/착석/취소). */
export default function TenantWaitlistModal({ tenant, onClose, onError }) {
  const tid = tenant.tenantId
  const [board, setBoard] = useState(null)
  const [type, setType] = useState('RESERVATION') // 추가 폼 유형
  const [form, setForm] = useState({ partyName: '', partySize: 2, phone: '', memo: '', reservedAt: '' })
  const [tableId, setTableId] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setBoard(await tenantApi.waitlist(tid)) }
    catch (e) { onError(e.message); setBoard(EMPTY) }
  }, [tid, onError])
  useEffect(() => { load() }, [load])

  async function run(fn) {
    setBusy(true)
    try { await fn(); await load() }
    catch (e) { onError(e.message) }
    finally { setBusy(false) }
  }
  const isRsv = type === 'RESERVATION'
  const add = () => {
    if (isRsv && !tableId) { onError('예약할 테이블을 선택하세요.'); return }
    if (isRsv && !form.reservedAt) { onError('예약 일시를 입력하세요.'); return }
    if (!form.phone.trim()) { onError('연락처를 입력하세요.'); return }
    run(async () => {
      await tenantApi.waitlistAdd(tid, {
        type,
        tableId: isRsv ? tableId : null,
        reservedAt: isRsv ? form.reservedAt : null,
        partyName: form.partyName, partySize: Number(form.partySize) || 1, phone: form.phone, memo: form.memo,
      })
      setForm({ partyName: '', partySize: 2, phone: '', memo: '', reservedAt: '' })
      setTableId(null)
    })
  }
  const call = (id) => run(() => tenantApi.waitlistStatus(tid, id, 'CALLED'))
  const seat = (id) => run(() => tenantApi.waitlistStatus(tid, id, 'SEATED'))
  const cancel = (id) => run(() => tenantApi.waitlistCancel(tid, id))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal staff-modal wl-rsv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="branch-head">
          <h3>예약·대기 관리</h3>
          <span className="branch-sub">{tenant.tenantName} ({tenant.tenantCode})</span>
          <button className="btn-ghost btn-sm menu-copy-btn" onClick={load}>새로고침</button>
        </div>

        {board === null ? (
          <p className="muted" style={{ padding: 30, textAlign: 'center' }}>불러오는 중…</p>
        ) : (
          <>
            <div className={`pwl-status${board.allFull ? ' full' : ''}`}>
              <span className="pwl-title">
                {board.totalTables === 0 ? '등록된 테이블 없음' : board.allFull ? '모든 테이블 사용 중' : `빈 테이블 ${board.totalTables - board.occupiedTables}개`}
              </span>
              <span className="pwl-sub">사용 중 {board.occupiedTables} / 전체 {board.totalTables} · 예약 {board.reservationCount}건 · 대기 {board.waitingCount}팀</span>
            </div>

            {/* 추가 폼 */}
            <div className="pwl-typetabs">
              <button className={`pwl-tab${isRsv ? ' on' : ''}`} onClick={() => setType('RESERVATION')}>예약</button>
              <button className={`pwl-tab${!isRsv ? ' on' : ''}`} onClick={() => setType('WAITING')}>대기표</button>
            </div>
            {isRsv && (
              <>
                <span className="wl-pick-label">테이블 선택 <b className="req">*</b></span>
                <TablePickerBoard
                  tables={board.tables || []}
                  floorCount={board.floorCount || 1}
                  canvasW={board.canvasW}
                  canvasH={board.canvasH}
                  value={tableId}
                  onChange={setTableId}
                />
              </>
            )}
            <div className="pwl-add">
              {isRsv && (
                <input type="datetime-local" title="예약 일시" value={form.reservedAt} onChange={(e) => setForm((f) => ({ ...f, reservedAt: e.target.value }))} />
              )}
              <input placeholder="이름(선택)" value={form.partyName} onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))} />
              <input type="number" min="1" max="99" title="인원" value={form.partySize} onChange={(e) => setForm((f) => ({ ...f, partySize: e.target.value }))} />
              <input placeholder="연락처(필수)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <button className="btn-primary btn-sm" onClick={add} disabled={busy}>{isRsv ? '＋ 예약' : '＋ 발급'}</button>
            </div>

            {/* 예약 목록 */}
            <div className="pwl-grouptitle">예약 {board.reservationCount}건</div>
            {board.reservations.length === 0 ? (
              <p className="muted" style={{ padding: '10px 4px' }}>예약이 없습니다.</p>
            ) : (
              <div className="pwl-list">
                {board.reservations.map((e) => (
                  <div key={e.id} className="pwl-item">
                    <span className="pwl-no pwl-no-rsv">{fmtReserved(e.reservedAt)}</span>
                    <div className="pwl-info">
                      <div className="pwl-name">{e.partyName || '손님'} · {e.partySize}명 {e.tableLabel && <span className="pwl-called" style={{ background: '#e7f0ff', color: '#1f5fbf' }}>{e.tableLabel}{e.floorNo ? ` ${e.floorNo}층` : ''}</span>}</div>
                      <div className="pwl-meta">{[e.phone, e.memo].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="pwl-btns">
                      <button className="btn-primary btn-sm" onClick={() => seat(e.id)} disabled={busy}>착석</button>
                      <button className="btn-ghost btn-sm pwl-x" onClick={() => cancel(e.id)} disabled={busy}>취소</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 대기표 목록 */}
            <div className="pwl-grouptitle">대기표 {board.waitingCount}팀</div>
            {board.waiting.length === 0 ? (
              <p className="muted" style={{ padding: '10px 4px' }}>대기 중인 손님이 없습니다.</p>
            ) : (
              <div className="pwl-list">
                {board.waiting.map((e) => (
                  <div key={e.id} className={`pwl-item${e.status === 'CALLED' ? ' called' : ''}`}>
                    <span className="pwl-no">{e.queueNo}</span>
                    <div className="pwl-info">
                      <div className="pwl-name">{e.partyName || '손님'} · {e.partySize}명 {e.status === 'CALLED' && <span className="pwl-called">호출됨</span>}</div>
                      <div className="pwl-meta">{[e.phone, `${hhmm(e.createdAt)} 접수`].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div className="pwl-btns">
                      {e.status === 'WAITING' && <button className="btn-ghost btn-sm" onClick={() => call(e.id)} disabled={busy}>호출</button>}
                      <button className="btn-primary btn-sm" onClick={() => seat(e.id)} disabled={busy}>착석</button>
                      <button className="btn-ghost btn-sm pwl-x" onClick={() => cancel(e.id)} disabled={busy}>취소</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
