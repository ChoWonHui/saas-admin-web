import { useCallback, useEffect, useRef, useState } from 'react'
import Shell from '../components/Shell'
import Toast from '../components/Toast'
import Loading from '../components/Loading'
import RichEditor from '../components/RichEditor'
import { fileApi, mailboxApi } from '../api/client'

function fmt(dt) {
  if (!dt) return '-'
  const today = new Date().toISOString().slice(0, 10)
  const time = dt.slice(11, 16) // HH:MM
  // 오늘 → 시각만, 올해 → MM.DD HH:MM, 그 이전 → YYYY.MM.DD HH:MM (네이버처럼 날짜+시간).
  if (dt.slice(0, 10) === today) return time
  if (dt.slice(0, 4) === String(new Date().getFullYear())) return `${dt.slice(5, 7)}.${dt.slice(8, 10)} ${time}`
  return `${dt.slice(0, 4)}.${dt.slice(5, 7)}.${dt.slice(8, 10)} ${time}`
}

function sizeText(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// 숫자 페이저에 보여줄 페이지 창(현재 페이지 주변 최대 5개). 0-based 인덱스를 돌려준다.
function pageWindow(cur, total, span = 5) {
  let start = Math.max(0, cur - Math.floor(span / 2))
  const end = Math.min(total, start + span)
  start = Math.max(0, end - span)
  return Array.from({ length: end - start }, (_, i) => start + i)
}

// 첨부 파일 확장자 배지(GIF/PNG/PDF …). 확장자가 없으면 FILE.
function extBadge(name) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name || '')
  return m ? m[1].toUpperCase() : 'FILE'
}

// 폴더별 아이콘(콘솔이 쓰는 Material Symbols). 네이버처럼 메뉴 왼쪽에 아이콘을 둔다.
function folderIcon(folder) {
  switch (folder) {
    case 'INBOX': return 'inbox'
    case 'SENT': return 'send'
    case 'DRAFT': return 'draft'
    case 'TRASH': return 'delete'
    default: return 'folder'
  }
}

/** 주소 문자열("a@x.com, b@y.com")을 칩 배열로. 답장·임시보관에서 넘어온 값을 푸는 데 쓴다. */
function parseAddresses(raw) {
  if (!raw) return []
  return raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
}

/** 메일 주소로 볼 수 있는가. 엄밀한 RFC 검증이 아니라 오타를 잡아 주는 정도다. */
function looksLikeEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)
}

/**
 * 관리자 메일함.
 *
 * 받은 메일의 원본은 메일 서버에 있고, 백엔드가 IMAP 으로 가져와 DB 에 쌓아 둔 것을 여기서 읽는다.
 * 보내기는 Brevo SMTP 를 거치며 발신 주소는 로그인한 관리자의 사번 주소가 된다.
 *
 * 배치는 네이버 메일을 참고했다(폴더 내비 / 목록 상단 액션 툴바 + 일괄선택 / 읽기 툴바:
 * 답장·전체답장·전달·이동·삭제 + 이전·다음 / 작성: 참조·숨은참조). 색과 컴포넌트는 이 콘솔 체계 그대로다.
 */
