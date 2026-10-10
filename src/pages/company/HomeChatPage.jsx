import { useCallback, useEffect, useRef, useState } from 'react'
import SiteShell, { SubHead } from '../../components/company/SiteShell'
import { BRAND, CONTACT } from '../../company-data'
import { chatPublicApi } from '../../api/homeClient'

/**
 * 홈페이지 채팅 문의 화면(/home-chat). 방문자가 실시간으로 상담한다.
 *
 * - 대화 시작 시 서버가 토큰을 발급 → localStorage 에 보관(새로고침해도 이어진다).
 * - 보낸 메시지는 서버에 저장되고, 관리자 답변은 폴링(3초)으로 가져온다.
 */
const LS_KEY = 'kc.chat.session'
const fmtTime = (dt) => (dt ? dt.slice(11, 16) : '')

function loadSession() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null }
}
function saveSession(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* 무시 */ }
}

export default function HomeChatPage() {
  const [session, setSession] = useState(loadSession) // { id, token }
  const [name, setName] = useState('')
  const [msgs, setMsgs] = useState([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const threadRef = useRef(null)
  const lastIdRef = useRef(0)

  const started = !!session

  // 스크롤 맨 아래로
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, started])

  // 관리자 답변 폴링(3초). 대화가 있을 때만 돈다.
  const poll = useCallback(async () => {
    if (!session) return
    try {
      const res = await chatPublicApi.messages(session.id, session.token, lastIdRef.current || undefined)
      const incoming = res?.messages || []
      if (incoming.length) {
        lastIdRef.current = incoming[incoming.length - 1].id
        setMsgs((m) => [...m, ...incoming])
      }
    } catch (e) {
      // 토큰이 깨졌거나 대화가 없으면 세션 초기화
      if (e.status === 403 || e.status === 404) { localStorage.removeItem(LS_KEY); setSession(null); lastIdRef.current = 0 }
    }
  }, [session])

  useEffect(() => {
    if (!session) return undefined
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [session, poll])

  async function start(e) {
    e.preventDefault()
    setError('')
    try {
      const res = await chatPublicApi.start(name.trim() || null)
      const s = { id: res.conversationId, token: res.token }
      saveSession(s); setSession(s); lastIdRef.current = 0
      setMsgs([{ id: 0, sender: 'BOT', text: `안녕하세요${name.trim() ? ` ${name.trim()}님` : ''}! ${BRAND.name} 상담입니다.\n무엇을 도와드릴까요? 메시지를 남겨주시면 담당자가 확인 후 답변드립니다.`, createdAt: new Date().toISOString() }])
    } catch (e) { setError(e.message || '상담을 시작하지 못했습니다.') }
  }

  async function send(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !session || sending) return
    setSending(true); setError('')
    // 낙관적 추가
    const temp = { id: `t${Date.now()}`, sender: 'GUEST', text, createdAt: new Date().toISOString() }
    setMsgs((m) => [...m, temp])
    setDraft('')
    try {
      const saved = await chatPublicApi.send(session.id, session.token, text)
      // 임시 메시지를 서버 id 로 교체하고 lastId 갱신
      setMsgs((m) => m.map((x) => (x.id === temp.id ? saved : x)))
      lastIdRef.current = Math.max(lastIdRef.current, saved.id)
    } catch (e) {
      setError(e.message || '메시지를 보내지 못했습니다.')
      setMsgs((m) => m.filter((x) => x.id !== temp.id))
      setDraft(text)
    } finally { setSending(false) }
  }

  function endChat() {
    localStorage.removeItem(LS_KEY)
    setSession(null); setMsgs([]); lastIdRef.current = 0
  }

  return (
    <SiteShell solidHeader title="채팅 상담">
      <SubHead title="채팅 상담" />

      <section className="kc-sec">
        <div className="kc-wrap">
          <div className="kc-chatpage">
            <div className="kc-chatpage-head">
              <span className="kc-chatpage-dot" />
              <div>
                <strong>{BRAND.name} 상담</strong>
                <span className="kc-chatpage-sub">보통 몇 분 내 답변드려요</span>
              </div>
              {started && (
                <button type="button" className="kc-chatpage-end" onClick={endChat}>새 상담</button>
              )}
            </div>

            {!started ? (
              <form className="kc-chatpage-start" onSubmit={start}>
                <p>실시간 상담을 시작합니다. 성함을 남겨주시면 더 빠르게 안내해 드려요. (선택)</p>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="성함 (선택)" aria-label="성함" />
                {error && <p className="kc-chatpage-err">{error}</p>}
                <button type="submit" className="kc-btn kc-btn-primary">상담 시작하기</button>
                <span className="kc-chatpage-alt">전화 상담: {CONTACT.phone}</span>
              </form>
            ) : (
              <>
                <div className="kc-chatpage-thread" ref={threadRef}>
                  {msgs.map((m) => (
                    <div key={m.id} className={`kc-chatpage-msg ${m.sender === 'GUEST' ? 'me' : 'bot'}`}>
                      <div className="kc-chatpage-bubble">{m.text}</div>
                      <div className="kc-chatpage-time">{fmtTime(m.createdAt)}</div>
                    </div>
                  ))}
                </div>
                {error && <p className="kc-chatpage-err" style={{ padding: '0 12px' }}>{error}</p>}
                <form className="kc-chatpage-input" onSubmit={send}>
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="메시지를 입력하세요" aria-label="메시지 입력" />
                  <button type="submit" className="kc-btn kc-btn-primary" disabled={!draft.trim() || sending}>전송</button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
