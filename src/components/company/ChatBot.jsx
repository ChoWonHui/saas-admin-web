import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CHATBOT, BRAND } from '../../company-data'
import { chatPublicApi } from '../../api/homeClient'

/**
 * 회사 사이트 우하단 상담 챗봇. 두 가지 모드를 한 창에서 쓴다.
 *  - FAQ 모드: 정해진 질문·답변·버튼 안내(규칙 기반). 선택지는 대화 흐름 안에 쌓여 함께 스크롤된다.
 *  - 실시간(LIVE) 모드: '상담원과 채팅하기' → 같은 창에서 상담원과 실제 대화(백엔드 연동, 3초 폴링).
 *
 * 선택지를 별도 하단 영역이 아니라 대화 본문 맨 아래에 두어, 스크롤로 전체 목록을 확인할 수 있게 한다.
 */
const LS_KEY = 'kc.chat.session'
const fmtTime = (dt) => (dt ? dt.slice(11, 16) : '')
const loadSession = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null } }
const saveSession = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch { /* 무시 */ } }

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('faq') // 'faq' | 'live'
  const navigate = useNavigate()
  const bodyRef = useRef(null)

  // --- FAQ 모드 상태 ---
  const [msgs, setMsgs] = useState([])
  const [actions, setActions] = useState([])
  const [choices, setChoices] = useState(CHATBOT.menu)

  // --- 실시간 모드 상태 ---
  const [session, setSession] = useState(loadSession)
  const [liveMsgs, setLiveMsgs] = useState([])
  const [draft, setDraft] = useState('')
  const [liveErr, setLiveErr] = useState('')
  const lastIdRef = useRef(0)

  // 처음 열 때 인사말
  useEffect(() => {
    if (open && mode === 'faq' && msgs.length === 0) setMsgs([{ who: 'bot', text: CHATBOT.greeting }])
  }, [open, mode, msgs.length])

  // 맨 아래로 스크롤
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, actions, choices, liveMsgs, mode])

  function ask(key) {
    const item = CHATBOT.items[key]
    if (!item) return
    setMsgs((m) => [...m, { who: 'me', text: item.q }, { who: 'bot', text: item.a }])
    setActions(item.actions || [])
    setChoices(item.follow && item.follow.length ? item.follow : CHATBOT.menu)
  }

  function doAction(a) {
    if (a.to) { setOpen(false); navigate(a.to) }
    else if (a.href) { window.open(a.href, a.href.startsWith('tel:') ? '_self' : '_blank', 'noopener') }
  }

  function resetFaq() {
    setMsgs([{ who: 'bot', text: CHATBOT.greeting }])
    setActions([])
    setChoices(CHATBOT.menu)
  }

  // --- 실시간: 대화 시작 ---
  async function startLive() {
    setMode('live'); setLiveErr('')
    if (session) { // 기존 대화 이어가기
      setLiveMsgs([]); lastIdRef.current = 0
      return
    }
    try {
      const res = await chatPublicApi.start(null)
      const s = { id: res.conversationId, token: res.token }
      saveSession(s); setSession(s); lastIdRef.current = 0
      setLiveMsgs([{ id: 0, sender: 'BOT', text: `안녕하세요! ${BRAND.name} 상담원 연결 중입니다.\n메시지를 남겨주시면 확인 후 답변드립니다. 보통 몇 분 내 답변드려요.`, createdAt: new Date().toISOString() }])
    } catch (e) { setLiveErr(e.message || '상담 연결에 실패했습니다.'); setMode('faq') }
  }

  // --- 실시간: 폴링 ---
  const poll = useCallback(async () => {
    if (!session) return
    try {
      const res = await chatPublicApi.messages(session.id, session.token, lastIdRef.current || undefined)
      const incoming = res?.messages || []
      if (incoming.length) {
        lastIdRef.current = incoming[incoming.length - 1].id
        setLiveMsgs((m) => [...m, ...incoming])
      }
    } catch (e) {
      if (e.status === 403 || e.status === 404) { localStorage.removeItem(LS_KEY); setSession(null); lastIdRef.current = 0 }
    }
  }, [session])

  useEffect(() => {
    if (!open || mode !== 'live' || !session) return undefined
    const t = setInterval(poll, 3000)
    return () => clearInterval(t)
  }, [open, mode, session, poll])

  async function sendLive(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !session) return
    setLiveErr('')
    const temp = { id: `t${Date.now()}`, sender: 'GUEST', text, createdAt: new Date().toISOString() }
    setLiveMsgs((m) => [...m, temp]); setDraft('')
    try {
      const saved = await chatPublicApi.send(session.id, session.token, text)
      setLiveMsgs((m) => m.map((x) => (x.id === temp.id ? saved : x)))
      lastIdRef.current = Math.max(lastIdRef.current, saved.id)
    } catch (e) {
      setLiveErr(e.message || '메시지를 보내지 못했습니다.')
      setLiveMsgs((m) => m.filter((x) => x.id !== temp.id)); setDraft(text)
    }
  }

  const title = mode === 'live' ? `${BRAND.name} 실시간 상담` : `${BRAND.name} 상담`

  return (
    <>
      <button
        type="button"
        className={`kc-chat-fab${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? '상담 닫기' : '상담 열기'}
      >
        <span className="material-symbols-outlined">{open ? 'close' : 'chat_bubble'}</span>
      </button>

      {open && (
        <div className="kc-chat" role="dialog" aria-label="KANCHENJUNGA 상담">
          <div className="kc-chat-head">
            <div className="kc-chat-head-l">
              {mode === 'live' && (
                <button type="button" className="kc-chat-back" onClick={() => setMode('faq')} aria-label="뒤로">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
              )}
              <span className="kc-chat-dot" />
              <div>
                <strong>{title}</strong>
                <span className="kc-chat-sub">보통 몇 분 내 답변드려요</span>
              </div>
            </div>
            <button type="button" className="kc-chat-x" onClick={() => setOpen(false)} aria-label="닫기">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {mode === 'faq' ? (
            <>
              <div className="kc-chat-body" ref={bodyRef}>
                {msgs.map((m, i) => (
                  <div key={i} className={`kc-chat-msg ${m.who}`}>{m.text}</div>
                ))}

                {actions.length > 0 && (
                  <div className="kc-chat-actions">
                    {actions.map((a) => (
                      <button key={a.label} type="button" className="kc-chat-action" onClick={() => doAction(a)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* 선택지를 본문 안에 둬서 전체가 함께 스크롤된다(목록이 더 있는지 보인다). */}
                <div className="kc-chat-choices-inline">
                  <button type="button" className="kc-chat-choice kc-chat-live" onClick={startLive}>
                    <span className="material-symbols-outlined">forum</span>
                    상담원과 채팅하기
                  </button>
                  {choices.map((key) => (
                    <button key={key} type="button" className="kc-chat-choice" onClick={() => ask(key)}>
                      {CHATBOT.items[key]?.q}
                    </button>
                  ))}
                  {msgs.length > 1 && (
                    <button type="button" className="kc-chat-choice kc-chat-reset" onClick={resetFaq}>처음으로</button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="kc-chat-body" ref={bodyRef}>
                {liveMsgs.map((m) => (
                  <div key={m.id} className={`kc-chat-msg ${m.sender === 'GUEST' ? 'me' : 'bot'}`}>{m.text}
                    <span className="kc-chat-time">{fmtTime(m.createdAt)}</span>
                  </div>
                ))}
                {liveErr && <div className="kc-chat-liveerr">{liveErr}</div>}
              </div>
              <form className="kc-chat-input" onSubmit={sendLive}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="메시지를 입력하세요" aria-label="메시지 입력" />
                <button type="submit" className="kc-chat-send" disabled={!draft.trim()} aria-label="전송">
                  <span className="material-symbols-outlined">send</span>
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  )
}