export default function MailboxPage() {
  const [me, setMe] = useState(null)
  const [folders, setFolders] = useState([])
  const [folder, setFolder] = useState('INBOX')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [detail, setDetail] = useState(null)
  const [compose, setCompose] = useState(null) // { to, cc, bcc, subject, content, draftId }
  const [listIds, setListIds] = useState([]) // 현재 목록의 메일 id 순서 — 읽기 화면의 이전/다음에 쓴다

  useEffect(() => {
    mailboxApi.me().then(setMe).catch((e) => setError(e.message))
  }, [])

  const loadFolders = useCallback(() => {
    mailboxApi.folders().then(setFolders).catch(() => setFolders([]))
  }, [])
  useEffect(() => { loadFolders() }, [loadFolders])

  const open = useCallback(async (id) => {
    try { setDetail(await mailboxApi.get(id)); loadFolders() }
    catch (e) { setError(e.message) }
  }, [loadFolders])

  // 임시보관 통수(작성 화면 헤더에 표시). 폴더 목록에서 DRAFT 총계를 쓴다.
  const draftCount = folders.find((f) => f.folder === 'DRAFT')?.total ?? 0
  const openCompose = () => { setDetail(null); setCompose({ to: '', cc: '', bcc: '', subject: '', content: '' }) }
  // 내게쓰기 — 받는 사람을 내 주소로 채워 연다.
  const openSelf = () => { setDetail(null); setCompose({ to: me?.address || '', cc: '', bcc: '', subject: '', content: '' }) }

  // 읽기 화면의 이전/다음 — 목록 순서에서 이웃 메일을 연다.
  const openIndex = detail ? listIds.indexOf(detail.mailId) : -1
  const prevId = openIndex > 0 ? listIds[openIndex - 1] : null
  const nextId = openIndex >= 0 && openIndex < listIds.length - 1 ? listIds[openIndex + 1] : null

  return (
    <Shell>
      <Toast message={error} onClose={() => setError('')} />
      <Toast message={notice} onClose={() => setNotice('')} />

      <div className="page-head">
        <h2>메일함</h2>
        {me && <span className="count">{me.name} · {me.address}</span>}
        <div className="page-actions">
          <button
            className="btn-ghost btn-sm"
            onClick={async () => {
              try {
                const n = await mailboxApi.syncNow()
                setNotice(n > 0 ? `새 메일 ${n}통을 가져왔습니다.` : '새 메일이 없습니다.')
                loadFolders()
              } catch (e) { setError(e.message) }
            }}
          >
            새로고침
          </button>
        </div>
      </div>

      <div className="mail-layout">
        <nav className="mail-side">
          {/* 상단 작성 버튼 */}
          <div className="mail-side-write">
            <button type="button" className="ms-write" onClick={openCompose}>
              <span className="material-symbols-outlined">edit_square</span> 메일쓰기
            </button>
            <button type="button" className="ms-write2" onClick={openSelf}>
              <span className="material-symbols-outlined">person</span> 내게쓰기
            </button>
          </div>
          {/* 메일함 목록 — 목록/상세/작성이 공통으로 쓰는 내비게이션 */}
          <div className="ms-nav">
            {folders.map((f) => (
              <button
                key={f.folder}
                type="button"
                className={`ms-folder${folder === f.folder ? ' on' : ''}`}
                onClick={() => { setFolder(f.folder); setDetail(null); setCompose(null) }}
              >
                <span className="ms-folder-l">
                  <span className="material-symbols-outlined ms-folder-ic">{folderIcon(f.folder)}</span>
                  <span className="ms-folder-name">{f.label}</span>
                </span>
                {f.unread > 0
                  ? <span className="ms-badge">{f.unread}</span>
                  : (f.total > 0 && <span className="ms-count">{f.total}</span>)}
              </button>
            ))}
          </div>
        </nav>

        <section className="mail-main">
          {compose ? (
            <Compose
              initial={compose}
              me={me}
              draftCount={draftCount}
              onCancel={() => setCompose(null)}
              onDone={(msg) => { setCompose(null); setNotice(msg); loadFolders(); setFolder('SENT') }}
              onError={setError}
            />
          ) : detail ? (
            <MailDetail
              detail={detail}
              me={me}
              folders={folders}
              prevId={prevId}
              nextId={nextId}
              onNavigate={open}
              onBack={() => setDetail(null)}
              onChanged={() => { setDetail(null); loadFolders() }}
              onReply={(init) => { setDetail(null); setCompose(init) }}
              onError={setError}
            />
          ) : (
            <MailList
              folder={folder}
              folders={folders}
              onOpen={open}
              onIds={setListIds}
              onChanged={loadFolders}
              onError={setError}
            />
          )}
        </section>
      </div>
    </Shell>
  )
}

