import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Shell from '../components/Shell'
import Toast from '../components/Toast'
import Loading from '../components/Loading'
import Icon from '../components/Icon'
import { fileApi, inquiryApi } from '../api/client'

const fmt = (dt) => (dt ? dt.slice(0, 16).replace('T', ' ') : '')
const fmtShort = (dt) => (dt ? dt.slice(5, 16).replace('T', ' ').replace('-', '.') : '')

/** 이미지 첨부(관리자 업로드). */
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
    <div className="ac-attach">
      {urls.map((u, i) => (
        <div key={u + i} className="ac-thumb">
          <img src={u} alt="첨부" />
          <button type="button" className="ac-thumb-del" onClick={() => setUrls((p) => p.filter((_, idx) => idx !== i))} aria-label="삭제">×</button>
        </div>
      ))}
      <button type="button" className="ac-attach-btn" onClick={() => inputRef.current?.click()} disabled={busy} aria-label="사진 첨부">
        <Icon name="add_photo_alternate" />
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={pick} />
    </div>
  )
}

/** 관리자 화면 기준: 관리자(me)=오른쪽 인디고, 업체(other)=왼쪽 회색. */
function Bubble({ me, name, content, images, at }) {
  return (
    <div className={`ac-row ${me ? 'me' : 'other'}`}>
      {!me && <span className="ac-avatar" aria-hidden="true"><Icon name="storefront" /></span>}
      <div className="ac-bubble-wrap">
        <div className="ac-bubble-meta">
          {!me && <span className="ac-name">{name}</span>}
          <span className="ac-at">{fmt(at)}</span>
        </div>
        <div className={`ac-bubble ${me ? 'me' : 'other'}`}>
          {content && <p className="ac-text">{content}</p>}
          {images?.length > 0 && (
            <div className="ac-images">
              {images.map((u, i) => <a key={u + i} href={u} target="_blank" rel="noreferrer"><img src={u} alt="첨부 이미지" /></a>)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function InquiriesPage() {
  const [convs, setConvs] = useState(null)   // 업체별 대화 목록
  const [activeId, setActiveId] = useState(null) // 선택한 tenantId
  const [conv, setConv] = useState(null)     // 열린 대화(ConvView)
  const [content, setContent] = useState('')
  const [urls, setUrls] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bodyRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const loadList = useCallback(async () => {
    try { setConvs(await inquiryApi.tenantConvs()) }
    catch (e) { setError(e.message); setConvs([]) }
  }, [])

  const openConv = useCallback(async (tenantId) => {
    setActiveId(tenantId)
    try { setConv(await inquiryApi.tenantConv(tenantId)) }
    catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { loadList() }, [loadList])

  // 헤더 벨에서 넘어온 ?tenant=<id> 로 해당 업체 대화를 연다.
  useEffect(() => {
    const tid = searchParams.get('tenant')
    if (!tid) return
    openConv(Number(tid))
    const next = new URLSearchParams(searchParams); next.delete('tenant'); setSearchParams(next, { replace: true })
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // 열려 있는 동안 새 메시지를 위해 가볍게 폴링(목록 + 현재 대화).
  useEffect(() => {
    const t = setInterval(() => {
      loadList()
      if (activeId) inquiryApi.tenantConv(activeId).then(setConv).catch(() => {})
    }, 12000)
    return () => clearInterval(t)
  }, [activeId, loadList])

  useEffect(() => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight }, [conv])

  async function send(e) {
    e?.preventDefault?.()
    const text = content.trim()
    if ((!text && urls.length === 0) || !activeId) return
    setSending(true)
    try {
      const updated = await inquiryApi.sendToTenant(activeId, { content: text, imageUrls: urls })
      setContent(''); setUrls([])
      setConv(updated)
      loadList()
    } catch (err) { setError(err.message) } finally { setSending(false) }
  }
  function onKeyDown(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const list = convs ?? []
  const pending = list.filter((c) => c.needsReply).length

  return (
    <Shell>
      <Toast message={error} onClose={() => setError('')} />
      <div className={`ac${activeId ? ' chatting' : ''}`}>
        {/* 업체 대화 목록 */}
        <aside className="ac-list-pane">
          <div className="ac-list-head">
            <div>
              <span className="ac-eyebrow"><Icon name="support_agent" /> INQUIRIES</span>
              <h2>문의</h2>
            </div>
            {pending > 0 && <span className="ac-pending">답변대기 {pending}</span>}
          </div>
          {convs === null ? (
            <Loading label="불러오는 중…" />
          ) : list.length === 0 ? (
            <div className="ac-empty"><span aria-hidden="true">💬</span><p>아직 문의가 없습니다.</p></div>
          ) : (
            <ul className="ac-list">
              {list.map((c) => (
                <li key={c.tenantId}>
                  <button type="button" className={`ac-item${activeId === c.tenantId ? ' on' : ''}${c.needsReply ? ' unread' : ''}`} onClick={() => openConv(c.tenantId)}>
                    <span className="ac-item-avatar"><Icon name="storefront" /></span>
                    <span className="ac-item-txt">
                      <span className="ac-item-top">
                        <span className="ac-item-name">{c.tenantName}</span>
                        <span className="ac-item-at">{fmtShort(c.lastAt)}</span>
                      </span>
                      <span className="ac-item-last">
                        {c.lastFrom === 'ADMIN' && <span className="ac-item-me">나: </span>}
                        {c.lastMessage || '(사진)'}
                      </span>
                    </span>
                    {c.needsReply && <span className="ac-dot" aria-label="답변 대기" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* 대화(채팅) — 업체 콘솔과 동일 디자인 */}
        <section className="ac-chat-pane">
          {!activeId ? (
            <div className="ac-chat-blank">
              <span aria-hidden="true">💬</span>
              <p>왼쪽에서 업체를 선택해 대화를 시작하세요.</p>
            </div>
          ) : (
            <div className="ac-chat">
              <div className="ac-bar">
                <button type="button" className="ac-back" onClick={() => { setActiveId(null); setConv(null) }} aria-label="목록"><Icon name="arrow_back" /></button>
                <span className="ac-bar-ic" aria-hidden="true"><Icon name="storefront" /></span>
                <div className="ac-bar-title">
                  <b>{conv?.tenantName || '대화'}</b>
                  <span className="ac-bar-hint">업체와 실시간으로 상담</span>
                </div>
              </div>
              <div className="ac-body" ref={bodyRef}>
                {conv === null ? (
                  <Loading label="대화를 여는 중…" />
                ) : conv.messages.length === 0 ? (
                  <div className="ac-chat-blank"><span aria-hidden="true">💬</span><p>아직 메시지가 없습니다.</p></div>
                ) : (
                  conv.messages.map((m, i) => (
                    <Bubble key={i} me={m.from === 'ADMIN'} name={m.name} content={m.content} images={m.imageUrls} at={m.at} />
                  ))
                )}
              </div>
              <form className="ac-composer" onSubmit={send}>
                <ImageAttach urls={urls} setUrls={setUrls} onError={setError} />
                <div className="ac-inputrow">
                  <textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={onKeyDown} rows={1} maxLength={5000} placeholder="답변 메시지를 입력하세요…" />
                  <button type="submit" className="ac-send" disabled={sending || (!content.trim() && urls.length === 0)} aria-label="전송"><Icon name="send" filled /></button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>
    </Shell>
  )
}
