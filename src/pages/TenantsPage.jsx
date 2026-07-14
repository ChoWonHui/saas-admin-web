import { useEffect, useState } from 'react'
import { tenantApi } from '../api/client'
import Shell from '../components/Shell'

const STATUS_LABEL = {
  ACTIVE: '운영중',
  SUSPENDED: '정지',
  PENDING: '대기',
  TERMINATED: '해지',
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tenantApi
      .list()
      .then((page) => {
        // 응답은 Spring Page 다. 목록은 content 안에 있다.
        setTenants(page?.content ?? [])
        setTotal(page?.totalElements ?? 0)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Shell>
      <div className="page-head">
        <h2>업체</h2>
        <span className="count">{loading ? '' : `${total}개`}</span>
      </div>

      {error && <p className="alert">{error}</p>}

      {loading ? (
        <p className="muted">불러오는 중…</p>
      ) : tenants.length === 0 ? (
        <p className="muted">등록된 업체가 없습니다.</p>
      ) : (
        <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="col-grow">업체명</th>
              <th>코드</th>
              <th>slug</th>
              <th>상태</th>
              <th>대표자</th>
              <th>연락처</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.tenantId}>
                <td className="strong">{tenant.tenantName}</td>
                <td className="mono">{tenant.tenantCode}</td>
                <td className="mono">{tenant.tenantSlug}</td>
                <td>
                  <span className={`badge badge-${tenant.status?.toLowerCase()}`}>
                    {STATUS_LABEL[tenant.status] ?? tenant.status}
                  </span>
                </td>
                <td>{tenant.ownerName ?? '-'}</td>
                <td>{tenant.contactPhone ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Shell>
  )
}
