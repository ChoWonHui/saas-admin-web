import { useCallback, useEffect, useRef, useState } from 'react'
import { fileApi, noticeApi } from '../api/client'
import Shell from '../components/Shell'

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
      {error && <p className="alert">{error}</p>}
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
          <p className="muted notice-empty">불러오는 중…</p>
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

/** contentEditable 기반 미니 리치 에디터 (굵게/색상/글자크기/정렬/목록/이미지). */
function RichEditor({ value, onChange }) {
  const ref = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || ''
    // 마운트 시 1회만 초기 HTML 주입 (이후엔 contentEditable 이 소유)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sync = () => onChange(ref.current.innerHTML)
  const exec = (cmd, arg) => { ref.current.focus(); document.execCommand(cmd, false, arg); sync() }

  // 이미지 파일 → S3 업로드 후 CDN URL 로 삽입 (버튼·드래그앤드랍·붙여넣기 공용).
  //
  // 본문 HTML 에 base64 를 박지 않는다: 먼저 base64 미리보기를 그 자리에 끼워 넣어
  // 사용자가 즉시 이미지를 보게 하고, 업로드가 끝나면 그 <img> 의 src 를 CDN URL 로 바꾼다.
  // 업로드가 실패하거나 저장소가 꺼져 있으면 base64 를 그대로 남긴다 → 에디터는 항상 동작한다.
  const uploadSeq = useRef(0)
  function insertImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const id = `imgup${Date.now()}x${uploadSeq.current++}`
      ref.current.focus()
      document.execCommand(
        'insertHTML',
        false,
        `<img id="${id}" src="${reader.result}" style="max-width:100%" />`,
      )
      sync()
      fileApi
        .uploadImage(file)
        .then(({ url }) => {
          const el = ref.current?.querySelector(`#${id}`)
          if (el) { el.setAttribute('src', url); el.removeAttribute('id') }
          sync()
        })
        .catch((err) => {
          // 저장소 비활성/실패 시 base64 로 폴백. id 표시만 걷어낸다.
          console.warn('이미지 업로드 실패 — base64 로 대체합니다.', err)
          const el = ref.current?.querySelector(`#${id}`)
          if (el) el.removeAttribute('id')
        })
    }
    reader.readAsDataURL(file)
  }

  function onImage(e) {
    insertImageFile(e.target.files[0])
    e.target.value = ''
  }

  // 이미지를 에디터에 끌어다 놓으면 그 자리에 삽입한다.
  const [dragOver, setDragOver] = useState(false)
  function onDrop(e) {
    const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    e.preventDefault()
    setDragOver(false)
    files.forEach(insertImageFile)
  }
  // 클립보드 이미지 붙여넣기(Ctrl+V)도 지원한다.
  function onPaste(e) {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    insertImageFile(item.getAsFile())
  }

  // 툴바 버튼은 mousedown 을 막아 에디터의 선택 영역을 잃지 않게 한다.
  const noBlur = (e) => e.preventDefault()

  // --- 에디터 안 이미지 편집(리사이즈/삭제) ---
  const canvasRef = useRef(null)
  const [selImg, setSelImg] = useState(null) // 선택된 img 엘리먼트
  const [, tick] = useState(0)
  const redraw = () => tick((t) => t + 1)

  // 스크롤/리사이즈되면 오버레이 위치를 다시 계산한다.
  useEffect(() => {
    if (!selImg) return
    window.addEventListener('scroll', redraw, true)
    window.addEventListener('resize', redraw)
    return () => { window.removeEventListener('scroll', redraw, true); window.removeEventListener('resize', redraw) }
  }, [selImg])

  // 에디터를 클릭하면 이미지면 선택, 아니면 해제.
  function onBodyClick(e) {
    setSelImg(e.target.tagName === 'IMG' ? e.target : null)
  }

  function overlayBox() {
    if (!selImg || !canvasRef.current) return null
    const ir = selImg.getBoundingClientRect()
    const cr = canvasRef.current.getBoundingClientRect()
    return { left: ir.left - cr.left, top: ir.top - cr.top, width: ir.width, height: ir.height }
  }

  function startResize(e) {
    e.preventDefault(); e.stopPropagation()
    const img = selImg
    const startX = e.clientX
    const startW = img.getBoundingClientRect().width
    const maxW = ref.current.clientWidth - 4
    function move(ev) {
      let w = Math.max(40, Math.min(startW + (ev.clientX - startX), maxW))
      img.style.width = `${Math.round(w)}px`
      img.style.height = 'auto'
      redraw()
    }
    function up() {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      sync()
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function resizePreset(pct) {
    if (!selImg) return
    selImg.style.width = `${pct}%`
    selImg.style.height = 'auto'
    redraw(); sync()
  }
  function deleteImg() {
    if (!selImg) return
    selImg.remove()
    setSelImg(null)
    sync()
  }

  const box = overlayBox()

  return (
    <div className="editor">
      <div className="editor-toolbar" onMouseDown={noBlur}>
        <button type="button" onClick={() => exec('bold')} title="굵게"><b>B</b></button>
        <button type="button" onClick={() => exec('italic')} title="기울임"><i>I</i></button>
        <button type="button" onClick={() => exec('underline')} title="밑줄"><u>U</u></button>
        <span className="editor-sep" />
        <label className="editor-color" title="글자색">
          <span>색</span>
          <input type="color" onChange={(e) => exec('foreColor', e.target.value)} />
        </label>
        <select className="editor-size" title="글자 크기" defaultValue="3" onChange={(e) => exec('fontSize', e.target.value)}>
          <option value="1">아주 작게</option>
          <option value="2">작게</option>
          <option value="3">보통</option>
          <option value="5">크게</option>
          <option value="6">더 크게</option>
          <option value="7">아주 크게</option>
        </select>
        <span className="editor-sep" />
        <button type="button" onClick={() => exec('justifyLeft')} title="왼쪽">⯇</button>
        <button type="button" onClick={() => exec('justifyCenter')} title="가운데">≡</button>
        <button type="button" onClick={() => exec('justifyRight')} title="오른쪽">⯈</button>
        <button type="button" onClick={() => exec('insertUnorderedList')} title="목록">•≣</button>
        <span className="editor-sep" />
        <button type="button" className="editor-icon" onClick={() => fileRef.current.click()} title="사진 넣기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2.5" />
            <circle cx="8.5" cy="8.5" r="1.6" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </button>
      </div>
      <div className="editor-canvas" ref={canvasRef}>
        <div
          ref={ref}
          className={`editor-body${dragOver ? ' drag-over' : ''}`}
          contentEditable
          suppressContentEditableWarning
          onInput={() => { sync(); if (selImg && !selImg.isConnected) setSelImg(null) }}
          onClick={onBodyClick}
          onDrop={onDrop}
          onDragOver={(e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) { e.preventDefault(); setDragOver(true) } }}
          onDragLeave={() => setDragOver(false)}
          onPaste={onPaste}
        />
        {/* 선택된 이미지 위 편집 오버레이 (크기 조절 핸들 + 프리셋 + 삭제) */}
        {box && (
          <div className="img-overlay" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
            <div className="img-tools" onMouseDown={noBlur}>
              <button type="button" onClick={() => resizePreset(25)} title="25%">S</button>
              <button type="button" onClick={() => resizePreset(50)} title="50%">M</button>
              <button type="button" onClick={() => resizePreset(100)} title="100%">L</button>
              <button type="button" className="img-del" onClick={deleteImg} title="이미지 삭제">✕</button>
            </div>
            <span className="img-handle" onMouseDown={startResize} title="드래그로 크기 조절" />
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onImage} />
    </div>
  )
}
