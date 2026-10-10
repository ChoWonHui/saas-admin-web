import { useEffect, useRef, useState } from 'react'
import Shell from '../components/Shell'
import Toast from '../components/Toast'

/**
 * 홈페이지 채팅 상담 — 관리자 답변 화면.
 *
 * ⚠️ 지금은 화면(UI)만 만든 단계다. 대화·메시지는 아래 MOCK 데이터이고 전송은 로컬 상태에만 쌓인다.
 *    백엔드(대화/메시지 저장 + 실시간 수신) 연동은 다음 단계에서 붙인다.
 *    연동 지점: 목록 로드 / 메시지 로드 / 답변 전송 / 새 메시지 수신(WebSocket) 네 곳.
 *
 * 좌측에 들어온 대화 목록, 우측에 메시지 스레드 + 답변 입력창을 둔다.
 */

// --- 임시 목업 (백엔드 연동 시 삭제) ---
const MOCK_CONVS = [
  { id: 1, name: '김민수', lastMessage: '홈페이지 제작 비용이 궁금해서요', lastAt: '2026-10-10T14:32', unread: 2, status: 'OPEN' },
  { id: 2, name: '방문자 (익명)', lastMessage: '유지보수도 같이 맡기면 할인되나요?', lastAt: '2026-10-10T13:05', unread: 0, status: 'OPEN' },
  { id: 3, name: '이정현', lastMessage: '감사합니다! 메일 확인했습니다', lastAt: '2026-10-09T18:20', unread: 0, status: 'CLOSED' },
]
const MOCK_MSGS = {
  1: [
    { id: 1, who: 'guest', text: '안녕하세요, 홈페이지 제작 문의드려요', at: '2026-10-10T14:30' },
    { id: 2, who: 'guest', text: '홈페이지 제작 비용이 궁금해서요', at: '2026-10-10T14:32' },
  ],
  2: [
    { id: 1, who: 'guest', text: '유지보수도 같이 맡기면 할인되나요?', at: '2026-10-10T13:05' },
    { id: 2, who: 'admin', text: '안녕하세요! 제작과 유지보수를 함께 진행하시면 상담 시 조정해 드리고 있습니다.', at: '2026-10-10T13:10' },
  ],
  3: [
    { id: 1, who: 'guest', text: '견적서 메일로 받을 수 있을까요?', at: '2026-10-09T18:10' },
    { id: 2, who: 'admin', text: '네, 보내드렸습니다. 확인 부탁드려요.', at: '2026-10-09T18:15' },
    { id: 3, who: 'guest', text: '감사합니다! 메일 확인했습니다', at: '2026-10-09T18:20' },
  ],
}

const fmtTime = (dt) => (dt ? dt.slice(5, 16).replace('T', ' ') : '')

export default function HomeChatPage() {
  const [convs] = useState(MOCK_CONVS)
  const [activeId, setActiveId] = useState(MOCK_CONVS[0]?.id ?? null)
  const [msgsByConv, setMsgsByConv] = useState(MOCK_MSGS)
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')
  const threadRef = useRef(null)

  const active = convs.find((c) => c.id === activeId) || null
  const msgs = (activeId != null && msgsByConv[activeId]) || []

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, activeId])

  function send(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || activeId == null) return
    // TODO(백엔드): 여기서 답변을 서버로 전송한다. 지금은 로컬 상태에만 추가.
    setMsgsByConv((prev) => ({
      ...prev,
      [activeId]: [...(prev[activeId] || []), { id: Date.now(), who: 'admin', text, at: new Date().toISOString().slice(0, 16) }],
    }))
    setDraft('')
  }

  return (
    <Shell>
      <Toast message={notice} onClose={() => setNotice('')} />

      <div className="page-head">
        <h2>채팅 상담</h2>
        <span className="count">{convs.filter((c) => c.status === 'OPEN').length}건 진행 중</span>
      </div>

      {/* ⚠️ 화면만 만든 단계 안내 — 백엔드 연동 후 제거 */}
      <p className="alert" style={{ background: '#fff7ed', color: '#9a3412', borderColor: '#fed7aa' }}>
        현재는 화면(UI)만 구성된 상태입니다. 실제 대화 저장·실시간 수신·전송은 백엔드 연동 후 동작합니다.
      </p>

      <div className="hc-layout">
        {/* 좌측 — 대화 목록 */}
        <aside className="hc-list">
          {convs.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`hc-conv${c.id === activeId ? ' on' : ''}`}
              onClick={() => setActiveId(c.id)}
            >
              <div className="hc-conv-avatar">{(c.name || '?').trim().charAt(0)}</div>
              <div className="hc-conv-meta">
                <div className="hc-conv-top">
                  <span className="hc-conv-name">{c.name}</span>
                  <span className="hc-conv-time">{fmtTime(c.lastAt)}</span>
                </div>
                <div className="hc-conv-last">{c.lastMessage}</div>
              </div>
              {c.unread > 0 && <span className="hc-conv-badge">{c.unread}</span>}
              {c.status === 'CLOSED' && <span className="hc-conv-closed">완료</span>}
            </button>
          ))}
        </aside>

        {/* 우측 — 메시지 스레드 + 답변 입력 */}
        <section className="hc-thread-wrap">
          {active ? (
            <>
              <header className="hc-thread-head">
                <div className="hc-conv-avatar">{(active.name || '?').trim().charAt(0)}</div>
                <div>
                  <strong>{active.name}</strong>
                  <span className="hc-thread-sub">{active.status === 'OPEN' ? '진행 중' : '완료'}</span>
                </div>
              </header>

              <div className="hc-thread" ref={threadRef}>
                {msgs.map((m) => (
                  <div key={m.id} className={`hc-msg ${m.who}`}>
                    <div className="hc-msg-bubble">{m.text}</div>
                    <div className="hc-msg-time">{fmtTime(m.at)}</div>
                  </div>
                ))}
              </div>

              <form className="hc-reply" onSubmit={send}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="답변을 입력하세요"
                  aria-label="답변 입력"
                />
                <button type="submit" className="btn-primary" disabled={!draft.trim()}>전송</button>
              </form>
            </>
          ) : (
            <div className="hc-empty">왼쪽에서 대화를 선택하세요.</div>
          )}
        </section>
      </div>
    </Shell>
  )
}
