import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminPath } from '../adminBase'
import Icon from './Icon'
import { inquiryApi, mailboxApi, tokenStore } from '../api/client'

const fmt = (dt) => (dt ? dt.slice(5, 16).replace('T', ' ').replace('-', '.') : '')

/**
 * 관리자 콘솔 상단 알림 벨.
 *   - 업체 문의(답변 대기) — 폴링 + 웹소켓
 *   - 새 메일 도착 — 웹소켓(NEW_MAIL). 자기 사번으로 온 메일만 온다. 진입 시 안 읽은 메일로 시드한다.
 * 업체가 문의를 남기거나 새 메일이 오면 벨이 흔들리고 배지에 합산해 보여준다.
 */
export default function AdminNotiBell() {
  const [items, setItems] = useState([]) // 답변 대기 문의
  const [mails, setMails] = useState([]) // 안 읽은/새로 도착한 메일
  const [open, setOpen] = useState(false)
  const [ring, setRing] = useState(false) // 실시간 도착 시 벨 흔들기
  const wrapRef = useRef(null)
  const navigate = useNavigate()

  // 실시간: 웹소켓으로 새 문의/새 메일 알림을 받는다. 끊기면 자동 재연결, 60초 폴링을 안전망으로 둔다.
  useEffect(() => {
    let alive = true
    let ws = null
    let reconnectTimer = null

    const refetchConvs = async () => {
      try { const list = await inquiryApi.tenantConvs(); if (alive) setItems((list || []).filter((c) => c.needsReply)) }
      catch { /* 무시 */ }
    }
    // 진입 시 안 읽은 받은메일을 벨에 시드한다(접속 전에 온 것도 보이게).
    const seedMails = async () => {
      try {
        const page = await mailboxApi.list({ folder: 'INBOX', size: 20 })
        if (!alive) return
        const unread = (page?.content || []).filter((m) => m.unread)
          .map((m) => ({ mailId: m.mailId, subject: m.subject, from: m.fromName || m.fromAddress, at: m.sentAt }))
        setMails(unread)
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
          // 새 메일 도착 — 목록 맨 앞에 추가(같은 메일 중복 제거).
          setMails((prev) => {
            const item = { mailId: msg.mailId, subject: msg.subject, from: msg.fromName, at: new Date().toISOString() }
            return [item, ...prev.filter((m) => m.mailId !== msg.mailId)].slice(0, 20)
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
    connect()
    const poll = setInterval(refetchConvs, 60000)
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

  const goTenant = (tenantId) => { setOpen(false); navigate(`${adminPath('/inquiries')}?tenant=${tenantId}`) }
  const goAll = () => { setOpen(false); navigate(adminPath('/inquiries')) }
  const goMail = (mailId) => {
    setOpen(false)
    setMails((prev) => prev.filter((m) => m.mailId !== mailId)) // 확인한 건 벨에서 내린다
    navigate(adminPath('/mailbox'))
  }

  const count = items.length + mails.length
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
            {count > 0 && <span className="noti-head-n">{count}</span>}
          </div>
          {count === 0 ? (
            <div className="noti-empty">새 알림이 없습니다.</div>
          ) : (
            <ul className="noti-list">
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
          {mails.length > 0 && <button type="button" className="noti-all" onClick={() => { setOpen(false); navigate(adminPath('/mailbox')) }}>메일함 열기</button>}
          <button type="button" className="noti-all" onClick={goAll}>문의 관리 전체 보기</button>
        </div>
      )}
    </div>
  )
}
