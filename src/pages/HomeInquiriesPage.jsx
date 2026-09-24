import { useCallback, useEffect, useState } from 'react'
import Shell from '../components/Shell'
import Toast from '../components/Toast'
import Loading from '../components/Loading'
import { homeInquiryApi } from '../api/client'

function fmt(dt) { return dt ? dt.slice(0, 16).replace('T', ' ') : '-' }

const SITES = [
  { key: 'ALL', label: '전체' },
  { key: 'KANCHENJUNGA', label: '회사' },
  { key: 'EXPRISM', label: 'EXPRISM' },
  { key: 'DESIGN', label: '디자인 요청' },
]

const STATUSES = [
  { key: 'ALL', label: '전체' },
  { key: 'NEW', label: '접수' },
  { key: 'IN_PROGRESS', label: '처리중' },
  { key: 'DONE', label: '완료' },
]

/** 상태별 배지 색. 손대지 않은 것(접수)이 눈에 띄어야 한다. */
function statusBadge(status) {
  if (status === 'NEW') return 'badge badge-suspended'
  if (status === 'IN_PROGRESS') return 'badge badge-active'
  return 'badge badge-disabled'
}

/**
 * 홈페이지 문의 — kanchenjunga.co.kr / exprism.co.kr 의 /contact 로 들어온 것.
 *
 * 업체 문의(/inquiries)와 화면이 다른 이유: 저쪽은 사장님과 주고받는 대화라 답변창이 있다.
 * 이쪽은 외부 방문자가 남기고 담당자가 메일·전화로 답한다 — 여기서는 내용을 보고
 * "처리했는지" 만 남긴다. 그래서 답변 입력창이 없고 상태와 메모만 있다.
 */
export default function HomeInquiriesPage() {
  const [mode, setMode] = useState('list') // list | detail
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  async function openDetail(id) {
    setError('')
    try { setDetail(await homeInquiryApi.get(id)); setMode('detail') }
    catch (e) { setError(e.message) }
  }

  return (
    <Shell>
      <Toast message={error} onClose={() => setError('')} />
      {mode === 'list' ? (
        <InquiryList onOpen={openDetail} onError={setError} />
      ) : (
        <InquiryDetailView
          detail={detail}
          onBack={() => { setDetail(null); setMode('list') }}
          onChanged={setDetail}
          onDeleted={() => { setDetail(null); setMode('list') }}
          onError={setError}
        />
      )}
    </Shell>
  )
}

