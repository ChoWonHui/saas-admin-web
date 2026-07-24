import { useCallback, useEffect, useRef, useState } from 'react'
import Shell from '../components/Shell'
import Toast from '../components/Toast'
import Loading from '../components/Loading'
import { fileApi, inquiryApi } from '../api/client'

const STATUS = {
  OPEN: { label: '답변대기', cls: 'open' },
  ANSWERED: { label: '답변완료', cls: 'answered' },
  CLOSED: { label: '종료', cls: 'closed' },
}
const FILTERS = [
  { key: 'ALL', label: '전체' },
  { key: 'OPEN', label: '답변대기' },
  { key: 'ANSWERED', label: '답변완료' },
  { key: 'CLOSED', label: '종료' },
]
function fmt(dt) {
  return dt ? dt.slice(0, 16).replace('T', ' ') : ''
}

/** 이미지 첨부(관리자 업로드 엔드포인트 사용). */
function ImageAttach({ urls, setUrls, onError }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  async function pick(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    if (urls.length + files.length > 10) { onError('이미지는 최대 10장까지 첨부할 수 있습니다.'); return }
    setBusy(true)
    try {
      for (const f of files) {
        if (!f.type.startsWith('image/')) { onError('이미지 파일만 첨부할 수 있습니다.'); continue }
        const { url } = await fileApi.uploadImage(f)
        setUrls((prev) => [...prev, url])
      }
    } catch (err) { onError(err.message || '이미지 업로드에 실패했습니다.') }
    finally { setBusy(false) }
  }
  return (
    <div className="img-attach">
      <div className="img-thumbs">
        {urls.map((u, i) => (
          <div key={u + i} className="img-thumb">
            <img src={u} alt="첨부" />
            <button type="button" className="img-del" onClick={() => setUrls((p) => p.filter((_, idx) => idx !== i))} aria-label="삭제">×</button>
          </div>
        ))}
        <button type="button" className="img-add" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? '올리는 중…' : '＋ 사진'}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={pick} />
    </div>
  )
}

