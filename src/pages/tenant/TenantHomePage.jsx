import { Link } from 'react-router-dom'
import TenantShell from '../../components/TenantShell'
import Icon from '../../components/Icon'
import { useTenantAuth } from '../../auth/TenantAuthContext'

const MENUS = [
  { to: '/admin/tables', icon: 'table_restaurant', title: '테이블 관리', desc: '자리를 배치하고 테이블마다 주문 QR을 만들어 붙이세요.' },
  { to: '/admin/menu', icon: 'restaurant_menu', title: '메뉴판', desc: '분류·메뉴·가격·사진·옵션을 등록해 메뉴판을 만드세요.' },
  { to: '/admin/notices', icon: 'campaign', title: '공지사항', desc: '운영에 필요한 관리자 공지를 확인하세요.' },
  { to: '/admin/inquiries', icon: 'forum', title: '문의하기', desc: '운영 중 궁금한 점을 관리자에게 문의하고 답변을 확인하세요.' },
]

// 로그인 직후 도착하는 홈.
export default function TenantHomePage() {
  const { user } = useTenantAuth()
  return (
    <TenantShell>
      <div className="m-page-head">
        <h1>가게 운영 콘솔</h1>
        <p>{user?.email ? `${user.email} 님, ` : ''}오늘도 좋은 하루 되세요.</p>
      </div>

      <div className="m-home-cards">
        {MENUS.map((m) => (
          <Link key={m.to} to={m.to} className="m-card m-home-card">
            <span className="m-hc-icon"><Icon name={m.icon} /></span>
            <h3>{m.title}</h3>
            <p>{m.desc}</p>
          </Link>
        ))}
      </div>
    </TenantShell>
  )
}
