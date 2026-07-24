import { useCallback, useEffect, useMemo, useState } from 'react'
import Toast from '../components/Toast'
import { calendarApi } from '../api/client'
import Shell from '../components/Shell'

const SCOPE_LABEL = { ALL: '전사', TEAM: '팀별', PERSONAL: '개인' }
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const DEFAULT_COLORS = { ALL: '#2f6feb', TEAM: '#1a9e6b', PERSONAL: '#8a5cf6' }
const COLOR_STORE = 'saas.calColors'
const VIEWS = [{ key: 'month', label: '월간' }, { key: 'week', label: '주간' }, { key: 'day', label: '일간' }]
const MONTH_MAX = 3 // 월간 셀에 보여줄 최대 일정 수. 넘치면 더보기.

function loadColors() {
  try {
    return { ...DEFAULT_COLORS, ...JSON.parse(localStorage.getItem(COLOR_STORE) || '{}') }
  } catch {
    return { ...DEFAULT_COLORS }
  }
}

function ymd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d, n) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function startOfWeek(d) {
  const s = new Date(d)
  s.setDate(s.getDate() - s.getDay()) // 일요일로
  s.setHours(0, 0, 0, 0)
  return s
}

export default function CalendarPage() {
  const today = useMemo(() => new Date(), [])
  const [anchor, setAnchor] = useState(() => new Date()) // 기준일 (뷰의 중심)
  const [view, setView] = useState('month') // month | week | day
  const [events, setEvents] = useState([])
  const [holidays, setHolidays] = useState({}) // { 'YYYY-MM-DD': '공휴일명' }
  const [perms, setPerms] = useState(new Set())
  const [filter, setFilter] = useState('ALL_SCOPES') // 'ALL_SCOPES' | 'ALL' | 'TEAM' | 'PERSONAL'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState(null) // { mode, event, preset }
  const [colors, setColors] = useState(loadColors)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [drag, setDrag] = useState(null) // 월간 날짜 드래그 { start, end }
  const [dayModal, setDayModal] = useState(null) // 더보기: 그날 전체 일정 팝오버 (YYYY-MM-DD)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // 기준일 전월·현재·익월을 모아 받는다(주가 월 경계를 걸쳐도 커버). 실패해도 달력은 뜬다.
      const y = anchor.getFullYear(), m = anchor.getMonth() + 1
      const around = [
        m === 1 ? [y - 1, 12] : [y, m - 1],
        [y, m],
        m === 12 ? [y + 1, 1] : [y, m + 1],
      ]
      const [myPerms, evsArr, hsArr] = await Promise.all([
        calendarApi.myPerms(),
        Promise.all(around.map(([yy, mm]) => calendarApi.events(yy, mm).catch(() => []))),
        Promise.all(around.map(([yy, mm]) => calendarApi.holidays(yy, mm).catch(() => []))),
      ])
      const seen = new Set(); const evs = []
      evsArr.flat().forEach((e) => { if (!seen.has(e.id)) { seen.add(e.id); evs.push(e) } })
      setEvents(evs)
      setPerms(new Set(myPerms ?? []))
      const map = {}; hsArr.flat().forEach((h) => { map[h.date] = h.name }); setHolidays(map)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [anchor])

  useEffect(() => { load() }, [load])

  const viewable = ['ALL', 'TEAM', 'PERSONAL'].filter((s) => perms.has(`${s}_VIEW`))
  const writable = ['ALL', 'TEAM', 'PERSONAL'].filter((s) => perms.has(`${s}_WRITE`))
  const canDrag = writable.length > 0 && view === 'month'

  const shown = events
    .filter((e) => filter === 'ALL_SCOPES' || e.scope === filter)
    .slice()
    .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : a.id - b.id))

  const eventsOn = (d) => {
    const s = ymd(d)
    return shown.filter((e) => e.startDate <= s && s <= e.endDate)
  }

  useEffect(() => {
    if (!drag) return
    function up() {
      const s = drag.start <= drag.end ? drag.start : drag.end
      const e = drag.start <= drag.end ? drag.end : drag.start
      setDrag(null)
      setDialog({ mode: 'create', preset: { startDate: s, endDate: e } })
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [drag])

  const inDragRange = (dateStr) => {
    if (!drag) return false
    const lo = drag.start <= drag.end ? drag.start : drag.end
    const hi = drag.start <= drag.end ? drag.end : drag.start
    return lo <= dateStr && dateStr <= hi
  }

  function saveColors(next) {
    setColors(next)
    localStorage.setItem(COLOR_STORE, JSON.stringify(next))
  }

  function move(delta) {
    const d = new Date(anchor)
    if (view === 'month') d.setMonth(d.getMonth() + delta)
    else if (view === 'week') d.setDate(d.getDate() + 7 * delta)
    else d.setDate(d.getDate() + delta)
    setAnchor(d)
  }
  function goToday() { setAnchor(new Date()) }

  const todayStr = ymd(today)
  const aYear = anchor.getFullYear(), aMonth = anchor.getMonth() + 1

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))

  const monthFirst = new Date(aYear, aMonth - 1, 1)
  const gridStart = addDays(monthFirst, -monthFirst.getDay())
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  const title =
    view === 'month' ? `${aYear}년 ${aMonth}월`
      : view === 'week' ? `${weekDays[0].getMonth() + 1}월 ${weekDays[0].getDate()}일 ~ ${weekDays[6].getMonth() + 1}월 ${weekDays[6].getDate()}일`
        : `${aYear}년 ${aMonth}월 ${anchor.getDate()}일 (${WEEKDAYS[anchor.getDay()]})`

  return (
    <Shell>
      <div className="page-head">
        <h2>달력</h2>
      </div>

      <Toast message={error} onClose={() => setError('')} />

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="btn-ghost" onClick={() => move(-1)} aria-label="이전">◀</button>
          <strong className="cal-title">{title}</strong>
          <button className="btn-ghost" onClick={() => move(1)} aria-label="다음">▶</button>
          <button className="btn-ghost btn-sm" onClick={goToday}>오늘</button>
        </div>

        <div className="cal-filters">
          {/* 월간/주간/일간 뷰 전환 */}
          <div className="perm-tabs">
            {VIEWS.map((v) => (
              <button key={v.key} className={view === v.key ? 'on' : ''} onClick={() => setView(v.key)}>{v.label}</button>
            ))}
          </div>
          {/* 범위 필터. '전체'=모든 범위, '전사/팀별/개인'=그 범위만. */}
          <select className="dept-select cal-filter-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL_SCOPES">전체</option>
            {viewable.map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}</option>)}
          </select>
          {writable.length > 0 && (
            <button className="btn-primary btn-sm" onClick={() => setDialog({ mode: 'create' })}>+ 일정</button>
          )}
          <button className="btn-ghost cal-gear" title="색상 설정" onClick={() => setSettingsOpen(true)}>⚙</button>
        </div>
      </div>

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : view === 'month' ? (
        <div className="cal-grid">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`cal-weekday${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{w}</div>
          ))}
          {cells.map((d) => {
            const dateStr = ymd(d)
            const wd = d.getDay()
            const inMonth = d.getMonth() + 1 === aMonth
            const isToday = dateStr === todayStr
            const dayEvents = eventsOn(d)
            const holiday = holidays[dateStr]
            const redDay = !!holiday || wd === 0
            return (
              <div
                key={dateStr}
                className={`cal-cell${inMonth ? '' : ' out'}${isToday ? ' today' : ''}${inDragRange(dateStr) ? ' selecting' : ''}`}
                onMouseDown={(e) => {
                  // 일정 막대·더보기 버튼 위에서는 드래그(범위 선택)를 시작하지 않는다.
                  if (!canDrag || e.target.closest('.cal-event, .cal-more-btn')) return
                  setDrag({ start: dateStr, end: dateStr })
                }}
                onMouseEnter={() => setDrag((prev) => (prev ? { ...prev, end: dateStr } : prev))}
              >
                <div className="cal-head">
                  <span className={`cal-daynum${redDay ? ' sun' : wd === 6 ? ' sat' : ''}`}>{d.getDate()}</span>
                  {holiday && <span className="cal-holiday" title={holiday}>{holiday}</span>}
                  {dayEvents.length > MONTH_MAX && (
                    <button
                      className="cal-more-btn"
                      title={`일정 ${dayEvents.length}건 모두 보기`}
                      onClick={(ev) => { ev.stopPropagation(); setDayModal(dateStr) }}
                    >
                      +{dayEvents.length - MONTH_MAX}
                    </button>
                  )}
                </div>
                <div className="cal-events">
                  {dayEvents.slice(0, MONTH_MAX).map((e) => {
                    const isStart = dateStr === e.startDate || wd === 0
                    const isEnd = dateStr === e.endDate || wd === 6
                    const seg = e.startDate === e.endDate ? 'single'
                      : `${isStart ? 'start' : ''} ${isEnd ? 'end' : ''}`.trim() || 'mid'
                    const label = isStart ? (!e.allDay && e.startTime ? `${e.startTime.slice(0, 5)} ${e.title}` : e.title) : ' '
                    return (
                      <button
                        key={e.id}
                        className={`cal-event bar ${seg}`}
                        style={{ background: colors[e.scope] }}
                        title={`${e.title} · ${SCOPE_LABEL[e.scope]}${e.orgName ? ' · ' + e.orgName : ''}`}
                        onClick={() => setDialog({ mode: 'edit', event: e })}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : view === 'week' ? (
        <TimeGridView
          days={weekDays}
          shown={shown}
          holidays={holidays}
          colors={colors}
          todayStr={todayStr}
          canWrite={writable.length > 0}
          onEventClick={(e) => setDialog({ mode: 'edit', event: e })}
          onSlotClick={(dayStr, hour) => setDialog({
            mode: 'create',
            preset: {
              startDate: dayStr, endDate: dayStr, allDay: false,
              startTime: `${String(hour).padStart(2, '0')}:00`, endTime: `${String(hour + 1).padStart(2, '0')}:00`,
            },
          })}
        />
      ) : (
        <DayClock
          day={anchor}
          shown={shown}
          colors={colors}
          holidays={holidays}
          canWrite={writable.length > 0}
          onEventClick={(e) => setDialog({ mode: 'edit', event: e })}
          onRangeSelect={(sh, eh) => setDialog({
            mode: 'create',
            preset: {
              startDate: ymd(anchor), endDate: ymd(anchor), allDay: false,
              startTime: `${String(sh).padStart(2, '0')}:00`, endTime: `${String(eh).padStart(2, '0')}:00`,
            },
          })}
        />
      )}

      {dialog && (
        <EventDialog
          dialog={dialog}
          writable={writable}
          defaultDate={todayStr}
          onClose={() => setDialog(null)}
          onSaved={async () => { setDialog(null); await load() }}
          onError={setError}
        />
      )}
      {settingsOpen && (
        <ColorSettingsModal colors={colors} onSave={saveColors} onClose={() => setSettingsOpen(false)} />
      )}
      {dayModal && (
        <DayEventsModal
          dateStr={dayModal}
          events={shown.filter((e) => e.startDate <= dayModal && dayModal <= e.endDate)}
          holiday={holidays[dayModal]}
          colors={colors}
          onEventClick={(e) => { setDayModal(null); setDialog({ mode: 'edit', event: e }) }}
          onClose={() => setDayModal(null)}
        />
      )}
    </Shell>
  )
}

/** 더보기 — 그날의 모든 일정을 목록으로 보여주는 팝오버. */
function DayEventsModal({ dateStr, events, holiday, colors, onEventClick, onClose }) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  const title = `${m}월 ${d}일 (${WEEKDAYS[wd]})`
  return (
    <Modal title={title} onClose={onClose}>
      {holiday && (
        <p className="hint left" style={{ color: '#d1453b', fontWeight: 600, margin: '0 0 10px' }}>● {holiday}</p>
      )}
      <div className="daymodal-list">
        {events.length === 0 && <span className="muted">일정이 없습니다.</span>}
        {events.map((e) => (
          <button key={e.id} className="daymodal-item" onClick={() => onEventClick(e)}>
            <span className="dc-dot" style={{ background: colors[e.scope] }} />
            <span className="daymodal-time">
              {e.allDay || e.startDate !== e.endDate ? '종일' : `${e.startTime?.slice(0, 5) ?? ''}`}
            </span>
            <span className="daymodal-title">{e.title}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

/** 주간·일간 뷰 — 상단 종일 스트립 + 시간축 그리드. */
function TimeGridView({ days, shown, holidays, colors, todayStr, canWrite, onEventClick, onSlotClick }) {
  const HOUR_H = 44
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`

  const overlaps = (e, d) => { const s = ymd(d); return e.startDate <= s && s <= e.endDate }
  const allDayOf = (d) => shown.filter((e) => overlaps(e, d) && (e.allDay || e.startDate !== e.endDate))
  const timedOf = (d) => shown.filter((e) => overlaps(e, d) && !e.allDay && e.startDate === e.endDate && e.startTime)

  return (
    <div className="cal-timegrid">
      {/* 날짜 헤더 */}
      <div className="tg-header" style={{ gridTemplateColumns: cols }}>
        <div className="tg-corner" />
        {days.map((d) => {
          const wd = d.getDay(); const h = holidays[ymd(d)]; const isToday = ymd(d) === todayStr
          return (
            <div key={ymd(d)} className={`tg-dayhead${isToday ? ' today' : ''}`}>
              <span className={wd === 0 || h ? 'sun' : wd === 6 ? 'sat' : ''}>{WEEKDAYS[wd]} {d.getDate()}</span>
              {h && <span className="tg-holiday">{h}</span>}
            </div>
          )
        })}
      </div>

      {/* 종일·여러날 일정 스트립 */}
      <div className="tg-allday" style={{ gridTemplateColumns: cols }}>
        <div className="tg-allday-label">종일</div>
        {days.map((d) => (
          <div key={ymd(d)} className="tg-allday-col">
            {allDayOf(d).map((e) => {
              const wd = d.getDay(); const s = ymd(d)
              const isStart = s === e.startDate || wd === 0
              const isEnd = s === e.endDate || wd === 6
              const seg = e.startDate === e.endDate ? 'single' : `${isStart ? 'start' : ''} ${isEnd ? 'end' : ''}`.trim() || 'mid'
              return (
                <button key={e.id} className={`cal-event bar ${seg}`} style={{ background: colors[e.scope] }}
                        title={e.title} onClick={() => onEventClick(e)}>
                  {isStart ? e.title : ' '}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* 시간축 */}
      <div className="tg-body" style={{ gridTemplateColumns: cols }}>
        <div className="tg-hours">
          {hours.map((h) => <div key={h} className="tg-hourlabel" style={{ height: HOUR_H }}>{String(h).padStart(2, '0')}:00</div>)}
        </div>
        {days.map((d) => (
          <div key={ymd(d)} className="tg-daycol">
            {hours.map((h) => (
              <div key={h} className={`tg-slot${canWrite ? ' writable' : ''}`} style={{ height: HOUR_H }}
                   onClick={() => canWrite && onSlotClick(ymd(d), h)} />
            ))}
            {timedOf(d).map((e) => {
              const [sh, sm] = e.startTime.split(':').map(Number)
              const [eh, em] = (e.endTime || e.startTime).split(':').map(Number)
              const top = (sh * 60 + sm) / 60 * HOUR_H
              const height = Math.max(((eh * 60 + em) - (sh * 60 + sm)) / 60 * HOUR_H, 22)
              return (
                <button key={e.id} className="tg-event" style={{ top, height, background: colors[e.scope] }}
                        title={`${e.startTime.slice(0, 5)} ${e.title}`} onClick={() => onEventClick(e)}>
                  <span className="tg-event-time">{e.startTime.slice(0, 5)}</span> {e.title}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** 일간 뷰 — 24시간 원형(시계) 그래프. 종일 일정은 상단에 색+텍스트로. */
function DayClock({ day, shown, colors, holidays, canWrite, onEventClick, onRangeSelect }) {
  const [drag, setDrag] = useState(null) // 시간 드래그 { from, to } (0~24 시)
  const s = ymd(day)
  const overlaps = (e) => e.startDate <= s && s <= e.endDate
  const allDay = shown.filter((e) => overlaps(e) && (e.allDay || e.startDate !== e.endDate))
  const timedRaw = shown.filter((e) => overlaps(e) && !e.allDay && e.startDate === e.endDate && e.startTime)

  // 겹치는 시간 일정은 서로 다른 동심 밴드(레인)에 그린다.
  const items = timedRaw.map((e) => {
    const [sh, sm] = e.startTime.split(':').map(Number)
    const [eh, em] = (e.endTime || e.startTime).split(':').map(Number)
    return { e, start: sh * 60 + sm, end: Math.max(eh * 60 + em, sh * 60 + sm + 15) }
  }).sort((a, b) => a.start - b.start)
  const laneEnds = []
  items.forEach((x) => {
    let lane = laneEnds.findIndex((end) => end <= x.start)
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(x.end) } else laneEnds[lane] = x.end
    x.lane = lane
  })
  const laneCount = Math.max(laneEnds.length, 1)

  const size = 480, cx = size / 2, cy = size / 2, R = 214, holeR = 104
  const band = (R - holeR) / laneCount
  const point = (angle, rad) => {
    const a = (angle * Math.PI) / 180
    return [cx + rad * Math.sin(a), cy - rad * Math.cos(a)]
  }
  const arcPath = (start, end, outerR, innerR) => {
    const a1 = (start / 1440) * 360, a2 = (end / 1440) * 360
    const [x1o, y1o] = point(a1, outerR), [x2o, y2o] = point(a2, outerR)
    const [x2i, y2i] = point(a2, innerR), [x1i, y1i] = point(a1, innerR)
    const large = a2 - a1 > 180 ? 1 : 0
    return `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${innerR} ${innerR} 0 ${large} 0 ${x1i} ${y1i} Z`
  }
  const hhmm = (t) => (t ? t.slice(0, 5) : '')

  // 원 위 마우스 위치 → 시(hour). 0=위(자정), 시계방향.
  function posToHour(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    let ang = (Math.atan2(x, -y) * 180) / Math.PI
    if (ang < 0) ang += 360
    return Math.round((ang / 360) * 24)
  }

  // 드래그를 끝내면 선택한 시간 범위로 일정 추가 창을 연다.
  useEffect(() => {
    if (!drag) return
    function up() {
      let a = Math.min(drag.from, drag.to)
      let b = Math.max(drag.from, drag.to)
      if (b <= a) b = a + 1
      if (b > 24) b = 24
      setDrag(null)
      onRangeSelect(a, b)
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [drag, onRangeSelect])

  return (
    <div className="cal-dayclock">
      {/* 종일 — 공휴일(빨강) + 종일 일정(색 점 + 텍스트) */}
      <div className="dc-allday">
        <span className="dc-allday-title">종일</span>
        {holidays[s] && (
          <span className="dc-allday-item holiday">
            <span className="dc-dot" style={{ background: '#d1453b' }} />
            {holidays[s]}
          </span>
        )}
        {allDay.length === 0 && !holidays[s] && <span className="muted">종일 일정 없음</span>}
        {allDay.map((e) => (
          <button key={e.id} className="dc-allday-item" onClick={() => onEventClick(e)}>
            <span className="dc-dot" style={{ background: colors[e.scope] }} />
            {e.title}
          </button>
        ))}
      </div>

      <div className="dc-main">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className={`dc-svg${canWrite ? ' writable' : ''}`}
          onMouseDown={(e) => {
            if (!canWrite || (e.target.classList && e.target.classList.contains('dc-arc'))) return
            const h = posToHour(e)
            setDrag({ from: h, to: h })
          }}
          onMouseMove={(e) => { if (drag) { const h = posToHour(e); setDrag((d) => (d ? { ...d, to: h } : d)) } }}
        >
          <circle cx={cx} cy={cy} r={(R + holeR) / 2} fill="none" stroke="#eef1f5" strokeWidth={R - holeR} />
          {Array.from({ length: 24 }).map((_, h) => {
            const [x1, y1] = point(h * 15, holeR - 2)
            const [x2, y2] = point(h * 15, R + 2)
            return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e3e6ea" strokeWidth={h % 6 === 0 ? 1.5 : 0.6} />
          })}
          {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => {
            const [x, y] = point(h * 15, R + 18)
            return <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="dc-hourtext">{h}</text>
          })}
          {items.map((x) => {
            const outerR = R - x.lane * band
            const innerR = outerR - band + 3
            return (
              <path key={x.e.id} d={arcPath(x.start, x.end, outerR, innerR)} fill={colors[x.e.scope]}
                    className="dc-arc" onClick={() => onEventClick(x.e)}>
                <title>{`${hhmm(x.e.startTime)}~${hhmm(x.e.endTime)} ${x.e.title}`}</title>
              </path>
            )
          })}
          {/* 드래그 미리보기 호 */}
          {drag && (() => {
            const a = Math.min(drag.from, drag.to)
            const b = Math.max(drag.from, drag.to)
            const bb = b <= a ? a + 1 : b
            return <path d={arcPath(a * 60, Math.min(bb, 24) * 60, R, holeR)} fill="rgba(47,111,235,0.28)" pointerEvents="none" />
          })()}
          <text x={cx} y={cy + 6} textAnchor="middle" className={`dc-center-day${holidays[s] || day.getDay() === 0 ? ' red' : ''}`}>{day.getDate()}</text>
          <text x={cx} y={cy + 34} textAnchor="middle" className="dc-center-sub">{WEEKDAYS[day.getDay()]}요일</text>
        </svg>

        {/* 시간 일정 목록 */}
        <div className="dc-list">
          {items.length === 0 && <span className="muted">시간 일정 없음</span>}
          {items.map((x) => (
            <button key={x.e.id} className="dc-list-item" onClick={() => onEventClick(x.e)}>
              <span className="dc-dot" style={{ background: colors[x.e.scope] }} />
              <span className="dc-list-time">{hhmm(x.e.startTime)}~{hhmm(x.e.endTime)}</span>
              <span className="dc-list-title">{x.e.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function EventDialog({ dialog, writable, defaultDate, onClose, onSaved, onError }) {
  const { mode, event, preset } = dialog
  const [form, setForm] = useState({
    title: event?.title ?? '',
    startDate: event?.startDate ?? preset?.startDate ?? defaultDate,
    endDate: event?.endDate ?? preset?.endDate ?? preset?.startDate ?? defaultDate,
    allDay: event ? event.allDay : (preset?.allDay ?? true), // 기본 종일 (시간 슬롯 클릭이면 시간 있음)
    startTime: event?.startTime?.slice(0, 5) ?? preset?.startTime ?? '09:00',
    endTime: event?.endTime?.slice(0, 5) ?? preset?.endTime ?? '10:00',
    scope: event?.scope ?? writable[0] ?? 'PERSONAL',
    description: event?.description ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const editable = mode === 'create' || event?.editable

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const body = {
        title: form.title,
        startDate: form.startDate,
        endDate: form.endDate < form.startDate ? form.startDate : form.endDate,
        allDay: form.allDay,
        startTime: form.allDay ? null : form.startTime,
        endTime: form.allDay ? null : form.endTime,
        description: form.description || undefined,
      }
      if (mode === 'create') await calendarApi.create({ ...body, scope: form.scope })
      else await calendarApi.update(event.id, body)
      await onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    try {
      await calendarApi.remove(event.id)
      await onSaved()
    } catch (err) {
      onError(err.message)
      onClose()
    }
  }

  return (
    <Modal title={mode === 'create' ? '일정 추가' : editable ? '일정 수정' : '일정'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Toast message={error} onClose={() => setError('')} />

        {/* 범위: 생성 시엔 쓸 수 있는 범위만 선택. 수정 시엔 배지로 표시(변경 불가). */}
        {mode === 'create' ? (
          <label className="field">
            <span>범위</span>
            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
              {writable.map((s) => <option key={s} value={s}>{SCOPE_LABEL[s]}일정</option>)}
            </select>
          </label>
        ) : (
          <p className="hint left">
            <span className={`badge scope-badge-${event.scope.toLowerCase()}`}>{SCOPE_LABEL[event.scope]}</span>
            {event.orgName ? ` · ${event.orgName}` : ''} · 작성 {event.ownerName}
          </p>
        )}

        <label className="field">
          <span>제목</span>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                 maxLength={100} required autoFocus disabled={!editable} />
        </label>

        <div className="field-row">
          <label className="field">
            <span>시작일</span>
            <input type="date" value={form.startDate}
                   onChange={(e) => setForm({ ...form, startDate: e.target.value })} required disabled={!editable} />
          </label>
          <label className="field">
            <span>종료일</span>
            <input type="date" value={form.endDate} min={form.startDate}
                   onChange={(e) => setForm({ ...form, endDate: e.target.value })} required disabled={!editable} />
          </label>
        </div>

        <label className="check" style={{ margin: '2px 0 8px' }}>
          <input type="checkbox" checked={form.allDay}
                 onChange={(e) => setForm({ ...form, allDay: e.target.checked })} disabled={!editable} />
          종일
        </label>

        {/* 종일이 아니면 시작·종료 시간 입력 */}
        {!form.allDay && (
          <div className="field-row">
            <label className="field">
              <span>시작 시간</span>
              <input type="time" value={form.startTime}
                     onChange={(e) => setForm({ ...form, startTime: e.target.value })} disabled={!editable} />
            </label>
            <label className="field">
              <span>종료 시간</span>
              <input type="time" value={form.endTime}
                     onChange={(e) => setForm({ ...form, endTime: e.target.value })} disabled={!editable} />
            </label>
          </div>
        )}

        <label className="field">
          <span>설명 (선택)</span>
          <textarea value={form.description} rows={3} maxLength={500}
                    onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!editable} />
        </label>

        <div className="dialog-actions">
          {mode === 'edit' && editable && (
            <button type="button" className="btn-danger" onClick={remove} disabled={saving} style={{ marginRight: 'auto' }}>
              삭제
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>{editable ? '취소' : '닫기'}</button>
          {editable && (
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중…' : '💾 저장'}</button>
          )}
        </div>
      </form>
    </Modal>
  )
}

/** 톱니바퀴 → 범위별 색상 설정. localStorage 에 저장돼 이 브라우저에서 유지된다. */
function ColorSettingsModal({ colors, onSave, onClose }) {
  const [draft, setDraft] = useState(colors)
  const scopes = [
    { key: 'ALL', label: '전사일정' },
    { key: 'TEAM', label: '팀별일정' },
    { key: 'PERSONAL', label: '개인일정' },
  ]
  return (
    <Modal title="⚙ 달력 색상 설정" onClose={onClose}>
      <p className="hint left">범위별 일정 색을 정합니다. 이 브라우저에 저장됩니다.</p>
      {scopes.map((s) => (
        <div key={s.key} className="color-row">
          <span className="color-swatch" style={{ background: draft[s.key] }} />
          <span className="color-label">{s.label}</span>
          <input type="color" value={draft[s.key]} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} />
        </div>
      ))}
      <div className="dialog-actions">
        <button type="button" className="btn-ghost" onClick={() => setDraft({ ...DEFAULT_COLORS })}>기본값</button>
        <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
        <button type="button" className="btn-primary" onClick={() => { onSave(draft); onClose() }}>💾 저장</button>
      </div>
    </Modal>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  )
}
