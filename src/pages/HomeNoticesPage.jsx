import { useCallback, useEffect, useState } from 'react'
import Shell from '../components/Shell'
import Toast from '../components/Toast'
import Loading from '../components/Loading'
import RichEditor from '../components/RichEditor'
import { fileApi, homeNoticeApi } from '../api/client'

function fmt(dt) { return dt ? dt.slice(0, 16).replace('T', ' ') : '-' }

const FILTERS = [
  { key: 'ALL', label: '전체' },
  { key: 'PUBLISHED', label: '공개' },
  { key: 'DRAFT', label: '초안' },
]

/**
 * 홈페이지 공지사항 — 회사 사이트(kanchenjunga.co.kr/notice)에 나가는 글.
 *
 * 사내 공지(/notices)와 화면 구성은 같지만 대상이 다르다. 여기서 공개로 저장하면
 * 로그인하지 않은 방문자 누구나 본다. 그래서 목록·에디터 모두 "공개/초안"을 앞에 세운다.
 */
export default function HomeNoticesPage() {
  const [mode, setMode] = useState('list') // list | detail | edit
  const [detail, setDetail] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([])

  useEffect(() => {
    homeNoticeApi.categories().then(setCategories).catch(() => setCategories([]))
  }, [])

  function openList() { setMode('list'); setDetail(null); setEditTarget(null) }
  async function openDetail(id) {
    setError('')
    try { setDetail(await homeNoticeApi.get(id)); setMode('detail') }
    catch (e) { setError(e.message) }
  }

  return (
    <Shell>
      <Toast message={error} onClose={() => setError('')} />
      {mode === 'list' && (
        <NoticeList
          categories={categories}
          onOpen={openDetail}
          onNew={() => { setEditTarget(null); setMode('edit') }}
          onError={setError}
        />
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
          categories={categories}
          onCancel={() => (editTarget ? openDetail(editTarget.noticeId) : openList())}
          onSaved={(saved) => { setDetail(saved); setMode('detail') }}
          onError={setError}
        />
      )}
    </Shell>
  )
}

