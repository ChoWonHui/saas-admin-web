import { useCallback, useEffect, useRef, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import { tenantInquiryApi } from '../../api/tenantClient'

const STATUS = {
  OPEN: { label: '답변대기', cls: 'open' },
  ANSWERED: { label: '답변완료', cls: 'answered' },
  CLOSED: { label: '종료', cls: 'closed' },
}
function fmt(dt) {
  return dt ? dt.slice(0, 16).replace('T', ' ') : ''
}

/** 이미지 첨부(업로드 → URL 목록). 문의 작성·재문의 양쪽에서 쓴다. */
function ImageAttach({ urls, setUrls, onError, disabled }) {
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
        const { url } = await tenantInquiryApi.uploadImage(f)
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
            {!disabled && (
              <button type="button" className="img-del" onClick={() => setUrls((p) => p.filter((_, idx) => idx !== i))} aria-label="삭제">×</button>
            )}
          </div>
        ))}
        {!disabled && (
          <button type="button" className="img-add" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? '올리는 중…' : '＋ 사진'}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={pick} />
    </div>
  )
}

/** 본문 + 이미지를 함께 보여주는 말풍선(문의 본문, 각 답변). */
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

export default function TenantInquiriesPage() {
  const [view, setView] = useState('list') // 'list' | 'new' | 'detail'
  const [items, setItems] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setItems(await tenantInquiryApi.list()) }
    catch (e) { setError(e.message); setItems([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function openDetail(id) {
    try { setDetail(await tenantInquiryApi.get(id)); setView('detail') }
    catch (e) { setError(e.message) }
  }

  return (
    <TenantShell>
      <div className="iq-wrap">
        {view === 'list' && (
          <>
            <div className="m-topline">
              <div className="m-page-head">
                <h1>문의</h1>
                <p>운영 중 궁금한 점을 남기고 답변을 확인하세요.</p>
              </div>
              <button className="m-btn m-btn-primary" onClick={() => setView('new')}><Icon name="add" /> 새 문의</button>
            </div>
            {items === null ? (
              <Loading label="문의를 불러오는 중…" />
            ) : items.length === 0 ? (
              <div className="iq-empty">
                <span aria-hidden="true">💬</span>
                <p>아직 문의가 없습니다.</p>
                <p className="muted">운영 중 궁금한 점을 남겨 주세요.</p>
              </div>
            ) : (
              <ul className="iq-list">
                {items.map((q) => (
                  <li key={q.inquiryId}>
                    <button className="iq-row" onClick={() => openDetail(q.inquiryId)}>
                      <span className={`iq-badge ${STATUS[q.status]?.cls}`}>{STATUS[q.status]?.label}</span>
                      <span className="iq-row-title">
                        {q.title}
                        {q.hasImages && <span className="iq-clip" aria-label="사진 첨부">📎</span>}
                        {q.replyCount > 0 && <span className="iq-count">{q.replyCount}</span>}
                      </span>
                      <span className="iq-row-at">{fmt(q.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {view === 'new' && (
          <NewInquiry
            onCancel={() => setView('list')}
            onCreated={async (created) => { await load(); setDetail(created); setView('detail') }}
            onError={setError}
          />
        )}

        {view === 'detail' && detail && (
          <DetailView
            detail={detail}
            onBack={() => { setView('list'); load() }}
            onReplied={(updated) => setDetail(updated)}
            onError={setError}
          />
        )}
      </div>
      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}

function NewInquiry({ onCancel, onCreated, onError }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [urls, setUrls] = useState([])
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) { onError('제목을 입력하세요.'); return }
    if (!content.trim()) { onError('내용을 입력하세요.'); return }
    setSaving(true)
    try {
      const created = await tenantInquiryApi.create({ title: title.trim(), content, imageUrls: urls })
      onCreated(created)
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  return (
    <form className="iq-form" onSubmit={submit}>
      <div className="iq-head">
        <h2>새 문의</h2>
      </div>
      <label className="field">
        <span>제목</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="문의 제목" autoFocus />
      </label>
      <label className="field">
        <span>내용</span>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} rows={7} placeholder="궁금한 점을 적어 주세요." />
      </label>
      <div className="field">
        <span className="field-label">사진 첨부 <span className="muted">(선택, 최대 10장)</span></span>
        <ImageAttach urls={urls} setUrls={setUrls} onError={onError} />
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>취소</button>
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? '등록 중…' : '문의 등록'}</button>
      </div>
    </form>
  )
}

function DetailView({ detail, onBack, onReplied, onError }) {
  const [content, setContent] = useState('')
  const [urls, setUrls] = useState([])
  const [saving, setSaving] = useState(false)
  const closed = detail.status === 'CLOSED'

  async function reply(e) {
    e.preventDefault()
    if (!content.trim()) { onError('내용을 입력하세요.'); return }
    setSaving(true)
    try {
      const updated = await tenantInquiryApi.reply(detail.inquiryId, { content, imageUrls: urls })
      onReplied(updated); setContent(''); setUrls([])
    } catch (e) { onError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="iq-detail">
      <div className="iq-head">
        <button className="btn-ghost btn-sm" onClick={onBack}>← 목록</button>
        <span className={`iq-badge ${STATUS[detail.status]?.cls}`}>{STATUS[detail.status]?.label}</span>
      </div>
      <h2 className="iq-title">{detail.title}</h2>

      <div className="iq-thread">
        <Bubble side="left" name={detail.authorName} content={detail.content} images={detail.imageUrls} at={detail.createdAt} />
        {detail.replies.map((r) => (
          <Bubble
            key={r.replyId}
            side={r.authorType === 'ADMIN' ? 'right' : 'left'}
            name={r.authorName}
            badge={r.authorType === 'ADMIN' ? { label: '관리자', cls: 'admin' } : null}
            content={r.content}
            images={r.imageUrls}
            at={r.createdAt}
          />
        ))}
      </div>

      {closed ? (
        <p className="iq-closed">종료된 문의입니다. 추가 문의는 새 문의로 남겨 주세요.</p>
      ) : (
        <form className="iq-replybox" onSubmit={reply}>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={5000} rows={3} placeholder="추가로 문의할 내용을 적어 주세요." />
          <ImageAttach urls={urls} setUrls={setUrls} onError={onError} />
          <div className="iq-replybtn">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? '등록 중…' : '문의 남기기'}</button>
          </div>
        </form>
      )}
    </div>
  )
}
