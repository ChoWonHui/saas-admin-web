import { useCallback, useEffect, useRef, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import { tenantInquiryApi } from '../../api/tenantClient'

const fmt = (dt) => (dt ? dt.slice(0, 16).replace('T', ' ') : '')
const deriveTitle = (text) => {
  const first = (text || '').trim().split('\n')[0].trim()
  return first ? first.slice(0, 40) : '문의'
}

/** 이미지 첨부(업로드 → URL 목록). */
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
        const { url } = await tenantInquiryApi.uploadImage(f)
        setUrls((prev) => [...prev, url])
      }
    } catch (err) { onError(err.message || '이미지 업로드에 실패했습니다.') }
    finally { setBusy(false) }
  }
  return (
    <div className="cq-attach">
      {urls.map((u, i) => (
        <div key={u + i} className="cq-thumb">
          <img src={u} alt="첨부" />
          <button type="button" className="cq-thumb-del" onClick={() => setUrls((p) => p.filter((_, idx) => idx !== i))} aria-label="삭제">×</button>
        </div>
      ))}
      <button type="button" className="cq-attach-btn" onClick={() => inputRef.current?.click()} disabled={busy} aria-label="사진 첨부">
        <Icon name="add_photo_alternate" />
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={pick} />
    </div>
  )
}

/** 채팅 말풍선. mine=본인(업체) 오른쪽 퍼플, 아니면 관리자 왼쪽 회색. */
function Bubble({ mine, admin, content, images, at }) {
  return (
    <div className={`cq-row ${mine ? 'me' : 'other'}`}>
      {!mine && <span className="cq-avatar" aria-hidden="true"><Icon name="support_agent" /></span>}
      <div className="cq-bubble-wrap">
        <div className="cq-bubble-meta">
          {!mine && <span className="cq-name">관리자</span>}
          <span className="cq-at">{fmt(at)}</span>
        </div>
        <div className={`cq-bubble ${mine ? 'me' : 'other'}`}>
          {content && <p className="cq-text">{content}</p>}
          {images?.length > 0 && (
            <div className="cq-images">
              {images.map((u, i) => <a key={u + i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="첨부 이미지" /></a>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TenantInquiriesPage() {
  const [messages, setMessages] = useState(null) // 모든 문의를 시간순으로 합친 대화
  const [latest, setLatest] = useState(null)     // { id, status } — 이어달지/새로만들지 판단용
  const [content, setContent] = useState('')
  const [urls, setUrls] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bodyRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const list = await tenantInquiryApi.list()
      if (!list.length) { setMessages([]); setLatest(null); return }
      const details = await Promise.all(list.map((q) => tenantInquiryApi.get(q.inquiryId)))
      const msgs = []
      for (const d of details) {
        msgs.push({ key: `i${d.inquiryId}`, mine: true, content: d.content, images: d.imageUrls, at: d.createdAt })
        for (const r of d.replies) {
          msgs.push({ key: `r${r.replyId}`, mine: r.authorType !== 'ADMIN', admin: r.authorType === 'ADMIN', content: r.content, images: r.imageUrls, at: r.createdAt })
        }
      }
      msgs.sort((a, b) => (a.at || '').localeCompare(b.at || ''))
      setMessages(msgs)
      setLatest({ id: list[0].inquiryId, status: list[0].status }) // list 는 최신순
    } catch (e) { setError(e.message); setMessages([]) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function send(e) {
    e?.preventDefault?.()
    const text = content.trim()
    if (!text && urls.length === 0) { return }
    setSending(true)
    try {
      // 이어지는 대화가 열려 있으면 답글로, 없거나 종료됐으면 새 문의로 — 버튼 없이 자동 처리.
      if (latest && latest.status !== 'CLOSED') {
        await tenantInquiryApi.reply(latest.id, { content: text, imageUrls: urls })
      } else {
        await tenantInquiryApi.create({ title: deriveTitle(text), content: text, imageUrls: urls })
      }
      setContent(''); setUrls([])
      await load()
    } catch (err) { setError(err.message) } finally { setSending(false) }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <TenantShell>
      <div className="cq">
        <div className="cq-bar">
          <span className="cq-bar-ic" aria-hidden="true"><Icon name="support_agent" /></span>
          <div className="cq-bar-title">
            <b>문의</b>
            <span className="cq-bar-hint">관리자와 실시간으로 상담하세요</span>
          </div>
        </div>

        <div className="cq-body" ref={bodyRef}>
          {messages === null ? (
            <Loading label="불러오는 중…" />
          ) : messages.length === 0 ? (
            <div className="cq-hello">
              <span className="cq-hello-ic" aria-hidden="true">💬</span>
              <p className="cq-hello-title">무엇이든 물어보세요</p>
              <p className="cq-hello-sub">남기신 문의는 관리자에게 실시간으로 전달됩니다. 아래에 메시지를 입력해 대화를 시작하세요.</p>
            </div>
          ) : (
            messages.map((m) => (
              <Bubble key={m.key} mine={m.mine} admin={m.admin} content={m.content} images={m.images} at={m.at} />
            ))
          )}
        </div>

        <form className="cq-composer" onSubmit={send}>
          <ImageAttach urls={urls} setUrls={setUrls} onError={setError} />
          <div className="cq-inputrow">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              maxLength={5000}
              placeholder="메시지를 입력하세요…"
            />
            <button type="submit" className="cq-send" disabled={sending || (!content.trim() && urls.length === 0)} aria-label="전송">
              <Icon name="send" filled />
            </button>
          </div>
        </form>
      </div>

      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}
