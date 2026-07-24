import { useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import MenuEditor from '../../components/MenuEditor'
import { tenantMenuBoardApi, tenantImageApi } from '../../api/tenantClient'

// 사장님 콘솔 메뉴판 — 관리자 메뉴 편집기를 그대로 임베드, 업체(기본 지점) 메뉴만.
export default function TenantMenuPage() {
  const [error, setError] = useState('')
  return (
    <TenantShell>
      <div className="m-page-head">
        <h1>메뉴판</h1>
        <p>분류를 만들고 메뉴·가격·사진·옵션을 등록하세요.</p>
      </div>
      <section className="m-card" style={{ padding: 18 }}>
        <MenuEditor
          embedded
          title=""
          menuApi={tenantMenuBoardApi}
          imageApi={tenantImageApi}
          tenantId={0}
          branch={{ branchId: 0 }}
          branches={[]}
          onError={setError}
        />
      </section>
      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}
