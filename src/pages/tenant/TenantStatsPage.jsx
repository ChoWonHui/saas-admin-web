import { useCallback, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import StatsView from '../../components/StatsView'
import { tenantStatsApi } from '../../api/tenantClient'

/** 사장님 콘솔 — 매출 통계. 결제된 주문을 기간별로 집계해 보여준다(관리자 화면과 동일 지표). */
export default function TenantStatsPage() {
  const [error, setError] = useState('')
  const fetcher = useCallback((from, to) => tenantStatsApi.stats(from, to), [])
  const cancelPayment = useCallback((orderId) => tenantStatsApi.cancelPayment(orderId), [])

  return (
    <TenantShell>
      <div className="m-topline">
        <div className="m-page-head">
          <span className="m-eyebrow"><Icon name="insights" /> SALES ANALYTICS</span>
          <h1>매출 통계</h1>
          <p>결제 완료된 주문을 기간별로 집계합니다. (취소 주문 제외)</p>
        </div>
      </div>

      <StatsView fetcher={fetcher} onError={setError} onCancelPayment={cancelPayment} />
      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}
