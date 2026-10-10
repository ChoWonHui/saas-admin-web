import { useEffect, useRef, useState } from 'react'
import SiteShell, { SubHead } from '../../components/company/SiteShell'
import { BRAND } from '../../company-data'

/**
 * 홈페이지 채팅 문의 화면(/home-chat). 방문자가 실시간으로 상담을 남기는 전용 페이지.
 *
 * ⚠️ 지금은 화면(UI)만 만든 단계다. 보낸 메시지는 로컬 상태에만 쌓이고, 자동 응답은 안내 문구다.
 *    백엔드(대화 생성 + 메시지 저장 + 관리자 답변 실시간 수신) 연동은 다음 단계에서 붙인다.
 *    연동 지점: 대화 시작(이름 등록) / 메시지 전송 / 관리자 답변 수신(WebSocket·polling) 세 곳.
 */
const fmtTime = (dt) => (dt ? dt.slice(11, 16) : '')

export default function HomeChatPage() {
  const [started, setStarted] = useState(false)
  const [name, setName] = useState('')
  const [msgs, setMsgs] = useState([])
  const [draft, setDraft] = useState('')
  const threadRef = useRef(null)

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, started])

  function start(e) {
    e.preventDefault()
    // TODO(백엔드): 대화 생성 API 호출. 지금은 로컬로 시작.
    setStarted(true)
    setMsgs([
      { id: 1, who: 'bot', text: `안녕하세요${name ? ` ${name}님` : ''}! KANCHENJUNGA 상담입니다.\n무엇을 도와드릴까요? 메시지를 남겨주시면 담당자가 확인 후 답변드립니다.`, at: new Date().toISOString() },
    ])
  }

  function send(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    // TODO(백엔드): 메시지 전송 API 호출. 지금은 로컬 상태에만 추가.
    const now = new Date().toISOString()
    setMsgs((m) => [...m, { id: Date.now(), who: 'me', text, at: now }])
    setDraft('')
    // 임시 자동 안내(백엔드 연동 시 관리자 실제 답변으로 대체)
    setTimeout(() => {
      setMsgs((m) => [...m, { id: Date.now() + 1, who: 'bot', text: '메시지가 접수되었습니다. 담당자가 확인 후 곧 답변드리겠습니다. 급하시면 02-6013-1717 로 연락 주세요.', at: new Date().toISOString() }])
    }, 600)
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
            </div>

            {!started ? (
              <form className="kc-chatpage-start" onSubmit={start}>
                <p>실시간 상담을 시작합니다. 성함을 남겨주시면 더 빠르게 안내해 드려요. (선택)</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="성함 (선택)"
                  aria-label="성함"
                />
                <button type="submit" className="kc-btn kc-btn-primary">상담 시작하기</button>
              </form>
            ) : (
              <>
                <div className="kc-chatpage-thread" ref={threadRef}>
                  {msgs.map((m) => (
                    <div key={m.id} className={`kc-chatpage-msg ${m.who}`}>
                      <div className="kc-chatpage-bubble">{m.text}</div>
                      <div className="kc-chatpage-time">{fmtTime(m.at)}</div>
                    </div>
                  ))}
                </div>
                <form className="kc-chatpage-input" onSubmit={send}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="메시지를 입력하세요"
                    aria-label="메시지 입력"
                  />
                  <button type="submit" className="kc-btn kc-btn-primary" disabled={!draft.trim()}>전송</button>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
