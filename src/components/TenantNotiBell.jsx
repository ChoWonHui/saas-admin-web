import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { tenantInquiryApi, tenantTokenStore } from '../api/tenantClient'

const SEEN_KEY = 'saas.tenant.inqSeenAt'

/**
 * 업체(사장님) 콘솔 알림 벨 — 실시간 웹소켓으로 두 종류 알림을 받는다.
 *  · ADMIN_REPLY: 관리자의 답변이 도착했습니다 → 문의
 *  · NEW_ORDER : 새 주문이 들어왔습니다 → 주문 관리
 * 벨을 누르면 알림 목록이 뜨고, 항목을 누르면 해당 화면으로 이동한다.
 */
export default function TenantNotiBell() {
  const [open, setOpen] = useState(false)
  const [notis, setNotis] = useState([]) // { id, kind, title, sub, to }
  const [ring, setRing] = useState(false)
  const wrapRef = useRef(null)
  const idRef = useRef(0)
  const navigate = useNavigate()
  const location = useLocation()

  const addNoti = (n) => setNotis((prev) => [{ id: ++idRef.current, ...n }, ...prev].slice(0, 10))

  const refresh = async () => {
    try {
      const list = await tenantInquiryApi.list()
      const seen = Number(localStorage.getItem(SEEN_KEY) || 0)
      const answered = (list || []).some((q) => q.status === 'ANSWERED' && new Date(q.updatedAt).getTime() > seen)
      if (answered) {
        setNotis((prev) => (prev.some((n) => n.kind === 'reply')
          ? prev
          : [{ id: ++idRef.current, kind: 'reply', title: '관리자의 답변이 도착했습니다', sub: '', to: '/admin/inquiries' }, ...prev]))
      }
    } catch { /* 무시 */ }
  }

  useEffect(() => {
    let alive = true, ws = null, reconnect = null
    refresh()
    const connect = () => {
      if (!alive) return
      const token = tenantTokenStore.access
      if (!token) { reconnect = setTimeout(connect, 4000); return }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      try { ws = new WebSocket(`${proto}//${window.location.host}/ws/tenant-notify?token=${encodeURIComponent(token)}`) }
      catch { reconnect = setTimeout(connect, 4000); return }
      ws.onmessage = (e) => {
        let m = {}
        try { m = JSON.parse(e.data) } catch { /* noop */ }
        if (m.type === 'ADMIN_REPLY') {
          addNoti({ kind: 'reply', title: '관리자의 답변이 도착했습니다', sub: m.preview || '', to: '/admin/inquiries' })
        } else if (m.type === 'NEW_ORDER') {
          const label = (m.tableLabel || '테이블').slice(0, 14)
          const amt = m.amount ? `${Number(m.amount).toLocaleString()}원` : ''
          addNoti({ kind: 'order', title: `${label}에 주문이 들어왔습니다`, sub: amt, to: '/admin/orders' })
        } else return
        setRing(true); setTimeout(() => { if (alive) setRing(false) }, 1400)
      }
      ws.onclose = () => { if (alive) reconnect = setTimeout(connect, 4000) }
      ws.onerror = () => { try { ws.close() } catch { /* noop */ } }
    }
    connect()
    return () => { alive = false; clearTimeout(reconnect); if (ws) { ws.onclose = null; try { ws.close() } catch { /* noop */ } } }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // 해당 화면에 들어가면 그 종류 알림은 읽음 처리.
  useEffect(() => {
    if (location.pathname.startsWith('/admin/inquiries')) {
      localStorage.setItem(SEEN_KEY, String(Date.now()))
      setNotis((prev) => prev.filter((n) => n.kind !== 'reply'))
    }
    if (location.pathname.startsWith('/admin/orders')) {
      setNotis((prev) => prev.filter((n) => n.kind !== 'order'))
    }
  }, [location.pathname])

  const unread = notis.length > 0
  const openNoti = (n) => {
    setOpen(false)
    if (n.kind === 'reply') localStorage.setItem(SEEN_KEY, String(Date.now()))
    setNotis((prev) => prev.filter((x) => x.id !== n.id))
    navigate(n.to)
  }

  return (
    <div className="m-noti-wrap" ref={wrapRef}>
      <button type="button" className={`m-icon-btn m-noti${ring ? ' ring' : ''}`} title="알림" onClick={() => setOpen((o) => !o)} aria-label={unread ? `새 알림 ${notis.length}건` : '알림'}>
        <Icon name="notifications" filled={unread} />
        {unread && <span className="m-noti-badge">{notis.length}</span>}
      </button>
      {open && (
        <div className="m-noti-panel">
          <div className="m-noti-ptitle">알림</div>
          {unread ? (
            <ul className="m-noti-list">
              {notis.map((n) => (
                <li key={n.id}>
                  <button type="button" className="m-noti-item" onClick={() => openNoti(n)}>
                    <span className={`m-noti-item-ic ${n.kind}`}><Icon name={n.kind === 'order' ? 'receipt_long' : 'mark_chat_read'} /></span>
                    <span className="m-noti-item-txt">
                      <span className="m-noti-item-title">{n.title}</span>
                      {n.sub && <span className="m-noti-item-sub">{n.sub}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="m-noti-none">새 알림이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  )
}