function Bubble({ side, name, badge, content, images, at }) {
  return (
    <div className={`iq-bubble ${side}`}>
      <div className="iq-bubble-head">
        <span className="iq-who">{name}</span>
        {badge && <span className={`iq-badge ${badge.cls}`}>{badge.label}</span>}
        <span className="iq-at">{fmt(at)}</span>
      </div>
      {content && <p className="iq-text">{content}</p>}
      {images?.length > 0 && (
        <div className="iq-images">
          {images.map((u, i) => (
            <a key={u + i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="첨부 이미지" /></a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function InquiriesPage() {
  const [filter, setFilter] = useState('ALL')
  const [all, setAll] = useState(null) // 전체(통계 + 클라이언트 필터)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setAll(await inquiryApi.list('ALL')) }
    catch (e) { setError(e.message); setAll([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function openDetail(id) {
    try { setDetail(await inquiryApi.get(id)) }
    catch (e) { setError(e.message) }
  }

  const listAll = all ?? []
  const items = filter === 'ALL' ? listAll : listAll.filter((q) => q.status === filter)
  const openCount = listAll.filter((q) => q.status === 'OPEN').length
  const answeredCount = listAll.filter((q) => q.status === 'ANSWERED').length

  return (
    <Shell>
      <Toast message={error} onClose={() => setError('')} />
      <div className="notice-page">
        {/* 히어로 — 공지사항과 동일한 배너 + 상태 필터 */}
        <div className="notice-hero">
          <div className="notice-hero-icon" aria-hidden="true">💬</div>
          <div className="notice-hero-text">
            <h2>문의 관리</h2>
            <p>업체(사장님)가 남긴 문의를 확인하고 답변하세요.</p>
          </div>
          <div className="notice-hero-actions">
            <div className="iq-filters">
              {FILTERS.map((f) => (
                <button key={f.key} className={`iq-filter${filter === f.key ? ' on' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 요약 카드 */}
        <div className="notice-stats">
          <div className="stat-card">
            <span className="stat-num">{all === null ? '–' : listAll.length}</span>
            <span className="stat-label">전체 문의</span>
          </div>
          <div className="stat-card">
            <span className="stat-num stat-accent">{all === null ? '–' : openCount}</span>
            <span className="stat-label">답변 대기</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{all === null ? '–' : answeredCount}</span>
            <span className="stat-label">답변 완료</span>
          </div>
        </div>

        {/* 목록 카드 */}
        <div className="card notice-list-card">
          {all === null ? (
            <Loading label="문의를 불러오는 중…" />
          ) : items.length === 0 ? (
            <div className="notice-empty-state">
              <div className="notice-empty-ic" aria-hidden="true">💬</div>
              <p className="notice-empty-title">해당하는 문의가 없습니다.</p>
              <p className="notice-empty-sub">다른 상태 탭을 선택해 보세요.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table notice-table">
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>상태</th><th className="col-grow">제목</th><th style={{ width: 160 }}>업체</th>
                    <th style={{ width: 110 }}>작성자</th><th style={{ width: 60 }}>답변</th><th style={{ width: 140 }}>등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((q) => (
                    <tr key={q.inquiryId} className="row-clickable" onClick={() => openDetail(q.inquiryId)}>
                      <td><span className={`iq-badge ${STATUS[q.status]?.cls}`}>{STATUS[q.status]?.label}</span></td>
                      <td className="strong notice-cell-title">{q.title}{q.hasImages && <span className="iq-clip" aria-label="사진 첨부">📎</span>}</td>
                      <td className="muted-cell">{q.tenantName}</td>
                      <td className="muted-cell">{q.authorName}</td>
                      <td className="muted-cell">{q.replyCount || ''}</td>
                      <td className="muted-cell">{fmt(q.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detail && (
        <AnswerModal
          detail={detail}
          onClose={() => setDetail(null)}
          onChanged={(updated) => { setDetail(updated); load() }}
          onError={setError}
        />
      )}
    </Shell>
  )
}

function AnswerModal({ detail, onClose, onChanged, onError }) {
  const [content, setContent] = useState('')
  const [urls, setUrls] = useState([])
  const [saving, setSaving] = useState(false)
  const closed = detail.status === 'CLOSED'

  async function submit(e) {
    e.preventDefault()
    if (!content.trim()) { onError('답변 내용을 입력하세요.'); return }
    setSaving(true)
    try {
      const updated = await inquiryApi.reply(detail.inquiryId, { content, imageUrls: urls })
      setContent(''); setUrls([]); onChanged(updated)
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }
  async function close() {
    try { onChanged(await inquiryApi.close(detail.inquiryId)) }
    catch (e) { onError(e.message) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal iq-modal" onClick={(e) => e.stopPropagation()}>
        <div className="iq-modal-head">
          <div>
            <span className={`iq-badge ${STATUS[detail.status]?.cls}`}>{STATUS[detail.status]?.label}</span>
            <span className="iq-modal-tenant">{detail.tenantName}</span>
          </div>
          <button className="btn-ghost btn-sm" onClick={onClose}>닫기</button>
        </div>
        <h3 className="iq-title">{detail.title}</h3>

        <div className="iq-thread iq-thread-scroll">
          <Bubble side="left" name={detail.authorName} content={detail.content} images={detail.imageUrls} at={detail.createdAt} />
          {detail.replies.map((r) => (
            <Bubble
              key={r.replyId}
              side={r.authorType === 'ADMIN' ? 'right' : 'left'}
              name={r.authorName}
              badge={r.authorType === 'ADMIN' ? { label: '관리자', cls: 'admin' } : { label: '업체', cls: 'tenant' }}
              content={r.content}
              images={r.imageUrls}
              at={r.createdAt}
            />
          ))}
        </div>

        {closed ? (
          <p className="iq-closed">종료된 문의입니다.</p>
        ) : (
          <form className="iq-replybox" onSubmit={submit}>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} rows={3} placeholder="답변을 입력하세요." autoFocus />
            <ImageAttach urls={urls} setUrls={setUrls} onError={onError} />
            <div className="iq-modal-actions">
              <button type="button" className="btn-ghost btn-sm" onClick={close}>문의 종료</button>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? '등록 중…' : '답변 등록'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