function NoticeList({ categories, onOpen, onNew, onError }) {
  const [data, setData] = useState({
    content: [], totalElements: 0, totalPages: 0, page: 0, publishedCount: 0, draftCount: 0,
  })
  const [published, setPublished] = useState('ALL')
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await homeNoticeApi.list({ published, category, keyword: query, page, size: 10 })) }
    catch (e) { onError(e.message) } finally { setLoading(false) }
  }, [published, category, query, page, onError])
  useEffect(() => { load() }, [load])

  const searching = query.trim().length > 0

  return (
    <div className="notice-page">
      <div className="notice-hero">
        <div className="notice-hero-icon" aria-hidden="true">📰</div>
        <div className="notice-hero-text">
          <h2>홈페이지 공지</h2>
          <p>회사 사이트(kanchenjunga.co.kr/notice)에 공개되는 공지입니다.</p>
        </div>
        <div className="notice-hero-actions">
          <select value={published} onChange={(e) => { setPage(0); setPublished(e.target.value) }}>
            {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select value={category} onChange={(e) => { setPage(0); setCategory(e.target.value) }}>
            <option value="">분류 전체</option>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
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
          <span className="stat-label">이 조건의 글</span>
        </div>
        <div className="stat-card">
          <span className="stat-num stat-accent">{loading ? '–' : data.publishedCount}</span>
          <span className="stat-label">사이트 공개</span>
        </div>
        <div className="stat-card">
          <span className="stat-num">{loading ? '–' : data.draftCount}</span>
          <span className="stat-label">초안</span>
        </div>
      </div>

      <div className="card notice-list-card">
        {loading ? (
          <Loading label="공지를 불러오는 중…" />
        ) : data.content.length === 0 ? (
          <div className="notice-empty-state">
            <div className="notice-empty-ic" aria-hidden="true">🗒️</div>
            <p className="notice-empty-title">{searching ? '검색 결과가 없습니다.' : '등록된 공지가 없습니다.'}</p>
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
                  <th style={{ width: 70 }}>번호</th>
                  <th style={{ width: 90 }}>분류</th>
                  <th className="col-grow">제목</th>
                  <th style={{ width: 90 }}>공개</th>
                  <th style={{ width: 110 }}>작성자</th>
                  <th style={{ width: 70 }}>조회</th>
                  <th style={{ width: 140 }}>공개일</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map((n) => (
                  <tr key={n.noticeId} className="row-clickable" onClick={() => onOpen(n.noticeId)}>
                    <td className="muted-cell">
                      {n.pinned ? <span className="badge badge-active">고정</span> : n.noticeId}
                    </td>
                    <td className="muted-cell">{n.categoryLabel}</td>
                    <td className="strong notice-cell-title">{n.title}</td>
                    <td>
                      {n.published
                        ? <span className="badge badge-active">공개</span>
                        : <span className="badge badge-disabled">초안</span>}
                    </td>
                    <td className="muted-cell">{n.authorName}</td>
                    <td className="muted-cell">{n.viewCount}</td>
                    <td className="muted-cell">{n.published ? fmt(n.publishedAt) : '-'}</td>
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

function NoticeDetailView({ detail, onBack, onEdit, onDeleted, onError }) {
  const [confirm, setConfirm] = useState(false)

  async function remove() {
    try { await homeNoticeApi.remove(detail.noticeId); onDeleted() }
    catch (e) { onError(e.message) }
  }

  return (
    <>
      <div className="page-head">
        <button className="btn-ghost btn-sm" onClick={onBack}>← 목록</button>
        <div className="page-actions">
          {detail.published && (
            <a className="btn-action" href={`https://kanchenjunga.co.kr/notice/${detail.noticeId}`}
               target="_blank" rel="noreferrer">
              사이트에서 보기
            </a>
          )}
          <button className="btn-action" onClick={onEdit}>수정</button>
          <button className="btn-action btn-action-danger" onClick={() => setConfirm(true)}>삭제</button>
        </div>
      </div>

      <article className="notice-detail">
        <h1 className="notice-title">
          {detail.pinned && <span className="badge badge-active">고정</span>}{' '}
          {detail.published
            ? <span className="badge badge-active">공개</span>
            : <span className="badge badge-disabled">초안</span>}{' '}
          [{detail.categoryLabel}] {detail.title}
        </h1>
        <div className="notice-meta">
          {detail.authorName} · 작성 {fmt(detail.createdAt)}
          {detail.published && <> · 공개 {fmt(detail.publishedAt)}</>} · 조회 {detail.viewCount}
        </div>
        {/* 본문은 우리 관리자가 에디터로 쓴 HTML 이다(외부 입력이 아니다) — 사내 공지와 같은 방식. */}
        <div className="notice-content" dangerouslySetInnerHTML={{ __html: detail.content }} />
      </article>

      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>공지 삭제</h3>
            <p className="confirm-text"><strong>{detail.title}</strong> 공지를 삭제하시겠습니까?</p>
            {detail.published && <p className="muted">지금 회사 사이트에 공개돼 있는 글입니다.</p>}
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

function NoticeEditor({ target, categories, onCancel, onSaved, onError }) {
  const [category, setCategory] = useState(target?.category ?? '')
  const [title, setTitle] = useState(target?.title ?? '')
  const [pinned, setPinned] = useState(target?.pinned ?? false)
  const [content, setContent] = useState(target?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)

  // 분류 기본값은 첫 선택지. 비워 두면 저장 때 튕기기만 한다.
  useEffect(() => {
    if (!category && categories.length > 0) setCategory(categories[0].code)
  }, [categories, category])

  function validate() {
    if (!category) { onError('분류를 선택하세요.'); return false }
    if (!title.trim()) { onError('제목을 입력하세요.'); return false }
    if (!content.replace(/<[^>]*>/g, '').trim() && !content.includes('<img')) {
      onError('내용을 입력하세요.'); return false
    }
    return true
  }

  async function save(published) {
    if (!validate()) return
    setSaving(true)
    try {
      const body = { category, title, content, pinned, published }
      const saved = target
        ? await homeNoticeApi.update(target.noticeId, body)
        : await homeNoticeApi.create(body)
      onSaved(saved)
    } catch (e) { onError(e.message) } finally { setSaving(false); setConfirmPublish(false) }
  }

  return (
    <div className="notice-edit">
      <div className="page-head">
        <h2>{target ? '홈페이지 공지 수정' : '홈페이지 공지 작성'}</h2>
        <div className="page-actions">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.length === 0 && <option value="">분류 없음</option>}
            {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
          <label className="check">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 상단 고정
          </label>
          <button className="btn-ghost btn-sm" onClick={onCancel}>취소</button>
          <button className="btn-ghost btn-sm" onClick={() => save(false)} disabled={saving}>
            {saving ? '저장 중…' : '초안 저장'}
          </button>
          {/* 공개는 되돌리기 어렵다(방문자가 이미 봤을 수 있다) — 한 번 더 묻는다. */}
          <button className="btn-primary btn-sm" onClick={() => setConfirmPublish(true)} disabled={saving}>
            사이트에 공개
          </button>
        </div>
      </div>

      <p className="muted" style={{ margin: '0 0 12px' }}>
        초안은 우리만 봅니다. 공개하면 로그인 없이 누구나 kanchenjunga.co.kr/notice 에서 볼 수 있습니다.
      </p>

      <input
        className="notice-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        maxLength={200}
      />

      <RichEditor value={content} onChange={setContent} uploadImage={fileApi.uploadImage} />

      {confirmPublish && (
        <div className="modal-backdrop" onClick={() => setConfirmPublish(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>사이트에 공개</h3>
            <p className="confirm-text"><strong>{title || '(제목 없음)'}</strong> 공지를 회사 사이트에 공개합니다.</p>
            <p className="muted">공개하면 로그인하지 않은 방문자 누구나 볼 수 있습니다.</p>
            <div className="dialog-actions">
              <button className="btn-ghost" onClick={() => setConfirmPublish(false)}>취소</button>
              <button className="btn-primary" onClick={() => save(true)} disabled={saving}>공개</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
