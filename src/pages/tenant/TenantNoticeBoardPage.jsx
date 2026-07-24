import { useCallback, useEffect, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import { tenantNoticeBoardApi } from '../../api/tenantClient'

function fmt(dt) { return dt ? dt.slice(0, 16).replace('T', ' ') : '' }

// 업체(사장님) 콘솔 공지사항 — 관리자가 등록한 공지를 조회만 한다.
export default function TenantNoticeBoardPage() {
  const [items, setItems] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setItems(await tenantNoticeBoardApi.list()) }
    catch (e) { setError(e.message); setItems([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function open(id) {
    try { setDetail(await tenantNoticeBoardApi.get(id)) }
    catch (e) { setError(e.message) }
  }

  return (
    <TenantShell>
      {detail ? (
        <>
          <button className="btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setDetail(null); load() }}>← 목록</button>
          <article className="m-card tn-detail">
            <h1 className="tn-detail-title">{detail.pinned && <Icon name="push_pin" className="tn-pin" />}{detail.title}</h1>
            <p className="tn-detail-meta">{detail.authorName} · {fmt(detail.createdAt)} · 조회 {detail.viewCount}</p>
            <div className="tn-detail-body" dangerouslySetInnerHTML={{ __html: detail.content }} />
          </article>
        </>
      ) : (
        <>
          <div className="m-page-head">
            <h1>공지사항</h1>
            <p>운영에 필요한 공지를 확인하세요.</p>
          </div>
          {items === null ? (
            <Loading label="공지를 불러오는 중…" />
          ) : items.length === 0 ? (
            <div className="m-card m-empty"><Icon name="campaign" /><p>등록된 공지가 없습니다.</p></div>
          ) : (
            <ul className="tn-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button className="m-card tn-row" onClick={() => open(n.id)}>
                    {n.pinned && <Icon name="push_pin" className="tn-pin" />}
                    <span className="tn-row-title">{n.title}</span>
                    <span className="tn-row-at">{fmt(n.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}