function InquiryList({ onOpen, onError }) {
  const [data, setData] = useState({
    content: [], totalElements: 0, totalPages: 0, page: 0,
    newCount: 0, inProgressCount: 0, doneCount: 0,
  })
  const [siteType, setSiteType] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [recipients, setRecipients] = useState(null)
  const [menu, setMenu] = useState(null) // 우클릭 { x, y, row }

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await homeInquiryApi.list({ siteType, status, page, size: 20 })) }
    catch (e) { onError(e.message) } finally { setLoading(false) }
  }, [siteType, status, page, onError])
  useEffect(() => { load() }, [load])

  // 알림이 실제로 누구에게 가는지 화면에 밝혀 둔다 — 공통코드를 열어보지 않아도 알 수 있게.
  useEffect(() => {
    homeInquiryApi.recipients().then(setRecipients).catch(() => setRecipients([]))
  }, [])

  // 우클릭 메뉴는 바깥 클릭·Esc·스크롤에 닫는다 (콘솔 공통 규칙).
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e) => e.key === 'Escape' && close()
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  async function quickStatus(row, next) {
    setMenu(null)
    try { await homeInquiryApi.changeStatus(row.inquiryId, next, null); await load() }
    catch (e) { onError(e.message) }
  }

  return (
    <div className="notice-page">
      <div className="notice-hero">
        <div className="notice-hero-icon" aria-hidden="true">✉️</div>
        <div className="notice-hero-text">
          <h2>홈페이지 문의</h2>
          <p>회사 홈페이지·EXPRISM 사이트의 문의하기와 디자인 시안 요청서로 접수된 내용입니다.</p>
        </div>
        <div className="notice-hero-actions">
          <select value={siteType} onChange={(e) => { setPage(0); setSiteType(e.target.value) }}>
            {SITES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <select value={status} onChange={(e) => { setPage(0); setStatus(e.target.value) }}>
            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="notice-stats">
        <div className="stat-card">
          <span className="stat-num">{loading ? '–' : data.totalElements}</span>
          <span className="stat-label">전체</span>
        </div>
        <div className="stat-card">
          <span className="stat-num stat-accent">{loading ? '–' : data.newCount}</span>
          <span className="stat-label">접수</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{loading ? '–' : data.inProgressCount}</span>
          <span className="stat-label">처리중</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{loading ? '–' : data.doneCount}</span>
          <span className="stat-label">완료</span>
        </div>
      </div>

      {recipients !== null && (
        <p className="muted" style={{ margin: '0 0 12px' }}>
          알림 메일 수신:{' '}
          {recipients.length === 0
            ? '등록된 주소가 없습니다. 설정 › 공통코드 › KCJG_CONTACT_EMAIL 에 주소를 추가하세요.'
            : `${recipients.join(', ')} (설정 › 공통코드 › KCJG_CONTACT_EMAIL 에서 변경)`}
        </p>
      )}

      <div className="card notice-list-card">
        {loading ? (
          <Loading label="문의를 불러오는 중…" />
        ) : data.content.length === 0 ? (
          <div className="notice-empty-state">
            <div className="notice-empty-ic" aria-hidden="true">🗒️</div>
            <p className="notice-empty-title">접수된 문의가 없습니다.</p>
            <p className="notice-empty-sub">홈페이지 문의하기로 글이 들어오면 여기에 쌓입니다.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>번호</th>
                  <th style={{ width: 90 }}>사이트</th>
                  <th className="col-grow">제목</th>
                  <th style={{ width: 100 }}>이름</th>
                  <th style={{ width: 130 }}>연락처</th>
                  <th style={{ width: 90 }}>상태</th>
                  <th style={{ width: 70 }}>알림</th>
                  <th style={{ width: 140 }}>접수일</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((q) => (
                  <tr
                    key={q.inquiryId}
                    className="row-clickable"
                    onClick={() => onOpen(q.inquiryId)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setMenu({ x: e.clientX, y: e.clientY, row: q })
                    }}
                  >
                    <td className="muted-cell">{q.inquiryId}</td>
                    <td className="muted-cell">{q.siteLabel}</td>
                    <td className="strong">
                      {q.subject}
                      {q.hasImages && <span className="muted-cell" title="첨부 이미지 있음"> 📎</span>}
                    </td>
                    <td>{q.name}</td>
                    <td className="muted-cell">{q.phone || '-'}</td>
                    <td><span className={statusBadge(q.status)}>{q.statusLabel}</span></td>
                    <td className="muted-cell" title={q.notified ? '알림 메일 발송됨' : '알림 메일이 나가지 않았습니다'}>
                      {q.notified ? '✓' : '—'}
                    </td>
                    <td className="muted-cell">{fmt(q.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data.totalPages > 1 && (
        <div className="pager">
          <button className="btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
          <span className="pager-info">{page + 1} / {data.totalPages}</span>
          <button className="btn-ghost btn-sm" disabled={page >= data.totalPages - 1} onClick={() => setPage(page + 1)}>다음</button>
        </div>
      )}

      {menu && (
        <ul className="context-menu" style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          <li onClick={() => { setMenu(null); onOpen(menu.row.inquiryId) }}>상세 보기</li>
          <li onClick={() => quickStatus(menu.row, 'IN_PROGRESS')}>처리중으로</li>
          <li onClick={() => quickStatus(menu.row, 'DONE')}>완료로</li>
          <li onClick={() => { setMenu(null); window.location.href = `mailto:${menu.row.email}` }}>
            메일로 답장
          </li>
        </ul>
      )}
    </div>
  )
}

function InquiryDetailView({ detail, onBack, onChanged, onDeleted, onError }) {
  const [memo, setMemo] = useState(detail?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(false)

  if (!detail) return null

  async function apply(next) {
    setSaving(true)
    try { onChanged(await homeInquiryApi.changeStatus(detail.inquiryId, next, memo)) }
    catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  async function remove() {
    try { await homeInquiryApi.remove(detail.inquiryId); onDeleted() }
    catch (e) { onError(e.message) }
  }

  const rows = [
    ['이름', detail.name],
    ['연락처', detail.phone],
    ['이메일', detail.email],
    ['매장명', detail.storeName],
    ['매장 규모', detail.storeSize],
    ['도입 희망 시기', detail.openTiming],
    ['관심 기능', detail.interests],
    ['접수 일시', fmt(detail.createdAt)],
    ['접수 IP', detail.clientIp],
    ['알림 메일', detail.notified ? `${detail.notifiedTo} (${fmt(detail.notifiedAt)})` : '발송되지 않음'],
  ].filter(([, v]) => v)

  return (
    <>
      <div className="page-head">
        <button className="btn-ghost btn-sm" onClick={onBack}>← 목록</button>
        <div className="page-actions">
          <span className={statusBadge(detail.status)}>{detail.statusLabel}</span>
          <a className="btn-action" href={`mailto:${detail.email}?subject=${encodeURIComponent('RE: ' + detail.subject)}`}>
            메일로 답장
          </a>
          <button className="btn-action btn-action-danger" onClick={() => setConfirm(true)}>삭제</button>
        </div>
      </div>

      <article className="notice-detail">
        <h1 className="notice-title">
          <span className="badge badge-active">{detail.siteLabel}</span> {detail.subject}
        </h1>

        <div className="table-wrap" style={{ margin: '16px 0' }}>
          <table className="table">
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <th style={{ width: 140, textAlign: 'left' }}>{label}</th>
                  <td className="col-grow">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 방문자가 쓴 글. HTML 로 해석하지 않는다 — 외부 입력이라 그대로 렌더링하면 위험하다. */}
        <div className="notice-content" style={{ whiteSpace: 'pre-wrap' }}>
          {detail.content || '(내용 없음)'}
        </div>

        {/* 디자인 시안 요청서의 참고 이미지. 눌러서 원본을 연다. */}
        {detail.imageUrls?.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p className="muted" style={{ marginBottom: 8 }}>첨부 이미지 {detail.imageUrls.length}장</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {detail.imageUrls.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt={`첨부 이미지 ${i + 1}`}
                    style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid #e3e6ea' }}
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ marginTop: 20, padding: 16 }}>
          <label className="check" style={{ display: 'block', marginBottom: 8 }}>담당자 메모</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={500}
            rows={3}
            style={{ width: '100%' }}
            placeholder="연락 결과나 진행 상황을 남겨두면 다음 사람이 압니다."
          />
          <div className="dialog-actions" style={{ marginTop: 12 }}>
            <button className="btn-ghost" disabled={saving} onClick={() => apply('NEW')}>접수로</button>
            <button className="btn-ghost" disabled={saving} onClick={() => apply('IN_PROGRESS')}>처리중으로</button>
            <button className="btn-primary" disabled={saving} onClick={() => apply('DONE')}>
              {saving ? '저장 중…' : '완료로'}
            </button>
          </div>
        </div>
      </article>

      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>문의 삭제</h3>
            <p className="confirm-text">
              <strong>{detail.inquiryId} {detail.subject}</strong> 문의를 삭제하시겠습니까?
            </p>
            <p className="muted">되돌릴 수 없습니다. 접수자에게 답장하지 않았다면 먼저 처리하세요.</p>
            <div className="dialog-actions">
              <button className="btn-ghost" onClick={() => setConfirm(false)}>취소</button>
              <button className="btn-primary btn-danger-solid" onClick={remove}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
