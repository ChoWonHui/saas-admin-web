import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CHATBOT } from '../../company-data'

/**
 * 회사 사이트 우하단 상담 챗봇(규칙 기반).
 *
 * AI 가 아니라 CHATBOT 데이터의 정해진 질문·답변·버튼으로 안내한다.
 * - 플로팅 버튼 → 패널 열림. 첫 화면에 메뉴 질문 버튼.
 * - 질문을 누르면 대화에 질문(오른쪽)·답변(왼쪽)이 쌓이고, 답변 아래 바로가기/후속질문 버튼이 뜬다.
 * - 바로가기(to)는 라우터 이동, (href)는 외부/전화 링크.
 */
export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState([]) // { who:'bot'|'me', text }
  const [actions, setActions] = useState([]) // 현재 답변의 바로가기 버튼
  const [choices, setChoices] = useState(CHATBOT.menu) // 지금 고를 수 있는 질문 key 들
  const bodyRef = useRef(null)
  const navigate = useNavigate()

  // 처음 열 때 인사말을 한 번 띄운다.
  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ who: 'bot', text: CHATBOT.greeting }])
    }
  }, [open, msgs.length])

  // 새 메시지가 쌓이면 맨 아래로 스크롤.
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, actions, choices])

  function ask(key) {
    const item = CHATBOT.items[key]
    if (!item) return
    setMsgs((m) => [...m, { who: 'me', text: item.q }, { who: 'bot', text: item.a }])
    setActions(item.actions || [])
    // 후속 질문이 있으면 그걸, 없으면 처음 메뉴로 되돌린다.
    setChoices(item.follow && item.follow.length ? item.follow : CHATBOT.menu)
  }

  function doAction(a) {
    if (a.to) { setOpen(false); navigate(a.to) }
    else if (a.href) { window.open(a.href, a.href.startsWith('tel:') ? '_self' : '_blank', 'noopener') }
  }

  function reset() {
    setMsgs([{ who: 'bot', text: CHATBOT.greeting }])
    setActions([])
    setChoices(CHATBOT.menu)
  }

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
              <span className="kc-chat-dot" />
              <div>
                <strong>KANCHENJUNGA 상담</strong>
                <span className="kc-chat-sub">보통 몇 분 내 답변드려요</span>
              </div>
            </div>
            <button type="button" className="kc-chat-x" onClick={() => setOpen(false)} aria-label="닫기">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

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
          </div>

          <div className="kc-chat-choices">
            {choices.map((key) => (
              <button key={key} type="button" className="kc-chat-choice" onClick={() => ask(key)}>
                {CHATBOT.items[key]?.q}
              </button>
            ))}
            {msgs.length > 1 && (
              <button type="button" className="kc-chat-choice kc-chat-reset" onClick={reset}>
                처음으로
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