function MailList({ folder, folders, onOpen, onIds, onChanged, onError }) {
  const [data, setData] = useState({ content: [], totalElements: 0, totalPages: 0 })
  const [keyword, setKeyword] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(() => new Set()) // 일괄 처리용 선택
  const [moveTo, setMoveTo] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { setPage(0); setQuery(''); setKeyword(''); setSelected(new Set()) }, [folder])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await mailboxApi.list({ folder, keyword: query, page, size: 20 })
      setData(res)
      onIds((res.content ?? []).map((m) => m.mailId))
      setSelected(new Set())
    } catch (e) { onError(e.message) } finally { setLoading(false) }
  }, [folder, query, page, onIds, onError])
  useEffect(() => { load() }, [load])

  const rows = data.content ?? []
  const allChecked = rows.length > 0 && rows.every((m) => selected.has(m.mailId))
  const sentLike = folder === 'SENT' || folder === 'DRAFT'

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map((m) => m.mailId)))
  }

  // 일괄 처리 — 선택한 메일에 같은 동작을 순서대로 적용한다(한 페이지 20건이라 순차로 충분).
  async function bulkDelete() {
    setBusy(true)
    try {
      for (const id of selected) await mailboxApi.remove(id)
      await load(); onChanged()
    } catch (e) { onError(e.message) } finally { setBusy(false) }
  }
  async function bulkMove(target) {
    if (!target) return
    setBusy(true)
    try {
      for (const id of selected) await mailboxApi.move(id, target)
      setMoveTo(''); await load(); onChanged()
    } catch (e) { onError(e.message) } finally { setBusy(false) }
  }

  // 별표(중요) 토글 — 먼저 화면을 바꾸고(낙관적) 서버에 반영, 실패하면 되돌린다.
  async function toggleStar(m) {
    const next = !m.starred
    const flip = (on) => setData((d) => ({
      ...d, content: d.content.map((x) => (x.mailId === m.mailId ? { ...x, starred: on } : x)),
    }))
    flip(next)
    try { await mailboxApi.setStar(m.mailId, next) }
    catch (e) { onError(e.message); flip(!next) }
  }

  return (
    <>
      {/* 액션바 — 네이버 배치·크기 그대로, 색·컴포넌트는 콘솔 것. */}
      <div className="mail-actionbar">
        <label className="mail-check-all">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} disabled={rows.length === 0} />
          {selected.size > 0 ? `${selected.size}개 선택` : '전체선택'}
        </label>
        <span className="mail-sep" />
        <button type="button" className="mail-act" disabled={selected.size === 0 || busy} onClick={bulkDelete}>
          {folder === 'TRASH' ? '완전 삭제' : '삭제'}
        </button>
        <select
          className="mail-act mail-act-select"
          value={moveTo}
          disabled={selected.size === 0 || busy}
          onChange={(e) => { setMoveTo(e.target.value); bulkMove(e.target.value) }}
        >
          <option value="">이동</option>
          {folders.filter((f) => f.folder !== folder).map((f) => (
            <option key={f.folder} value={f.folder}>{f.label}(으)로</option>
          ))}
        </select>
        <form
          className="notice-search mail-search mail-actionbar-right"
          onSubmit={(e) => { e.preventDefault(); setPage(0); setQuery(keyword) }}
        >
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="제목·주소 검색" />
        </form>
      </div>

      {loading ? (
        <Loading label="메일을 불러오는 중…" />
      ) : rows.length === 0 ? (
        <div className="notice-empty-state">
          <div className="notice-empty-ic" aria-hidden="true">📭</div>
          <p className="notice-empty-title">메일이 없습니다.</p>
        </div>
      ) : (
        <div className="table-wrap">
          {/* 네이버 메일함처럼 컬럼 헤더 없이 행만. 폭은 colgroup 으로 고정(table-layout: fixed). */}
          <table className="table mail-table">
            <colgroup>
              <col className="mc-col-check" />
              <col className="mc-col-star" />
              <col className="mc-col-read" />
              <col className="mc-col-sender" />
              <col />
              <col className="mc-col-attach" />
              <col className="mc-col-date" />
            </colgroup>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.mailId}
                  className={`row-clickable${m.unread ? ' mail-unread' : ''}${selected.has(m.mailId) ? ' mail-selected' : ''}`}
                  onClick={() => onOpen(m.mailId)}
                >
                  <td className="mail-check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(m.mailId)} onChange={() => toggle(m.mailId)} />
                  </td>
                  <td className="mail-star" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`mail-star-btn${m.starred ? ' on' : ''}`}
                      onClick={() => toggleStar(m)}
                      aria-label={m.starred ? '별표 해제' : '별표'}
                    >
                      <span className="material-symbols-outlined">star</span>
                    </button>
                  </td>
                  <td className="mail-readicon">
                    <span className="material-symbols-outlined" aria-label={m.unread ? '안 읽음' : '읽음'}>
                      {m.unread ? 'mail' : 'drafts'}
                    </span>
                  </td>
                  <td className="mail-sender">
                    {sentLike ? (m.toAddress || '(받는 사람 없음)') : (m.fromName || m.fromAddress)}
                  </td>
                  <td className="mail-subj">
                    {sentLike
                      ? null
                      : (m.shared
                        ? <span className="badge badge-active mail-tag">공용</span>
                        : <span className="mail-to">TO</span>)}
                    <span className="mail-subj-text">{m.subject || '(제목 없음)'}</span>
                  </td>
                  <td className="mail-attach-cell">
                    {m.hasAttachment && <span className="material-symbols-outlined mail-clip" aria-label="첨부">attach_file</span>}
                  </td>
                  <td className="mail-date">{fmt(m.sentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.totalPages > 1 && (
        <div className="mail-pager">
          <button disabled={page === 0} onClick={() => setPage(0)} aria-label="처음">&laquo;</button>
          <button disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="이전">&lsaquo;</button>
          {pageWindow(page, data.totalPages).map((p) => (
            <button key={p} className={p === page ? 'on' : ''} onClick={() => setPage(p)}>{p + 1}</button>
          ))}
          <button disabled={page >= data.totalPages - 1} onClick={() => setPage(page + 1)} aria-label="다음">&rsaquo;</button>
          <button disabled={page >= data.totalPages - 1} onClick={() => setPage(data.totalPages - 1)} aria-label="마지막">&raquo;</button>
        </div>
      )}
    </>
  )
}

