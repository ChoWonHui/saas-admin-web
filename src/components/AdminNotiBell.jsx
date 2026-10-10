import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminPath } from '../adminBase'
import Icon from './Icon'
import { inquiryApi, mailboxApi, chatApi, tokenStore } from '../api/client'

const fmt = (dt) => (dt ? dt.slice(5, 16).replace('T', ' ').replace('-', '.') : '')

/**
 * 관리자 콘솔 상단 알림 벨.
 *   - 업체 문의(답변 대기) · 새 메일(NEW_MAIL) · 새 채팅(NEW_CHAT) 을 한곳에 모아 보여준다.
 *   - 항목을 누르면 해당 메뉴로 바로 이동한다(하단 바로가기 버튼은 두지 않는다).
 *   - '모두 읽음' 으로 벨의 알림을 한 번에 비운다.
 */
export default function AdminNotiBell() {
  const [items, setItems] = useState([])  // 답변 대기 문의
  const [mails, setMails] = useState([])  // 안 읽은/새로 도착한 메일
  const [chats, setChats] = useState([])  // 안 읽은 채팅 대화
  const [open, setOpen] = useState(false)
  const [ring, setRing] = useState(false)
  const wrapRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    let alive = true
    let ws = null
    let reconnectTimer = null

    const refetchConvs = async () => {
      try { const list = await inquiryApi.tenantConvs(); if (alive) setItems((list || []).filter((c) => c.needsReply)) }
      catch { /* 무시 */ }
    }
    const seedMails = async () => {
      try {
        const page = await mailboxApi.list({ folder: 'INBOX', size: 20 })
        if (!alive) return
        setMails((page?.content || []).filter((m) => m.unread)
          .map((m) => ({ mailId: m.mailId, subject: m.subject, from: m.fromName || m.fromAddress, at: m.sentAt })))
      } catch { /* 무시 */ }
    }
    const seedChats = async () => {
      try {
        const list = await chatApi.conversations()
        if (!alive) return
        setChats((list || []).filter((c) => c.unreadForAdmin > 0)
          .map((c) => ({ id: c.id, name: c.visitorName, last: c.lastMessage, at: c.lastMessageAt })))
      } catch { /* 무시 */ }
    }
    const bell = () => { setRing(true); setTimeout(() => { if (alive) setRing(false) }, 1400) }

    const connect = () => {
      if (!alive) return
      const token = tokenStore.access
      if (!token) { reconnectTimer = setTimeout(connect, 4000); return }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      try { ws = new WebSocket(`${proto}//${window.location.host}/ws/admin-notify?token=${encodeURIComponent(token)}`) }
      catch { reconnectTimer = setTimeout(connect, 4000); return }
      ws.onmessage = (e) => {
        let msg = null
        try { msg = JSON.parse(e.data) } catch { /* 옛 서버는 빈 신호만 보낸다 */ }
        if (msg && msg.type === 'NEW_MAIL') {
          setMails((prev) => {
            const item = { mailId: msg.mailId, subject: msg.subject, from: msg.fromName, at: new Date().toISOString() }
            return [item, ...prev.filter((m) => m.mailId !== msg.mailId)].slice(0, 20)
          })
        } else if (msg && msg.type === 'NEW_CHAT') {
          setChats((prev) => {
            const item = { id: msg.conversationId, name: msg.visitorName, last: msg.text, at: new Date().toISOString() }
            return [item, ...prev.filter((c) => c.id !== msg.conversationId)].slice(0, 20)
          })
        } else {
          refetchConvs()
        }
        bell()
      }
      ws.onclose = () => { if (alive) reconnectTimer = setTimeout(connect, 4000) }
      ws.onerror = () => { try { ws.close() } catch { /* noop */ } }
    }

    refetchConvs()
    seedMails()
    seedChats()
    connect()
    const poll = setInterval(() => { refetchConvs(); seedChats() }, 60000)
    return () => {
      alive = false
      clearInterval(poll)
      clearTimeout(reconnectTimer)
      if (ws) { ws.onclose = null; try { ws.close() } catch { /* noop */ } }
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // 항목 클릭 → 해당 메뉴로 자동 이동 + 벨에서 내린다.
  const goMail = (mailId) => { setOpen(false); setMails((p) => p.filter((m) => m.mailId !== mailId)); navigate(adminPath('/mailbox')) }
  const goTenant = (tenantId) => { setOpen(false); navigate(`${adminPath('/inquiries')}?tenant=${tenantId}`) }
  const goChat = (id) => { setOpen(false); setChats((p) => p.filter((c) => c.id !== id)); navigate(adminPath('/home-chat')) }

  // 전체 읽음 — 벨의 알림을 모두 비운다.
  const readAll = () => { setMails([]); setChats([]); setItems([]) }

  const count = items.length + mails.length + chats.length
  return (
    <div className="noti-wrap" ref={wrapRef}>
      <button type="button" className={`noti-bell${open ? ' on' : ''}${ring ? ' ring' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={`알림 ${count}건`}>
        <Icon name="notifications" filled={count > 0} />
        {count > 0 && <span className="noti-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="noti-panel">
          <div className="noti-head">
            <span>알림</span>
            <span className="noti-head-r">
              {count > 0 && <span className="noti-head-n">{count}</span>}
              {count > 0 && <button type="button" className="noti-readall" onClick={readAll}>모두 읽음</button>}
            </span>
          </div>
          {count === 0 ? (
            <div className="noti-empty">새 알림이 없습니다.</div>
          ) : (
            <ul className="noti-list">
              {chats.slice(0, 8).map((c) => (
                <li key={`chat-${c.id}`}>
                  <button type="button" className="noti-item" onClick={() => goChat(c.id)}>
                    <span className="noti-item-ic"><Icon name="forum" /></span>
                    <span className="noti-item-txt">
                      <span className="noti-item-title">{c.name || '방문자'} · 채팅</span>
                      <span className="noti-item-sub">{c.last || '새 메시지'} · {fmt(c.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {mails.slice(0, 8).map((m) => (
                <li key={`mail-${m.mailId}`}>
                  <button type="button" className="noti-item" onClick={() => goMail(m.mailId)}>
                    <span className="noti-item-ic"><Icon name="mail" /></span>
                    <span className="noti-item-txt">
                      <span className="noti-item-title">{m.from || '새 메일'}</span>
                      <span className="noti-item-sub">{m.subject || '(제목 없음)'} · {fmt(m.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {items.slice(0, 8).map((c) => (
                <li key={`conv-${c.tenantId}`}>
                  <button type="button" className="noti-item" onClick={() => goTenant(c.tenantId)}>
                    <span className="noti-item-ic"><Icon name="storefront" /></span>
                    <span className="noti-item-txt">
                      <span className="noti-item-title">{c.tenantName}</span>
                      <span className="noti-item-sub">{c.lastMessage || '새 문의'} · {fmt(c.lastAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
