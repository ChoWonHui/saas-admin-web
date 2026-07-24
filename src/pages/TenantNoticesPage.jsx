import { useCallback, useEffect, useState } from 'react'
import Shell from '../components/Shell'
import Toast from '../components/Toast'
import Loading from '../components/Loading'
import RichEditor from '../components/RichEditor'
import { fileApi, tenantNoticeApi } from '../api/client'

function fmt(dt) { return dt ? dt.slice(0, 16).replace('T', ' ') : '-' }
function toInput(dt) { return dt ? dt.slice(0, 16) : '' } // ISO → datetime-local 값

/** 업체 공지사항 관리(관리자) — 사내 공지사항과 동일한 디자인. 상단 고정 + 팝업(기간) 추가. */
export default function TenantNoticesPage() {
  const [mode, setMode] = useState('list') // list | detail | edit
  const [detail, setDetail] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [error, setError] = useState('')

  function openList() { setMode('list'); setDetail(null); setEditTarget(null) }
  async function openDetail(id) {
    setError('')
    try { setDetail(await tenantNoticeApi.get(id)); setMode('detail') }
    catch (e) { setError(e.message) }
  }

  return (
    <Shell>
      <Toast message={error} onClose={() => setError('')} />
      {mode === 'list' && (
        <NoticeList onOpen={openDetail} onNew={() => { setEditTarget(null); setMode('edit') }} onError={setError} />
      )}
      {mode === 'detail' && detail && (
        <NoticeDetailView
          detail={detail}
          onBack={openList}
          onEdit={() => { setEditTarget(detail); setMode('edit') }}
          onDeleted={openList}
          onError={setError}
        />
      )}
      {mode === 'edit' && (
        <NoticeEditor
          target={editTarget}
          onCancel={() => (editTarget ? openDetail(editTarget.id) : openList())}
          onSaved={(saved) => { setDetail(saved); setMode('detail') }}
          onError={setError}
        />
      )}
    </Shell>
  )
}

