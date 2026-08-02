import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminPath } from '../adminBase'
import Icon from './Icon'
import { inquiryApi, tokenStore } from '../api/client'

const fmt = (dt) => (dt ? dt.slice(5, 16).replace('T', ' ').replace('-', '.') : '')

/**
 * 관리자 콘솔 상단 알림 벨 — 답변 대기(OPEN) 문의를 주기적으로 폴링해 배지로 알린다.
 * 업체가 문의/재문의를 남기면 상태가 OPEN 이 되므로, 사실상 "새 대화 알림"이 된다.
 */
export default function AdminNotiBell() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [ring, setRing] = useState(false) // 실시간 도착 시 벨 흔들기
  const wrapRef = useRef(null)
  const navigate = useNavigate()

  // 실시간: 웹소켓으로 새 문의 알림을 받는다. 끊기면 자동 재연결하고, 60초 폴링을 안전망으로 둔다.
  useEffect(() => {
    let alive = true
    let ws = null
    let reconnectTimer = null

    const refetch = async () => {
      try { const list = await inquiryApi.tenantConvs(); if (alive) setItems((list || []).filter((c) => c.needsReply)) }
      catch { /* 무시 */ }
    }
    const connect = () => {
      if (!alive) return
      const token = tokenStore.access
      if (!token) { reconnectTimer = setTimeout(connect, 4000); return }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      try { ws = new WebSocket(`${proto}//${window.location.host}/ws/admin-notify?token=${encodeURIComponent(token)}`) }
      catch { reconnectTimer = setTimeout(connect, 4000); return }
      ws.onmessage = () => {
        refetch()
        setRing(true)
        setTimeout(() => { if (alive) setRing(false) }, 1400)
      }
      ws.onclose = () => { if (alive) reconnectTimer = setTimeout(connect, 4000) }
      ws.onerror = () => { try { ws.close() } catch { /* noop */ } }
    }

    refetch()
    connect()
    const poll = setInterval(refetch, 60000)
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

  const count = items.length
  return (
    <div className="noti-wrap" ref={wrapRef}>
      <button type="button" className={`noti-bell${open ? ' on' : ''}${ring ? ' ring' : ''}`} onClick={() => setOpen((o) => !o)} aria-label={`알림 ${count}건`}>
        <Icon name="notifications" filled={count > 0} />
        {count > 0 && <span className="noti-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="noti-panel">
          <div className="noti-head">
            <span>새 문의 알림</span>
            {count > 0 && <span className="noti-head-n">{count}</span>}
          </div>
          {count === 0 ? (
            <div className="noti-empty">답변 대기 중인 문의가 없습니다.</div>
          ) : (
            <ul className="noti-list">
              {items.slice(0, 8).map((c) => (
                <li key={c.tenantId}>
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
          <button type="button" className="noti-all" onClick={goAll}>문의 관리 전체 보기</button>
        </div>
      )}
    </div>
  )
}
