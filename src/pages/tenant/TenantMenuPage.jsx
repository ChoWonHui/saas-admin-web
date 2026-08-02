import { useEffect, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import MenuEditor from '../../components/MenuEditor'
import MobileMenuView from './MobileMenuView'
import { tenantMenuBoardApi, tenantImageApi } from '../../api/tenantClient'

// 화면 폭에 따라 데스크톱 편집기 / 모바일 전용 뷰를 고른다.
function useIsMobile(bp = 820) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(`(max-width:${bp}px)`).matches)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${bp}px)`)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [bp])
  return m
}

// 사장님 콘솔 메뉴판 — 모바일은 카드·칩·바텀시트, 데스크톱은 기존 편집기.
export default function TenantMenuPage() {
  const [error, setError] = useState('')
  const isMobile = useIsMobile()
  return (
    <TenantShell>
      {isMobile ? (
        <MobileMenuView onError={setError} />
      ) : (
        <>
          <div className="m-page-head">
            <span className="m-eyebrow"><Icon name="restaurant_menu" /> MENU MANAGEMENT</span>
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
        </>
      )}
      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}