function MailDetail({ detail, me, folders, prevId, nextId, onNavigate, onBack, onChanged, onReply, onError }) {
  const [confirm, setConfirm] = useState(false)
  const [moveTo, setMoveTo] = useState('')

  async function remove() {
    try { await mailboxApi.remove(detail.mailId); onChanged() }
    catch (e) { onError(e.message) }
  }
  async function move(target) {
    if (!target) return
    try { await mailboxApi.move(detail.mailId, target); onChanged() }
    catch (e) { onError(e.message) }
  }

  // 원문 인용 블록(답장·전체답장·전달 공용).
  function quoted() {
    return (
      `<br><br><hr><p>보낸 사람: ${detail.fromName || ''} &lt;${detail.fromAddress}&gt;<br>` +
      `보낸 날짜: ${detail.sentAt}<br>받는 사람: ${detail.toAddress || ''}<br>제목: ${detail.subject || ''}</p>` +
      (detail.plainText ? `<pre>${detail.content || ''}</pre>` : (detail.content || ''))
    )
  }
  const withPrefix = (p) => (detail.subject?.startsWith(p) ? detail.subject : `${p} ${detail.subject || ''}`)

  // 답장: 보낸 사람에게만.
  function replyInit() {
    return { to: detail.fromAddress, cc: '', bcc: '', subject: withPrefix('RE:'), content: quoted() }
  }
  // 전체답장: 보낸 사람 + 원래 받는 사람/참조(나 자신은 뺀다).
  function replyAllInit() {
    const mine = me?.address?.toLowerCase()
    const others = [...parseAddresses(detail.toAddress), ...parseAddresses(detail.ccAddress)]
      .filter((a) => a.toLowerCase() !== mine && a.toLowerCase() !== detail.fromAddress?.toLowerCase())
    return { to: detail.fromAddress, cc: [...new Set(others)].join(', '), bcc: '', subject: withPrefix('RE:'), content: quoted() }
  }
  // 전달: 받는 사람은 비우고 원문을 그대로 싣는다. (첨부는 서버 원본이라 다시 붙지 않으므로 안내만)
  function forwardInit() {
    const note = detail.attachments?.length
      ? `<p>[원본 첨부 ${detail.attachments.length}개: ${detail.attachments.map((a) => a.filename).join(', ')}]</p>`
      : ''
    return { to: '', cc: '', bcc: '', subject: withPrefix('FWD:'), content: note + quoted() }
  }

  const isDraft = detail.folder === 'DRAFT'
  const folderLabel = folders.find((f) => f.folder === detail.folder)?.label ?? '목록'

  return (
    <>
      {/* 상단 이동 경로(네이버 배치). */}
      <div className="mail-crumb">
        <button type="button" className="mail-crumb-btn" onClick={onBack}>‹ {folderLabel}</button>
      </div>

      {/* 액션바 — 네이버 배치·크기 그대로, 색·컴포넌트는 콘솔 것. */}
      <div className="mail-actionbar">
        {isDraft ? (
          <button
            type="button"
            className="mail-act"
            onClick={() => onReply({
              to: detail.toAddress, cc: detail.ccAddress ?? '', bcc: '',
              subject: detail.subject ?? '', content: detail.content ?? '',
              draftId: detail.mailId,
            })}
          >
            이어 쓰기
          </button>
        ) : (
          <>
            <button type="button" className="mail-act" onClick={() => onReply(replyInit())}>답장</button>
            <button type="button" className="mail-act" onClick={() => onReply(replyAllInit())}>전체답장</button>
            <button type="button" className="mail-act" onClick={() => onReply(forwardInit())}>전달</button>
          </>
        )}
        <span className="mail-sep" />
        <button type="button" className="mail-act" onClick={() => setConfirm(true)}>
          {detail.folder === 'TRASH' ? '완전 삭제' : '삭제'}
        </button>
        <span className="mail-sep" />
        <select
          className="mail-act mail-act-select"
          value={moveTo}
          onChange={(e) => { setMoveTo(e.target.value); move(e.target.value) }}
        >
          <option value="">이동</option>
          {folders.filter((f) => f.folder !== detail.folder).map((f) => (
            <option key={f.folder} value={f.folder}>{f.label}(으)로</option>
          ))}
        </select>

        <span className="mail-actionbar-right">
          <button type="button" className="mail-act" onClick={onBack}>목록</button>
          <button type="button" className="mail-act mail-act-icon" disabled={!prevId} aria-label="이전 메일"
            onClick={() => prevId && onNavigate(prevId)}>
            <span className="material-symbols-outlined">keyboard_arrow_up</span>
          </button>
          <button type="button" className="mail-act mail-act-icon" disabled={!nextId} aria-label="다음 메일"
            onClick={() => nextId && onNavigate(nextId)}>
            <span className="material-symbols-outlined">keyboard_arrow_down</span>
          </button>
        </span>
      </div>

      <div className="md-card">
        {/* 제목 · 태그 · 보낸사람 박스 */}
        <section className="md-head">
          <div className="md-head-top">
            <div className="md-subject-wrap">
              <div className="md-tags">
                {detail.shared && <span className="md-tag md-tag-blue">공용</span>}
                {detail.folder === 'INBOX' && <span className="md-tag md-tag-green">받은메일</span>}
              </div>
              <h1 className="md-subject">{detail.subject || '(제목 없음)'}</h1>
            </div>
            <span className="md-date">{detail.sentAt?.slice(0, 16).replace('T', ' ')}</span>
          </div>
          <div className="md-sender">
            <div className="md-avatar">{(detail.fromName || detail.fromAddress || '?').trim().charAt(0).toUpperCase()}</div>
            <div className="md-sender-meta">
              <div className="md-sender-line">
                <strong>{detail.fromName || detail.fromAddress}</strong>
                <span className="md-sender-addr">&lt;{detail.fromAddress}&gt;</span>
              </div>
              <div className="md-recip">
                <span><em>받는 사람</em>{detail.toAddress || '-'}</span>
                {detail.ccAddress && <span className="md-recip-cc"><em>참조</em>{detail.ccAddress}</span>}
              </div>
            </div>
          </div>
        </section>

        {/* 첨부파일 */}
        {detail.attachments?.length > 0 && (
          <section className="md-attach">
            <div className="md-attach-head">
              <span className="material-symbols-outlined">attach_file</span>
              첨부파일 <strong>{detail.attachments.length}개</strong>
              <span className="md-attach-total">({sizeText(detail.attachments.reduce((s, a) => s + a.size, 0))})</span>
            </div>
            <div className="md-attach-list">
              {detail.attachments.map((a) => (
                <button
                  key={a.attachmentId}
                  type="button"
                  className="md-attach-item"
                  title={a.filename}
                  onClick={() => mailboxApi
                    .downloadAttachment(detail.mailId, a.attachmentId, a.filename)
                    .catch((e) => onError(e.message))}
                >
                  <span className="md-attach-badge">{extBadge(a.filename)}</span>
                  <span className="md-attach-name">{a.filename}</span>
                  <span className="md-attach-size">{sizeText(a.size)}</span>
                  <span className="material-symbols-outlined md-attach-dl">download</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 본문 — 길면 긴 대로 전부 보인다. 외부 HTML 은 샌드박스 iframe 으로 격리. */}
        <div className="md-body">
          {detail.plainText ? (
            <div className="md-body-text">{detail.content}</div>
          ) : (
            <MailHtml html={detail.content} />
          )}
        </div>
      </div>

      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{detail.folder === 'TRASH' ? '완전 삭제' : '메일 삭제'}</h3>
            <p className="confirm-text"><strong>{detail.subject || '(제목 없음)'}</strong></p>
            <p className="muted">
              {detail.folder === 'TRASH'
                ? '완전히 지웁니다. 되돌릴 수 없습니다. (메일 서버의 원본은 그대로 남습니다)'
                : '휴지통으로 옮깁니다.'}
            </p>
            <div className="dialog-actions">
              <button className="btn-ghost" onClick={() => setConfirm(false)}>취소</button>
              <button className="btn-primary btn-danger-solid" onClick={remove}>
                {detail.folder === 'TRASH' ? '완전 삭제' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * 외부에서 온 메일 본문을 격리해 보여준다.
 *
 * 그냥 dangerouslySetInnerHTML 로 꽂으면 메일에 섞인 스크립트가 콘솔 안에서 돈다.
 * 콘솔은 localStorage 에 토큰을 두므로 그 순간 토큰이 털린다.
 * sandbox 를 비워 둔 iframe 은 스크립트·폼·팝업이 모두 막힌다.
 */
function MailHtml({ html }) {
  const ref = useRef(null)
  const [height, setHeight] = useState(300)

  useEffect(() => {
    const frame = ref.current
    if (!frame) return
    frame.srcdoc = `<!doctype html><meta charset="utf-8">
      <base target="_blank">
      <style>body{margin:0;padding:4px;font-family:system-ui,'Malgun Gothic',sans-serif;font-size:14px;
      line-height:1.7;color:#222;word-break:break-word}img{max-width:100%}</style>${html ?? ''}`
    // 본문은 길면 긴 대로 다 보이게 — iframe 을 내용 높이에 맞춰 늘린다(상한 없음, 페이지가 스크롤).
    const measure = () => {
      try {
        const doc = frame.contentDocument
        if (doc) {
          const h = Math.max(
            doc.body ? doc.body.scrollHeight : 0,
            doc.documentElement ? doc.documentElement.scrollHeight : 0,
          )
          if (h > 0) setHeight(h + 24)
        }
      } catch { /* 접근 불가하면 기본 높이를 쓴다 */ }
    }
    frame.addEventListener('load', measure)
    // 늦게 뜨는 외부 이미지 등으로 높이가 커지면 다시 잰다.
    const timers = [200, 700, 1500].map((t) => setTimeout(measure, t))
    return () => { frame.removeEventListener('load', measure); timers.forEach(clearTimeout) }
  }, [html])

  // sandbox="allow-same-origin": 스크립트는 여전히 차단(allow-scripts 없음)이라 안전하고,
  //   부모가 내용 높이를 읽을 수 있어 본문 길이만큼 프레임을 늘릴 수 있다.
  // scrolling="no": 프레임 내부는 스크롤하지 않고 내용 높이만큼 늘어난다 → 페이지가 쭉 스크롤된다.
  return <iframe ref={ref} className="mail-body-frame" sandbox="allow-same-origin" title="메일 본문" scrolling="no" style={{ height }} />
}

/**
 * 주소 입력칸. 엔터(또는 쉼표·세미콜론)를 치면 그 주소가 아래에 칩으로 굳는다.
 *
 * 한 칸에 쉼표로 길게 이어 적는 것보다, 굳은 칩으로 보는 편이 누구에게 보내는지 한눈에 들어오고
 * 한 명만 빼기도 쉽다. 형식이 이상한 주소는 칩을 붉게 표시해 보내기 전에 눈에 띄게 한다.
 */
function AddressField({ value, onChange, placeholder, inputId }) {
  const [draft, setDraft] = useState('')

  /** 지금 입력 중인 글자를 칩으로 굳힌다. 한 번에 여러 개를 붙여넣어도 쪼개 담는다. */
  function commit(text) {
    const added = parseAddresses(text).filter((a) => !value.includes(a))
    if (added.length) onChange([...value, ...added])
    setDraft('')
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault()          // 엔터로 폼이 제출되지 않게
      if (draft.trim()) commit(draft)
      return
    }
    // 빈 칸에서 백스페이스를 누르면 마지막 칩을 뺀다(메일 앱의 익숙한 동작).
    if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="mail-address">
      <input
        id={inputId}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && commit(draft)}   // 칸을 떠날 때도 굳힌다
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (/[,;\s]/.test(text)) { e.preventDefault(); commit(text) }
        }}
      />
      {value.length > 0 && (
        <div className="mail-chips">
          {value.map((addr) => (
            <span key={addr} className={`mail-chip${looksLikeEmail(addr) ? '' : ' invalid'}`}>
              {addr}
              <button
                type="button"
                onClick={() => onChange(value.filter((a) => a !== addr))}
                aria-label={`${addr} 빼기`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Compose({ initial, me, draftCount = 0, onCancel, onDone, onError }) {
  const [toList, setToList] = useState(() => parseAddresses(initial.to))
  const [ccList, setCcList] = useState(() => parseAddresses(initial.cc))
  const [bccList, setBccList] = useState(() => parseAddresses(initial.bcc))
  const [showBcc, setShowBcc] = useState(() => parseAddresses(initial.bcc).length > 0)
  const [subject, setSubject] = useState(initial.subject ?? '')
  const [content, setContent] = useState(initial.content ?? '')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const totalSize = files.reduce((s, f) => s + f.size, 0)

  const to = toList.join(', ')
  const cc = ccList.join(', ')
  const bcc = bccList.join(', ')

  // ── 아래 로직(전송·임시저장·검증)은 기존 그대로 유지한다 ──
  async function send() {
    if (toList.length === 0) { onError('받는 사람을 입력하세요.'); return }
    // 형식이 이상한 주소는 보내기 전에 잡는다. 보내고 나서 반송되면 되돌릴 수 없다.
    const bad = [...toList, ...ccList, ...bccList].filter((a) => !looksLikeEmail(a))
    if (bad.length) { onError(`주소 형식이 올바르지 않습니다: ${bad.join(', ')}`); return }
    setBusy(true)
    try {
      await mailboxApi.send({ to, cc, bcc, subject, content, draftId: initial.draftId, files })
      onDone('메일을 보냈습니다.')
    } catch (e) { onError(e.message) } finally { setBusy(false) }
  }

  async function saveDraft() {
    setBusy(true)
    try {
      await mailboxApi.saveDraft({ to, cc, bcc, subject, content, draftId: initial.draftId })
      onDone('임시보관함에 저장했습니다.')
    } catch (e) { onError(e.message) } finally { setBusy(false) }
  }

  // 내게쓰기 — 받는 사람을 내 주소로 채운다.
  function toSelf() { if (me?.address) setToList([me.address]) }

  // 파일 첨부 — 파일 선택/드롭 모두 같은 files 상태에 담는다(기존 로직 유지).
  function addFiles(list) {
    const arr = Array.from(list || [])
    if (arr.length) setFiles((prev) => [...prev, ...arr])
  }
  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    addFiles(e.dataTransfer?.files)
  }

  return (
    <div className="mc">
      {/* 상단 액션 바 — 제목 · 임시보관 상태 · 액션들(보내기만 primary) */}
      <div className="mc-bar">
        <div className="mc-bar-l">
          <h1 className="mc-title">메일쓰기</h1>
          <span className="mc-vdiv" />
          <span className="mc-status"><span className="mc-dot" />임시보관 메일 {draftCount}</span>
        </div>
        <div className="mc-bar-r">
          <button className="mc-btn mc-btn-primary" onClick={send} disabled={busy}>
            <span className="material-symbols-outlined">send</span>{busy ? '보내는 중…' : '보내기'}
          </button>
          <button className="mc-btn" onClick={saveDraft} disabled={busy}>
            <span className="material-symbols-outlined">save</span>임시저장
          </button>
          <button className="mc-btn" onClick={() => setPreview(true)} disabled={busy}>
            <span className="material-symbols-outlined">visibility</span>미리보기
          </button>
          <button className="mc-btn" onClick={toSelf} disabled={busy}>
            <span className="material-symbols-outlined">person</span>내게쓰기
          </button>
          <span className="mc-vdiv" />
          <button className="mc-btn mc-btn-plain" onClick={onCancel} disabled={busy}>
            <span className="material-symbols-outlined">close</span>취소
          </button>
        </div>
      </div>

      {/* 본문 영역 */}
      <div className="mc-body">
        {/* 수신 정보 — 옅은 박스 안에 라벨(좌)+입력(우) */}
        <div className="mc-fieldbox">
          <div className="mc-row">
            <span className="mc-label">보내는사람</span>
            <div className="mc-sender">
              <strong>{me?.name ?? '…'}</strong>
              <span className="mc-sender-addr">{me?.address}</span>
            </div>
          </div>
          <div className="mc-row mc-row-top">
            <label className="mc-label" htmlFor="mail-to">받는사람</label>
            <div className="mc-recip">
              <AddressField inputId="mail-to" value={toList} onChange={setToList}
                placeholder="주소를 입력하고 엔터를 누르세요 (여러 명 입력 가능)" />
              {!showBcc && (
                <button type="button" className="mc-mini" onClick={() => setShowBcc(true)}>숨은참조</button>
              )}
            </div>
          </div>
          <div className="mc-row">
            <label className="mc-label" htmlFor="mail-cc">참조</label>
            <AddressField inputId="mail-cc" value={ccList} onChange={setCcList} placeholder="참조할 이메일 주소" />
          </div>
          {showBcc && (
            <div className="mc-row">
              <label className="mc-label" htmlFor="mail-bcc">숨은참조</label>
              <AddressField inputId="mail-bcc" value={bccList} onChange={setBccList} placeholder="받는 사람에게 보이지 않습니다" />
            </div>
          )}
          <div className="mc-row">
            <label className="mc-label" htmlFor="mail-subject">제목</label>
            <input id="mail-subject" className="mc-subject" value={subject}
              onChange={(e) => setSubject(e.target.value)} maxLength={500} placeholder="제목을 입력하세요" />
          </div>
        </div>

        {/* 파일 첨부 — 헤더바([내 PC]) + 드래그앤드롭 */}
        <div className="mc-attach">
          <div className="mc-attach-bar">
            <div className="mc-attach-l">
              <span className="mc-attach-title">파일첨부</span>
              {files.length > 0 && (
                <span className="mc-attach-size">총 {files.length}개 · {sizeText(totalSize)} / 15MB</span>
              )}
            </div>
            <button type="button" className="mc-attach-btn" onClick={() => fileRef.current?.click()}>
              <span className="material-symbols-outlined">computer</span> 내 PC
            </button>
          </div>
          <input ref={fileRef} type="file" multiple hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          <div className="mc-attach-body">
            <div
              className={`mc-drop${dragOver ? ' drag' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <span className="material-symbols-outlined">cloud_upload</span>
              <span>파일을 마우스로 끌어 오거나 <b>파일 찾기</b>를 누르세요.</span>
            </div>
            {files.length > 0 && (
              <div className="mc-files">
                {files.map((f, i) => (
                  <span key={`${f.name}-${i}`} className="mc-file">
                    <span className="material-symbols-outlined mc-file-ic">description</span>
                    <span className="mc-file-name">{f.name}</span>
                    <span className="mc-file-size">{sizeText(f.size)}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="첨부 빼기">✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 에디터(기존 RichEditor 그대로) */}
        <div className="mc-editor">
          <RichEditor value={content} onChange={setContent} uploadImage={fileApi.uploadImage} />
        </div>
      </div>

      {/* 미리보기 — 작성한 본문을 그대로(스크립트 격리) 보여준다. */}
      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(false)}>
          <div className="modal mc-preview" onClick={(e) => e.stopPropagation()}>
            <div className="mc-preview-head">
              <strong>{subject || '(제목 없음)'}</strong>
              <button className="btn-ghost btn-sm" onClick={() => setPreview(false)}>닫기</button>
            </div>
            <div className="mc-preview-body"><MailHtml html={content} /></div>
          </div>
        </div>
      )}
    </div>
  )
}
