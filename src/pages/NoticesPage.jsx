import { useCallback, useEffect, useRef, useState } from 'react'
import Toast from '../components/Toast'
import { noticeApi } from '../api/client'
import Shell from '../components/Shell'
import RichEditor from '../components/RichEditor'
import Loading from '../components/Loading'

function fmt(dt) {
  return dt ? dt.slice(0, 16).replace('T', ' ') : '-'
}

export default function NoticesPage() {
  const [mode, setMode] = useState('list') // list | detail | edit
  const [detail, setDetail] = useState(null) // 상세 데이터
  const [editTarget, setEditTarget] = useState(null) // 수정 대상(신규면 null)
  const [error, setError] = useState('')

  function openList() { setMode('list'); setDetail(null); setEditTarget(null) }

  async function openDetail(id) {
    setError('')
    try {
      setDetail(await noticeApi.get(id))
      setMode('detail')
    } catch (e) { setError(e.message) }
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

/** 목록 */
function NoticeList({ onOpen, onNew, onError }) {
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 0, number: 0 })
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [likesFor, setLikesFor] = useState(null) // 좋아요 모달을 띄운 공지 { id, title }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await noticeApi.list({ keyword: query, page, size: 10 }))
    } catch (e) { onError(e.message) } finally { setLoading(false) }
  }, [query, page, onError])

  useEffect(() => { load() }, [load])

  const pinnedCount = data.content.filter((n) => n.pinned).length
  const searching = query.trim().length > 0

  return (
    <div className="notice-page">
      {/* 상단 배너 — 아이콘 + 제목 + 설명 + 검색/글쓰기 */}
      <div className="notice-hero">
        <div className="notice-hero-icon" aria-hidden="true">📢</div>
        <div className="notice-hero-text">
          <h2>공지사항</h2>
          <p>사내 공지와 안내사항을 한곳에서 확인하세요.</p>
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

      {/* 요약 카드 */}
      <div className="notice-stats">
        <div className="stat-card">
          <span className="stat-num">{loading ? '–' : data.totalElements}</span>
          <span className="stat-label">전체 공지</span>
        </div>
        <div className="stat-card">
          <span className="stat-num stat-accent">{loading ? '–' : pinnedCount}</span>
          <span className="stat-label">고정 공지</span>
        </div>
      </div>

      {/* 목록 카드 */}
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
                  <th style={{ width: 90 }}>좋아요</th>
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
                    <td className="muted-cell">
                      {n.likeCount > 0 ? (
                        <button
                          type="button"
                          className="like-chip"
                          title="좋아요한 사람 보기"
                          onClick={(e) => { e.stopPropagation(); setLikesFor({ id: n.id, title: n.title }) }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
                          </svg>
                          {n.likeCount}
                        </button>
                      ) : (
                        <span className="like-chip-zero">0</span>
                      )}
                    </td>
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

      {likesFor && (
        <NoticeLikesModal notice={likesFor} onClose={() => setLikesFor(null)} onError={onError} />
      )}
    </div>
  )
}

