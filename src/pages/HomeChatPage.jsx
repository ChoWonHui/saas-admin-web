import { useCallback, useEffect, useRef, useState } from 'react'
import Shell from '../components/Shell'
import Toast from '../components/Toast'
import Loading from '../components/Loading'
import { chatApi } from '../api/client'

/**
 * 홈페이지 채팅 상담 — 관리자 답변 화면.
 *
 * 좌측 대화 목록, 우측 메시지 스레드 + 답변 입력. 목록·메시지는 서버에서 가져오고,
 * 답변은 서버에 저장된다. 새 메시지는 폴링(3초)으로 반영한다.
 * (헤더 알림 벨/푸시는 백엔드 NEW_CHAT 이벤트로 이미 나간다.)
 */
const fmtTime = (dt) => (dt ? dt.slice(5, 16).replace('T', ' ') : '')

export default function HomeChatPage() {
  const [convs, setConvs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const threadRef = useRef(null)
  const lastIdRef = useRef(0)

  const loadConvs = useCallback(async () => {
    try {
      const list = await chatApi.conversations()
      setConvs(list || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConvs() }, [loadConvs])

  // 대화 선택 → 전체 메시지 로드(읽음 처리됨)
  async function openConv(id) {
    setActiveId(id); setMsgs([]); lastIdRef.current = 0
    try {
      const res = await chatApi.messages(id)
      const list = res?.messages || []
      setMsgs(list)
      if (list.length) lastIdRef.current = list[list.length - 1].id
      loadConvs() // 안읽음 배지 갱신
    } catch (e) { setError(e.message) }
  }

  // 열린 대화에 새 메시지 폴링(3초) + 목록도 주기 갱신
  useEffect(() => {
    const t = setInterval(async () => {
      loadConvs()
      if (activeId == null) return
      try {
        const res = await chatApi.messages(activeId, lastIdRef.current || undefined)
        const incoming = res?.messages || []
        if (incoming.length) {
          lastIdRef.current = incoming[incoming.length - 1].id
          setMsgs((m) => [...m, ...incoming])
        }
      } catch { /* 무시 */ }
    }, 3000)
    return () => clearInterval(t)
  }, [activeId, loadConvs])

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, activeId])

  const active = convs.find((c) => c.id === activeId) || null

  async function send(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || activeId == null) return
    setDraft('')
    try {
      const saved = await chatApi.reply(activeId, text)
      setMsgs((m) => [...m, saved])
      lastIdRef.current = Math.max(lastIdRef.current, saved.id)
      loadConvs()
    } catch (e) { setError(e.message); setDraft(text) }
  }

  async function closeConv() {
    if (activeId == null) return
    try { await chatApi.close(activeId); loadConvs() } catch (e) { setError(e.message) }
  }

  return (
    <Shell>
      <Toast message={error} onClose={() => setError('')} />

      <div className="page-head">
        <h2>채팅 상담</h2>
        <span className="count">{convs.filter((c) => c.status === 'OPEN').length}건 진행 중</span>
      </div>

      {loading ? (
        <Loading label="대화를 불러오는 중…" />
      ) : (
        <div className="hc-layout">
          <aside className="hc-list">
            {convs.length === 0 && <div className="hc-empty" style={{ height: 120 }}>들어온 상담이 없습니다.</div>}
            {convs.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`hc-conv${c.id === activeId ? ' on' : ''}`}
                onClick={() => openConv(c.id)}
              >
                <div className="hc-conv-avatar">{(c.visitorName || '?').trim().charAt(0)}</div>
                <div className="hc-conv-meta">
                  <div className="hc-conv-top">
                    <span className="hc-conv-name">{c.visitorName}</span>
                    <span className="hc-conv-time">{fmtTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="hc-conv-last">{c.lastMessage || '(새 대화)'}</div>
                </div>
                {c.unreadForAdmin > 0 && <span className="hc-conv-badge">{c.unreadForAdmin}</span>}
                {c.status === 'CLOSED' && <span className="hc-conv-closed">완료</span>}
              </button>
            ))}
          </aside>

          <section className="hc-thread-wrap">
            {active ? (
              <>
                <header className="hc-thread-head">
                  <div className="hc-conv-avatar">{(active.visitorName || '?').trim().charAt(0)}</div>
                  <div>
                    <strong>{active.visitorName}</strong>
                    <span className="hc-thread-sub">{active.status === 'OPEN' ? '진행 중' : '완료'}</span>
                  </div>
                  {active.status === 'OPEN' && (
                    <button type="button" className="btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={closeConv}>
                      상담 종료
                    </button>
                  )}
                </header>

                <div className="hc-thread" ref={threadRef}>
                  {msgs.map((m) => (
                    <div key={m.id} className={`hc-msg ${m.sender === 'ADMIN' ? 'admin' : 'guest'}`}>
                      <div className="hc-msg-bubble">{m.text}</div>
                      <div className="hc-msg-time">{fmtTime(m.createdAt)}</div>
                    </div>
                  ))}
                </div>

                <form className="hc-reply" onSubmit={send}>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="답변을 입력하세요" aria-label="답변 입력" />
                  <button type="submit" className="btn-primary" disabled={!draft.trim()}>전송</button>
                </form>
              </>
            ) : (
              <div className="hc-empty">왼쪽에서 대화를 선택하세요.</div>
            )}
          </section>
        </div>
      )}
    </Shell>
  )
}
