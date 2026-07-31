import { useEffect, useState } from 'react'

function tlabel(t) { return t.label || (t.kind === 'ROOM' ? '룸' : '테이블') }

/**
 * 예약 테이블 선택용 배치도. board.tables(TableSlot[]) 를 층별로 그리고, 클릭하면 선택된다.
 * 예약은 미래 시점이므로 지금 사용 중(occupied)인 테이블도 고를 수 있다(경고 표시만).
 * value = 선택된 tableId, onChange(tableId) 로 알린다. 사장님/관리자 양쪽에서 재사용.
 */
export default function TablePickerBoard({ tables = [], floorCount = 1, canvasW = 760, canvasH = 460, value, onChange }) {
  const fc = Math.max(1, floorCount || 1)
  const [floor, setFloor] = useState(1)

  // 선택된 테이블이 있는 층으로 자동 이동.
  useEffect(() => {
    const sel = tables.find((t) => t.tableId === value)
    if (sel && sel.floorNo !== floor) setFloor(sel.floorNo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const cw = canvasW || 760
  const ch = canvasH || 460
  const onFloor = tables.filter((t) => t.floorNo === floor)

  return (
    <div className="tpk">
      {fc > 1 && (
        <div className="tpk-floors">
          {Array.from({ length: fc }, (_, i) => i + 1).map((f) => (
            <button type="button" key={f} className={`tpk-floor${floor === f ? ' on' : ''}`} onClick={() => setFloor(f)}>{f}층</button>
          ))}
        </div>
      )}
      <div className="tpk-wrap">
        <div className="tpk-canvas" style={{ width: cw, height: ch }}>
          {onFloor.map((t) => {
            const sel = value === t.tableId
            return (
              <button
                type="button"
                key={t.tableId}
                className={`tpk-table${t.kind === 'ROOM' ? ' room' : ''}${t.occupied ? ' occupied' : ''}${sel ? ' sel' : ''}`}
                style={{ left: t.x, top: t.y, width: t.width, height: t.height }}
                onClick={() => onChange(t.tableId)}
                title={tlabel(t)}
              >
                <span className="tpk-name">{tlabel(t)}</span>
                <span className="tpk-sub">{t.seats}석{t.occupied ? ' · 사용중' : ''}</span>
                {t.reservedCount > 0 && <span className="tpk-badge">예약 {t.reservedCount}</span>}
              </button>
            )
          })}
          {onFloor.length === 0 && <div className="tpk-empty">이 층에 테이블이 없습니다.</div>}
        </div>
      </div>
    </div>
  )
}
