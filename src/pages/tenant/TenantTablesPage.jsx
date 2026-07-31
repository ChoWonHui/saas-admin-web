import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import TableLayoutEditor, { TakeoutQrModal } from '../../components/TableLayoutEditor'
import Loading from '../../components/Loading'
import { tenantTableApi } from '../../api/tenantClient'

// 포장 주문 3단(포장불가 / 포장가능 / 포장전문).
const PK_MODES = [
  { key: 'none', label: '포장불가', color: '#8b8b9a', desc: '손님 포장 주문을 받지 않습니다.' },
  { key: 'available', label: '포장가능', color: '#22c55e', desc: '홀 + 포장 주문을 함께 받습니다.' },
  { key: 'only', label: '포장전문', color: '#3525cd', desc: '포장 전문점 — 테이블 배치 없이 포장만 받습니다.' },
]

// 사장님 콘솔 테이블 관리 — Material 3(인디고). 상단 저장 + [자리 배치 | 테이블 QR] 탭.
export default function TenantTablesPage() {
  const [error, setError] = useState('')
  const [layout, setLayout] = useState(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('layout') // 'layout' | 'qr'
  const [reloadKey, setReloadKey] = useState(0) // 새로고침 시 편집기를 다시 마운트한다
  const [packagingMode, setPackagingMode] = useState('none') // 포장 섹션이 편집기의 포장 상태를 제어한다
  const [takeoutQrOpen, setTakeoutQrOpen] = useState(false)
  const editorRef = useRef(null)

  const reloadInfo = useCallback(() => {
    tenantTableApi.layout()
      .then((l) => {
        setLayout(l)
        setPackagingMode(l.takeoutOnly ? 'only' : l.takeoutEnabled ? 'available' : 'none')
      })
      .catch((e) => { setError(e.message); setLayout({ tables: [], floorCount: 1 }) })
  }, [])
  useEffect(() => { reloadInfo() }, [reloadInfo])

  const loadLayout = useCallback(() => tenantTableApi.layout(), [])
  const onSave = useCallback((body) => tenantTableApi.saveLayout(body), [])
  const loadTableQr = useCallback((table) => tenantTableApi.qr(table.tableId), [])
  const loadTakeoutQr = useCallback(() => tenantTableApi.takeoutQr(), [])

  async function handleSave() {
    if (!editorRef.current) return
    setSaving(true)
    try { await editorRef.current.save() } finally { setSaving(false) }
  }

  // 새로고침 — 서버의 최신 배치를 다시 불러온다(편집기 재마운트 + 통계/QR 갱신).
  function handleRefresh() {
    setReloadKey((k) => k + 1)
    reloadInfo()
  }

  const tables = (layout?.tables ?? []).filter((t) => t.tableId != null)
  const stats = useMemo(() => {
    const count = tables.length
    const rooms = tables.filter((t) => t.kind === 'ROOM').length
    const avg = count ? tables.reduce((s, t) => s + (t.seats || 0), 0) / count : 0
    const takeout = !!(layout?.takeoutEnabled || layout?.takeoutOnly)
    return { count, rooms, avg: Math.round(avg * 10) / 10, floors: layout?.floorCount || 1, takeout }
  }, [tables, layout])

  return (
    <TenantShell>
      <div className="m-topline m-topline-sticky">
        <div className="m-page-head">
          <h1>테이블 관리</h1>
          <p>가게 자리를 배치하고, 테이블마다 주문용 QR 코드를 생성하세요.</p>
        </div>
        {tab === 'layout' && (
          <div className="m-topline-actions">
            <button className="m-btn m-btn-outline2" onClick={handleRefresh} disabled={saving} title="서버의 최신 배치를 다시 불러옵니다">
              <Icon name="refresh" /> 새로고침
            </button>
            <button className="m-btn m-btn-primary" onClick={handleSave} disabled={saving}>
              <Icon name="save" />{saving ? '저장 중…' : '저장하기'}
            </button>
          </div>
        )}
      </div>

      {/* 통계 4장 */}
      <div className="wl-stats tbl-stats">
        <div className="wl-stat">
          <span className="wl-stat-ic free"><Icon name="table_restaurant" /></span>
          <div className="wl-stat-txt"><span className="wl-stat-label">총 테이블</span><b className="wl-stat-num">{stats.count}</b></div>
        </div>
        <div className="wl-stat">
          <span className="wl-stat-ic use"><Icon name="layers" /></span>
          <div className="wl-stat-txt"><span className="wl-stat-label">운영 층수</span><b className="wl-stat-num">{stats.floors}층</b></div>
        </div>
        <div className="wl-stat">
          <span className="wl-stat-ic rsv"><Icon name="groups" /></span>
          <div className="wl-stat-txt"><span className="wl-stat-label">평균 좌석</span><b className="wl-stat-num">{stats.avg}명</b></div>
        </div>
        <div className="wl-stat">
          <span className="wl-stat-ic ok"><Icon name="takeout_dining" /></span>
          <div className="wl-stat-txt"><span className="wl-stat-label">포장 상태</span><b className="wl-stat-num">{stats.takeout ? '가능' : '정지'}</b></div>
        </div>
      </div>

      {/* 탭 */}
      <div className="m-tabs" role="tablist">
        <button role="tab" className={`m-tab${tab === 'layout' ? ' on' : ''}`} onClick={() => setTab('layout')}>
          자리 배치
        </button>
        <button role="tab" className={`m-tab${tab === 'qr' ? ' on' : ''}`} onClick={() => setTab('qr')}>
          테이블 QR{tables.length > 0 && <span className="m-tab-count">{tables.length}</span>}
        </button>
      </div>

      {/* 자리 배치 탭 — 편집기는 계속 마운트해 탭 전환에도 편집이 유지되게 한다 */}
      <div style={{ display: tab === 'layout' ? 'flex' : 'none', flexDirection: 'column', gap: 24 }}>
        {/* 포장 주문 설정 — 컴팩트 SaaS 설정 카드(세그먼트 컨트롤) */}
        <section className="m-card pk-set">
          <div className="pk-set-top">
            <h3 className="pk-set-h">포장 주문 설정</h3>
            {packagingMode !== 'none' && (
              <button type="button" className="pk-set-qr" onClick={() => setTakeoutQrOpen(true)}>
                <Icon name="qr_code_2" /> 포장 QR
              </button>
            )}
          </div>
          <div className="pk-seg" role="tablist" aria-label="포장 주문 설정">
            {PK_MODES.map((m) => {
              const on = packagingMode === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`pk-seg-btn${on ? ' on' : ''}`}
                  onClick={() => setPackagingMode(m.key)}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          <p className="pk-set-desc">
            <span className="pk-set-dot" style={{ background: PK_MODES.find((m) => m.key === packagingMode)?.color }} />
            {PK_MODES.find((m) => m.key === packagingMode)?.desc}
          </p>
        </section>

        {packagingMode !== 'only' && (
          <div className="m-section-head">
            <span className="m-step">1</span>
            <div className="m-section-title">
              <h2>자리 배치</h2>
              <p>드래그하여 테이블 위치를 조정하고, 저장하면 QR이 갱신됩니다.</p>
            </div>
          </div>
        )}

        {/* 편집기는 항상 한 번만 마운트한다(포장전문이면 스스로 안내 메시지를 띄운다) */}
        <section className="m-card" style={{ padding: 18 }}>
          <TableLayoutEditor
            key={reloadKey}
            ref={editorRef}
            embedded
            hideActions
            title=""
            externalPackaging
            packagingMode={packagingMode}
            loadLayout={loadLayout}
            onSave={onSave}
            loadTableQr={loadTableQr}
            loadTakeoutQr={loadTakeoutQr}
            onError={setError}
            onSaved={reloadInfo}
          />
        </section>
      </div>

      {/* 테이블 QR 탭 */}
      <div style={{ display: tab === 'qr' ? 'flex' : 'none', flexDirection: 'column', gap: 24 }}>
        <div className="m-section-head">
          <span className="m-step">2</span>
          <div className="m-section-title">
            <h2>테이블 QR</h2>
            <p>테이블마다 QR을 내려받거나 한 번에 인쇄하세요.</p>
          </div>
          <span className="m-spacer" />
          {tables.length > 0 && (
            <button type="button" className="m-btn m-btn-outline2" onClick={() => window.print()}>
              <Icon name="print" /> 전체 인쇄
            </button>
          )}
        </div>

        {layout === null ? (
          <Loading label="테이블을 불러오는 중…" />
        ) : tables.length === 0 ? (
          <div className="m-card m-empty">
            <Icon name="qr_code_2" />
            <p>저장된 테이블이 없습니다.</p>
            <p>자리 배치에서 테이블을 놓고 저장하면 QR이 생깁니다.</p>
          </div>
        ) : (
          <div className="m-qr-grid">
            {tables.map((t) => <QrCard key={t.tableId} table={t} onError={setError} />)}
          </div>
        )}
      </div>

      {takeoutQrOpen && (
        <TakeoutQrModal loadQr={loadTakeoutQr} onClose={() => setTakeoutQrOpen(false)} onError={setError} />
      )}

      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}

function QrCard({ table, onError }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let url
    tenantTableApi.qr(table.tableId)
      .then((u) => { url = u; setSrc(u) })
      .catch((e) => onError(e.message))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [table.tableId, onError])

  const name = table.label || (table.kind === 'ROOM' ? '룸' : '테이블')
  const fileName = `qr-${(table.label || table.tableId)}.png`

  return (
    <div className="m-card m-qr-card">
      <div className="m-qr-head">
        <span className="m-qr-name">{name}</span>
        <span className="m-qr-sub">{table.floorNo}층 · {table.kind === 'ROOM' ? '룸 ' : ''}{table.seats}인</span>
      </div>
      <div className="m-qr-img">
        {src ? <img src={src} alt={`${name} 주문 QR`} /> : <span className="m-center-pad">생성 중…</span>}
      </div>
      {src && (
        <a className="m-qr-dl" href={src} download={fileName}>
          <Icon name="download" /> PNG 저장
        </a>
      )}
    </div>
  )
}
