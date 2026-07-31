import { useCallback, useEffect, useState } from 'react'
import { tenantApi } from '../api/client'
import IsoRoom from './IsoRoom'

/** 플랫폼 관리자 — 업체별 가게 꾸미기(store decorate / 미니룸) 조회(읽기 전용). 편집은 사장님 콘솔에서. */
export default function TenantDecorateModal({ tenant, onClose, onError }) {
  const tid = tenant.tenantId
  const [home, setHome] = useState(null)

  const load = useCallback(async () => {
    setHome(null)
    try { setHome(await tenantApi.home(tid)) }
    catch (e) { onError(e.message); setHome({ error: true }) }
  }, [tid, onError])
  useEffect(() => { load() }, [load])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal staff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="branch-head">
          <h3>가게 꾸미기</h3>
          <span className="branch-sub">{tenant.tenantName} ({tenant.tenantCode})</span>
          <button className="btn-ghost btn-sm menu-copy-btn" onClick={load}>새로고침</button>
        </div>

        {home === null ? (
          <p className="muted" style={{ padding: 30, textAlign: 'center' }}>불러오는 중…</p>
        ) : home.error ? (
          <p className="muted" style={{ padding: 30, textAlign: 'center' }}>불러오지 못했습니다.</p>
        ) : (
          <>
            <div className="decorate-room">
              <IsoRoom data={home.miniroom} />
            </div>
            <div className="decorate-info">
              {home.tagline && <p className="decorate-tagline">{home.tagline}</p>}
              <ul className="decorate-meta">
                <li><span>표시 상태</span>{home.published ? '표시 중' : '미표시(초안)'}</li>
                {home.hours && <li><span>영업시간</span>{home.hours}</li>}
                {home.phone && <li><span>전화</span>{home.phone}</li>}
                {home.address && <li><span>주소</span>{home.address}</li>}
              </ul>
            </div>
            <p className="hint left">읽기 전용 · 편집은 사장님 콘솔(store decorate)에서 합니다.</p>
          </>
        )}

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