/** 좋아요한 사람 목록 모달 — 부서명 · 이름(사번) · 누른 시각 */
function NoticeLikesModal({ notice, onClose, onError }) {
  const [users, setUsers] = useState(null) // null=로딩중

  useEffect(() => {
    let alive = true
    noticeApi.likeUsers(notice.id)
      .then((list) => { if (alive) setUsers(list) })
      .catch((e) => { if (alive) { setUsers([]); onError(e.message) } })
    return () => { alive = false }
  }, [notice.id, onError])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal likes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="likes-modal-head">
          <h3>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#e0245e" aria-hidden="true">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
            좋아요 {users ? users.length : ''}
          </h3>
          <button type="button" className="likes-modal-x" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <p className="likes-modal-sub">{notice.title}</p>

        {users === null ? (
          <p className="muted likes-loading">불러오는 중…</p>
        ) : users.length === 0 ? (
          <p className="likes-empty">아직 좋아요한 사람이 없습니다.</p>
        ) : (
          <ul className="likes-list">
            {users.map((u) => (
              <li key={u.empNo} className="likes-item">
                <div className="likes-item-body">
                  <div className="likes-item-top">
                    <span className="likes-dept">{u.department || '부서 미지정'}</span>
                    <span className="likes-name">{u.name}({u.empNo})</span>
                  </div>
                  <span className="likes-date">{fmt(u.likedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** 상세 */
function NoticeDetailView({ detail, onBack, onEdit, onDeleted, onError }) {
  const [confirm, setConfirm] = useState(false)

  // 좋아요 — 서버가 준 초기값에서 시작해 토글 결과로 갱신
  const [liked, setLiked] = useState(detail.liked)
  const [likeCount, setLikeCount] = useState(detail.likeCount)
  const [liking, setLiking] = useState(false)

  async function toggleLike() {
    if (liking) return
    setLiking(true)
    // 낙관적 업데이트
    const prev = { liked, likeCount }
    setLiked(!liked)
    setLikeCount(likeCount + (liked ? -1 : 1))
    try {
      const r = await noticeApi.toggleLike(detail.id)
      setLiked(r.liked); setLikeCount(r.likeCount)
    } catch (e) {
      setLiked(prev.liked); setLikeCount(prev.likeCount)
      onError(e.message)
    } finally { setLiking(false) }
  }

  async function remove() {
    try {
      await noticeApi.remove(detail.id)
      onDeleted()
    } catch (e) { onError(e.message) }
  }
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
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                수정
              </button>
              <button className="btn-action btn-action-danger" onClick={() => setConfirm(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
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
          {detail.authorName} · {fmt(detail.createdAt)} · 조회 {detail.viewCount} · 좋아요 {likeCount}
        </div>
        {/* 본문은 사내 관리자만 작성하는 에디터 HTML 이다. */}
        <div className="notice-content" dangerouslySetInnerHTML={{ __html: detail.content }} />

        {/* 좋아요 버튼 */}
        <div className="notice-like-bar">
          <button
            type="button"
            className={`like-btn${liked ? ' on' : ''}`}
            onClick={toggleLike}
            disabled={liking}
            aria-pressed={liked}
          >
            <svg width="18" height="18" viewBox="0 0 24 24"
                 fill={liked ? 'currentColor' : 'none'} stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
            좋아요 <span className="like-count">{likeCount}</span>
          </button>
        </div>
      </article>

      <NoticeComments noticeId={detail.id} onError={onError} />

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

/** 댓글 영역 — 목록 + 작성 + 삭제 */
function NoticeComments({ noticeId, onError }) {
  const [comments, setComments] = useState(null) // null=로딩중
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const [delId, setDelId] = useState(null) // 삭제 확인 대상

  const load = useCallback(async () => {
    try {
      setComments(await noticeApi.comments(noticeId))
    } catch (e) { onError(e.message); setComments([]) }
  }, [noticeId, onError])

  useEffect(() => { load() }, [load])

  async function submit(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content || posting) return
    setPosting(true)
    try {
      await noticeApi.addComment(noticeId, content)
      setText('')
      await load()
    } catch (e) { onError(e.message) } finally { setPosting(false) }
  }

  async function remove(id) {
    try {
      await noticeApi.removeComment(id)
      setDelId(null)
      await load()
    } catch (e) { onError(e.message) }
  }

  const count = comments?.length ?? 0

  return (
    <section className="comments">
      <h3 className="comments-head">
        댓글 <span className="comments-count">{count}</span>
      </h3>

      {/* 목록 — 작성된 댓글을 위에서 본다 */}
      {comments === null ? (
        <p className="muted comment-loading">불러오는 중…</p>
      ) : count === 0 ? (
        <p className="comment-empty">첫 번째 댓글을 남겨보세요.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <div className="comment-body">
                <div className="comment-top">
                  <span className="comment-author">{c.authorName}</span>
                  <span className="comment-date">{fmt(c.createdAt)}</span>
                  {c.deletable && (
                    <button type="button" className="comment-del" onClick={() => setDelId(c.id)} title="삭제">
                      삭제
                    </button>
                  )}
                </div>
                <p className="comment-text">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 작성 — 목록 아래에 둔다 */}
      <form className="comment-form comment-form-bottom" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="댓글을 입력하세요…"
          maxLength={1000}
          rows={2}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e) }}
        />
        <div className="comment-form-foot">
          <span className="comment-hint">Ctrl+Enter 로 등록</span>
          <button type="submit" className="btn-primary btn-sm" disabled={posting || !text.trim()}>
            {posting ? '등록 중…' : '댓글 등록'}
          </button>
        </div>
      </form>

      {delId !== null && (
        <div className="modal-backdrop" onClick={() => setDelId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>댓글 삭제</h3>
            <p className="confirm-text">이 댓글을 삭제하시겠습니까?</p>
            <div className="dialog-actions">
              <button className="btn-ghost" onClick={() => setDelId(null)}>취소</button>
              <button className="btn-primary btn-danger-solid" onClick={() => remove(delId)}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/** 작성/수정 — 리치 에디터 */
function NoticeEditor({ target, onCancel, onSaved, onError }) {
  const [title, setTitle] = useState(target?.title ?? '')
  const [pinned, setPinned] = useState(target?.pinned ?? false)
  const [content, setContent] = useState(target?.content ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) { onError('제목을 입력하세요.'); return }
    if (!content.replace(/<[^>]*>/g, '').trim() && !content.includes('<img')) { onError('내용을 입력하세요.'); return }
    setSaving(true)
    try {
      const body = { title, content, pinned }
      const saved = target ? await noticeApi.update(target.id, body) : await noticeApi.create(body)
      onSaved(saved)
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="notice-edit">
      <div className="page-head">
        <h2>{target ? '공지 수정' : '공지 작성'}</h2>
        <div className="page-actions">
          <label className="check">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            상단 고정
          </label>
          <button className="btn-ghost btn-sm" onClick={onCancel}>취소</button>
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? '저장 중…' : '💾 저장'}</button>
        </div>
      </div>

      <input
        className="notice-title-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        maxLength={200}
      />
      <RichEditor value={content} onChange={setContent} />
    </div>
  )
}

