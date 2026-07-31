import { useCallback } from 'react'
import StatsView from './StatsView'
import { tenantApi } from '../api/client'

/** 플랫폼 관리자 — 업체별 매출 통계(업체 콘솔과 동일 지표). */
export default function TenantStatsModal({ tenant, onClose, onError }) {
  const fetcher = useCallback((from, to) => tenantApi.stats(tenant.tenantId, from, to), [tenant.tenantId])
  const cancelPayment = useCallback((orderId) => tenantApi.statsCancel(tenant.tenantId, orderId), [tenant.tenantId])
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal staff-modal wl-rsv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="branch-head">
          <h3>매출 통계</h3>
          <span className="branch-sub">{tenant.tenantName} ({tenant.tenantCode})</span>
        </div>
        <StatsView fetcher={fetcher} onError={onError} onCancelPayment={cancelPayment} />
        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  )
}