/** 목록 — 사내 공지와 동일한 히어로 + 요약카드 + 표. */
function NoticeList({ onOpen, onNew, onError }) {
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 0, number: 0 })
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await tenantNoticeApi.list({ keyword: query, page, size: 10 })) }
    catch (e) { onError(e.message) } finally { setLoading(false) }
  }, [query, page, onError])
  useEffect(() => { load() }, [load])

  const pinnedCount = data.content.filter((n) => n.pinned).length
  const popupCount = data.content.filter((n) => n.popupEnabled).length
  const searching = query.trim().length > 0

  return (
    <div className="notice-page">
      <div className="notice-hero">
        <div className="notice-hero-icon" aria-hidden="true">📢</div>
        <div className="notice-hero-text">
          <h2>업체 공지사항</h2>
          <p>업체(사장님)에게 노출되는 공지를 등록·관리하세요.</p>
        </div>
        <div className="notice-hero-actions">
          <form onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(keyword) }} className="notice-search">
            <span className="notice-search-ic" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
            </span>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="제목 검색" />
          </form>
          <button className="btn-primary btn-sm notice-new" onClick={onNew}>+ 글쓰기</button>
        </div>
      </div>

      <div className="notice-stats">
        <div className="stat-card">
          <span className="stat-num">{loading ? '–' : data.totalElements}</span>
          <span className="stat-label">전체 공지</span>
        </div>
        <div className="stat-card">
          <span className="stat-num stat-accent">{loading ? '–' : pinnedCount}</span>
          <span className="stat-label">고정 공지</span>
        </div>
        <div className="stat-card">
          <span className="stat-num stat-accent">{loading ? '–' : popupCount}</span>
          <span className="stat-label">팝업 공지</span>
        </div>
      </div>

      <div className="card notice-list-card">
        {loading ? (
          <Loading label="공지를 불러오는 중…" />
        ) : data.content.length === 0 ? (
          <div className="notice-empty-state">
            <div className="notice-empty-ic" aria-hidden="true">🗒️</div>
            <p className="notice-empty-title">{searching ? '검색 결과가 없습니다.' : '아직 등록된 공지가 없습니다.'}</p>
            <p className="notice-empty-sub">
              {searching ? '다른 검색어로 다시 시도해 보세요.' : '첫 번째 공지를 작성해 보세요.'}
            </p>
            {!searching && <button className="btn-primary btn-sm" onClick={onNew}>+ 공지 작성</button>}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table notice-table">
              <thead>
                <tr>
                  <th style={{ width: 72 }}>번호</th>
                  <th className="col-grow">제목</th>
                  <th style={{ width: 120 }}>작성자</th>
                  <th style={{ width: 70 }}>조회</th>
                  <th style={{ width: 90 }}>팝업</th>
                  <th style={{ width: 140 }}>작성일</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((n) => (
                  <tr key={n.id} className="row-clickable" onClick={() => onOpen(n.id)}>
                    <td className="muted-cell">{n.pinned ? <span className="badge badge-active">고정</span> : n.id}</td>
                    <td className="strong notice-cell-title">{n.title}</td>
                    <td className="muted-cell">{n.authorName}</td>
                    <td className="muted-cell">{n.viewCount}</td>
                    <td className="muted-cell">{n.popupEnabled ? <span className="badge badge-active">팝업</span> : ''}</td>
                    <td className="muted-cell">{fmt(n.createdAt)}</td>
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
    </div>
  )
}

/** 상세 — 사내 공지와 동일. 좋아요 대신 팝업 정보 표시. */
function NoticeDetailView({ detail, onBack, onEdit, onDeleted, onError }) {
  const [confirm, setConfirm] = useState(false)

  async function remove() {
    try { await tenantNoticeApi.remove(detail.id); onDeleted() }
    catch (e) { onError(e.message) }
  }

  const popupInfo = detail.popupEnabled
    ? (detail.popupStartAt || detail.popupEndAt ? `${fmt(detail.popupStartAt)} ~ ${fmt(detail.popupEndAt)}` : '상시')
    : null

  return (
    <>
      <div className="page-head">
        <button className="btn-ghost btn-sm" onClick={onBack}>← 목록</button>
        <div className="page-actions">
          {detail.editable && (
            <>
              <button className="btn-action" onClick={onEdit}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                수정
              </button>
              <button className="btn-action btn-action-danger" onClick={() => setConfirm(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
                </svg>
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      <article className="notice-detail">
        <h1 className="notice-title">
          {detail.pinned && <span className="badge badge-active">고정</span>} {detail.title}
        </h1>
        <div className="notice-meta">
          {detail.authorName} · {fmt(detail.createdAt)} · 조회 {detail.viewCount}
          {popupInfo && <> · <span className="badge badge-active">팝업 {popupInfo}</span></>}
        </div>
        <div className="notice-content" dangerouslySetInnerHTML={{ __html: detail.content }} />
      </article>

      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>공지 삭제</h3>
            <p className="confirm-text"><strong>{detail.title}</strong> 공지를 삭제하시겠습니까?</p>
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

/** 작성/수정 — 사내 공지 에디터와 동일 + 팝업(기간). */
function NoticeEditor({ target, onCancel, onSaved, onError }) {
  const [title, setTitle] = useState(target?.title ?? '')
  const [pinned, setPinned] = useState(target?.pinned ?? false)
  const [popupEnabled, setPopupEnabled] = useState(target?.popupEnabled ?? false)
  const [popupStart, setPopupStart] = useState(toInput(target?.popupStartAt))
  const [popupEnd, setPopupEnd] = useState(toInput(target?.popupEndAt))
  const [content, setContent] = useState(target?.content ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) { onError('제목을 입력하세요.'); return }
    if (!content.replace(/<[^>]*>/g, '').trim() && !content.includes('<img')) { onError('내용을 입력하세요.'); return }
    if (popupEnabled && popupStart && popupEnd && popupStart > popupEnd) { onError('팝업 종료가 시작보다 빠릅니다.'); return }
    setSaving(true)
    try {
      const body = {
        title, content, pinned, popupEnabled,
        popupStartAt: popupEnabled && popupStart ? popupStart : null,
        popupEndAt: popupEnabled && popupEnd ? popupEnd : null,
      }
      const saved = target ? await tenantNoticeApi.update(target.id, body) : await tenantNoticeApi.create(body)
      onSaved(saved)
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="notice-edit">
      <div className="page-head">
        <h2>{target ? '업체 공지 수정' : '업체 공지 작성'}</h2>
        <div className="page-actions">
          <label className="check">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 상단 고정
          </label>
          <label className="check">
            <input type="checkbox" checked={popupEnabled} onChange={(e) => setPopupEnabled(e.target.checked)} /> 팝업으로 띄우기
          </label>
          <button className="btn-ghost btn-sm" onClick={onCancel}>취소</button>
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? '저장 중…' : '💾 저장'}</button>
        </div>
      </div>

      <input className="notice-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목" maxLength={200} />

      {popupEnabled && (
        <div className="tn-options">
          <span className="tn-period">
            <label>팝업 시작 <input type="datetime-local" value={popupStart} onChange={(e) => setPopupStart(e.target.value)} /></label>
            <label>종료 <input type="datetime-local" value={popupEnd} onChange={(e) => setPopupEnd(e.target.value)} /></label>
            <span className="field-hint">비우면 팝업이 켜져 있는 동안 상시 노출됩니다.</span>
          </span>
        </div>
      )}

      <RichEditor value={content} onChange={setContent} uploadImage={fileApi.uploadImage} />
    </div>
  )
}
