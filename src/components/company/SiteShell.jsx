import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import '../../company.css'
import { BRAND, NAV, NAV_EXPRISM, NAV_FLAT, CONTACT } from '../../company-data'

/**
 * 회사 사이트의 공통 껍데기 — 상단바 + 내비게이션 + 푸터.
 * 원본(kanchenjunga-nodejs/public)의 js/header.js · js/footer.js 를 컴포넌트로 옮긴 것이다.
 *
 * solidHeader: 히어로가 없는 화면(회사소개·사업영역·공지·문의)은 처음부터 흰 헤더여야 한다.
 *   히어로가 있는 메인만 투명하게 시작해 스크롤하면 흰색으로 바뀐다.
 */
export default function SiteShell({ children, solidHeader = false, title }) {
  // index.html 의 제목은 주문앱 기준("테이블 주문")이다. 회사 사이트 화면에서만 바꾼다.
  useEffect(() => {
    document.title = title ? `${title} - ${BRAND.name}` : `${BRAND.name} - ${BRAND.subKo}`
  }, [title])

  return (
    <div className="kc">
      <SiteHeader solid={solidHeader} />
      <main>{children}</main>
      <SiteFooter />
    </div>
  )
}

/**
 * exprism.co.kr 은 제품 홍보 전용이다. 회사 메뉴(회사정보·디자인 시안 등)를 띄우지 않고
 * 제품 안에서만 움직이게 한다. 회사 소개가 필요하면 kanchenjunga.co.kr 로 보낸다.
 */
/** 지금 보고 있는 주소가 제품 사이트(exprism.co.kr)인가. 화면 문구와 항목이 여기서 갈린다. */
export function isProductHost() {
  if (typeof window === 'undefined') return false
  return /(^|\.)exprism\.co\.kr$/i.test(window.location.hostname)
}

/**
 * 상단 로고에 무엇을 앞세울지.
 * 제품 도메인에서는 EXPRISM 이 주인공이고 KANCHENJUNGA 는 만든 회사로 물러난다.
 * 회사 도메인에서는 그 반대다.
 */
/**
 * 로고 파일. <b>이미지 서버(S3 + CloudFront)</b>에 있다.
 *
 * 앱과 함께 배포되는 정적 파일로 두지 않는다. 이미지는 이미지 서버가 맡는다는 게 이 프로젝트의 규칙이고,
 * 그래야 로고를 바꿀 때 앱을 다시 배포하지 않아도 되고 CDN 이 대신 실어 나른다.
 * 올리는 곳은 나머지 업로드 이미지와 같은 버킷·같은 접두 경로(saas-admin/)다.
 *
 *  - icon         : 정사각 아이콘(포크·숟가락이 들어간 입체 EXPRISM)
 *  - wordmark     : 남색 글자 (밝은 바탕용)
 *  - wordmarkLight: 흰 글자 (짙은 바탕용). 그라데이션이 들어간 E 는 원본 그대로 둔다.
 */
const CDN = 'https://d2ziky4ycezd5d.cloudfront.net/saas-admin/brand'
export const BRAND_LOGO = {
  icon: `${CDN}/exprism-icon-v2.png`,
  wordmark: `${CDN}/exprism-wordmark-v2.png`,
  wordmarkLight: `${CDN}/exprism-wordmark-light-v2.png`,
  favicon: `${CDN}/exprism-icon-128-v2.png`,
  og: `${CDN}/exprism-og-v2.jpg`,
}

/**
 * KANCHENJUNGA(회사) 로고 에셋. EXPRISM 로고처럼 <b>이미지 서버(S3+CloudFront)</b>에 둔다.
 * 앱에 정적 파일로 박지 않는다 — 로고를 바꿔도 앱 재배포가 필요 없고 CDN 이 실어 나른다.
 * 일부는 <b>불투명(흰 배경)</b>이라 헤더/푸터의 어두운 바탕 위에서는 흰 라운드 배지로 감싸 얹는다.
 */
// KANCHENJUNGA 로고도 이미지 서버(S3+CloudFront)에 둔다 — 앱에 정적 파일로 박지 않는다.
// EXPRISM 로고(BRAND_LOGO)와 같은 버킷·접두 경로 아래 kanchenjunga/ 폴더에 올렸다.
const KC = `${CDN}/kanchenjunga`
const KC_LOGO = {
  // 밝은 배경용(불투명, 흰 카드 갤러리에서 사용)
  icon: `${KC}/icon.png`,
  wordmark: `${KC}/wordmark.png`,
  combined: `${KC}/combined.png`,
  typography: `${KC}/typography.png`,
  // 투명 배경(헤더/푸터 등 어떤 바탕 위에서도 자연스럽게)
  iconMark: `${KC}/icon-mark.png`,        // 파란 산 아이콘(투명)
  wordmarkLight: `${KC}/wordmark-light.png`, // 흰 워드마크(어두운 바탕용)
  wordmarkDark: `${KC}/wordmark-dark.png`,   // 남색 워드마크(밝은 바탕용)
  wordmarkEnLight: `${KC}/wordmark-en-light.png`, // KANCHENJUNGA 한 줄(흰)
  wordmarkEnDark: `${KC}/wordmark-en-dark.png`,   // KANCHENJUNGA 한 줄(남색)
  combinedLight: `${KC}/combined-light.png`, // 아이콘 + 흰 워드마크(어두운 바탕용)
  combinedDark: `${KC}/combined-dark.png`,   // 아이콘 + 남색 워드마크(밝은 바탕용)
}

/**
 * 상단바 로고.
 *
 * exprism.co.kr 은 제품 사이트라 로고 그림을 쓴다. 상단바는 맨 위에서는 투명(짙은 배경),
 * 내려가면 흰 배경으로 바뀌므로 워드마크를 두 벌 얹어 두고 CSS 로 갈아 끼운다.
 * 색만 다른 같은 글자라 하나만 읽히면 되니, 보이지 않는 쪽은 alt 를 비운다.
 */
function BrandMark() {
  if (!isProductHost()) {
    // 회사(KANCHENJUNGA) 로고 — 투명 산 아이콘 + 워드마크 텍스트(span).
    // 글자 색은 브랜드 남색에 맞춘다(히어로 위에서는 흰색, 스크롤 후 흰 헤더에서는 남색).
    return (
      <span className="kc-logo-lockup">
        <img className="kc-logo-icon-kc" src={KC_LOGO.iconMark} alt="" width="1346" height="967" />
        <span className="kc-logo-text">
          <span className="kc-logo-mark">{brandMark().mark}</span>
          <span className="kc-logo-sub">{brandMark().sub}</span>
        </span>
      </span>
    )
  }
  return (
    <span className="kc-logo-lockup">
      <img className="kc-logo-icon" src={BRAND_LOGO.icon} alt="" width="384" height="406" />
      <span className="kc-logo-text">
        <span className="kc-logo-words">
          <img className="kc-logo-word kc-logo-word-light" src={BRAND_LOGO.wordmarkLight} alt="EXPRISM" width="556" height="96" />
          <img className="kc-logo-word kc-logo-word-dark" src={BRAND_LOGO.wordmark} alt="" width="556" height="96" />
        </span>
        <span className="kc-logo-sub">BY {BRAND.name}</span>
      </span>
    </span>
  )
}

function brandMark() {
  return isProductHost()
    ? { mark: 'EXPRISM', sub: `BY ${BRAND.name}` }
    : { mark: BRAND.name, sub: BRAND.sub }
}

/**
 * 지금 화면에 보이는 구역의 id 를 돌려준다.
 *
 * 내비에 같은 화면 안의 앵커(/#guest)가 있을 때 쓴다. 라우터는 해시를 경로로 보지 않아
 * NavLink 로는 이 구분을 못 한다(그렇게 뒀더니 /, /#guest, /#owner 가 전부 활성으로 켜졌다).
 *
 * scroll 이벤트를 듣지 않는다. 화면 한가운데에 좁은 띠를 만들어 두고,
 * 어떤 구역이 그 띠를 지나는지만 IntersectionObserver 로 받는다.
 */
function useVisibleSection(items) {
  const [id, setId] = useState('')
  // 상위 메뉴(회사정보·사업영역)는 to 가 없고 children 만 있다. 그대로 to 를 읽으면 터진다.
  const key = items.map((n) => n.to ?? '').join(',')

  useEffect(() => {
    const ids = items.filter((n) => n.to?.includes('#')).map((n) => n.to.split('#')[1])
    const els = ids.map((x) => document.getElementById(x)).filter(Boolean)
    if (!els.length) return undefined

    const seen = new Set()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)))
        // 여러 구역이 걸치면 문서 순서상 앞선 것을 고른다.
        const first = ids.find((x) => seen.has(x))
        setId(first || '')
      },
      // 위 40%, 아래 55% 를 잘라내 화면 가운데만 판정에 쓴다.
      // 그래야 구역이 화면에 "들어오는 순간" 이 아니라 "읽고 있는 순간" 에 바뀐다.
      { rootMargin: '-40% 0px -55% 0px' },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [key, items])

  return id
}

/**
 * 내비 항목 하나.
 * 앵커(/#guest)는 라우트가 아니라 같은 화면 안의 이동이므로 평범한 a 로 내보내고,
 * 활성 여부는 지금 보고 있는 구역으로 판단한다.
 */
function NavItem({ to, label, visibleSection }) {
  if (to?.includes('#')) {
    const anchor = to.split('#')[1]
    return (
      <a href={to} className={visibleSection === anchor ? 'on' : ''}>
        {label}
      </a>
    )
  }
  // 앵커가 있는 메뉴에서 "맨 위" 항목은 어떤 구역도 보이지 않을 때만 켠다.
  const hasAnchors = to === '/' && visibleSection !== undefined
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => (isActive && (!hasAnchors || !visibleSection) ? 'on' : '')}
    >
      {label}
    </NavLink>
  )
}

function SiteHeader({ solid }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const sentinelRef = useRef(null)

  // 스크롤이 내려가면 헤더에 흰 배경을 깔아 본문과 겹쳐 읽히지 않게 한다.
  //
  // scroll 이벤트를 듣지 않고 문서 맨 위에 둔 감지용 요소(sentinel)가 화면에서
  // 벗어나는지로 판단한다. scroll 리스너는 스크롤 프레임마다 실행돼 setState 를
  // 때리지만, IntersectionObserver 는 경계를 넘을 때 한 번만 알려준다.
  useEffect(() => {
    if (solid) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [solid])

  // 화면을 이동하면 드로어를 닫는다.
  useEffect(() => setOpen(false), [location.pathname])

  // 열려 있는 동안 Esc 로 닫고, 뒤 본문 스크롤을 잠근다.
  // (프로젝트 공통 규칙 — index.css 의 body.no-scroll 을 그대로 쓴다)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [open])

  const navItems = isProductHost() ? NAV_EXPRISM : NAV
  const visibleSection = useVisibleSection(navItems)

  const isSolid = solid || scrolled

  return (
    <>
      {/* 문서 맨 위 9px. 레이아웃에 영향을 주지 않도록 흐름에서 빼 둔다.
          이 요소가 화면 밖으로 나가면 헤더가 흰 배경으로 바뀐다. */}
      <div ref={sentinelRef} className="kc-top-sentinel" aria-hidden="true" />
      <header className={`kc-head${isSolid ? ' is-solid' : ''}`}>
        <div className="kc-head-inner">
          <Link className="kc-logo" to="/" aria-label="홈으로">
            <BrandMark />
          </Link>

          <nav className="kc-nav">
            {navItems.map((n) =>
              n.children ? (
                // 상위 메뉴. 마우스를 올리거나(hover) 자식에 포커스가 가면(focus-within) 펼쳐진다.
                // 상위 자체는 이동 경로가 없어 button 이 아니라 그냥 표시용이다.
                <div className="kc-nav-group" key={n.label}>
                  <span className={`kc-nav-parent${isGroupActive(n, location.pathname) ? ' on' : ''}`}>
                    {n.label}
                    <span className="material-symbols-outlined">expand_more</span>
                  </span>
                  <div className="kc-nav-drop">
                    {/* end 를 준 이유 — NavLink 는 기본이 접두사 매칭이라 /company 가
                        /company/greeting·/company/org 에서도 활성으로 잡힌다.
                        그러면 하위 화면에 있어도 "회사소개"가 계속 눌린 것처럼 보인다. */}
                    {n.children.map((c) => (
                      <NavChild key={c.to} to={c.to} label={c.label} />
                    ))}
                  </div>
                </div>
              ) : (
                <NavItem key={n.to} to={n.to} label={n.label} visibleSection={visibleSection} />
              ),
            )}
          </nav>

          <button
            type="button"
            className="kc-burger"
            aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </header>

      {/* 항상 마운트해 두고 클래스로만 열고 닫는다 — 그래야 슬라이드가 걸린다. */}
      <div className={`kc-drawer-back${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <nav className={`kc-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="kc-drawer-head">
          {isProductHost()
            ? <img className="kc-logo-word kc-logo-word-solo" src={BRAND_LOGO.wordmark} alt="EXPRISM" width="556" height="96" />
            : (
              <span className="kc-logo-lockup">
                <img className="kc-logo-icon-kc" src={KC_LOGO.iconMark} alt="" width="1346" height="967" />
                <span className="kc-logo-mark">{brandMark().mark}</span>
              </span>
            )}
          <button type="button" className="kc-drawer-x" aria-label="메뉴 닫기" onClick={() => setOpen(false)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {navItems.map((n) =>
          n.children ? <DrawerGroup key={n.label} item={n} /> : (
            <NavItem key={n.to} to={n.to} label={n.label} visibleSection={visibleSection} />
          ),
        )}
        <Link className="kc-btn kc-btn-primary" to="/contact">
          문의하기
        </Link>
      </nav>
    </>
  )
}

/** 지금 보고 있는 화면이 이 묶음에 속하는가. 상위 메뉴를 활성 표시하는 데 쓴다. */
/**
 * 드롭다운 안의 링크 하나.
 * exprism.co.kr 의 "회사정보" 는 실제 화면이 kanchenjunga.co.kr 에 있어
 * 절대 주소가 들어온다. NavLink 는 라우터 경로만 다루므로 그때는 평범한 a 로 내보낸다.
 */
function NavChild({ to, label }) {
  if (/^https?:\/\//i.test(to)) {
    return <a href={to}>{label}</a>
  }
  return (
    <NavLink to={to} end className={({ isActive }) => (isActive ? 'on' : '')}>
      {label}
    </NavLink>
  )
}

function isGroupActive(group, pathname) {
  return group.children.some(
    (c) => !/^https?:\/\//i.test(c.to) && (pathname === c.to || pathname.startsWith(`${c.to}/`)),
  )
}

/** 드로어의 상위 메뉴. 눌러서 자식을 접었다 편다.
 *  지금 화면이 속한 묶음은 처음부터 펼쳐 둔다 — 어디 있는지 바로 보이게 하려는 것이다. */
function DrawerGroup({ item }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(() => isGroupActive(item, pathname))

  useEffect(() => {
    if (isGroupActive(item, pathname)) setOpen(true)
  }, [item, pathname])

  return (
    <div className="kc-drawer-group">
      <button
        type="button"
        className={`kc-drawer-parent${open ? ' open' : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {item.label}
        <span className="material-symbols-outlined">expand_more</span>
      </button>
      {/* 안쪽 래퍼가 하나여야 grid-template-rows 0fr↔1fr 펼침이 동작한다.
          자식들을 이 div 없이 직접 두면 각각이 별도 행이 되어 접히지 않는다. */}
      <div className={`kc-drawer-children${open ? ' open' : ''}`}>
        <div>
          {/* 데스크톱 드롭다운과 같은 이유로 end 를 준다(접두사 매칭 방지). */}
          {item.children.map((c) => (
            <NavChild key={c.to} to={c.to} label={c.label} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="kc-foot">
      <div className="kc-wrap">
        <div className="kc-foot-grid">
          <div>
            {/* 제품 도메인에서는 만든 회사(KANCHENJUNGA) 이름 위에 제품 로고를 세운다.
                여기 적힌 주소·사업자번호는 회사 것이므로 회사 이름은 그대로 둔다. */}
            {isProductHost() ? (
              <>
                <img
                  className="kc-foot-logo"
                  src={BRAND_LOGO.wordmarkLight}
                  alt="EXPRISM"
                  width="556"
                  height="96"
                  loading="lazy"
                />
                <h4>{BRAND.name}</h4>
              </>
            ) : (
              <img
                className="kc-foot-logo kc-foot-logo-kc"
                src={KC_LOGO.combinedLight}
                alt="KANCHENJUNGA 칸첸중가"
                width="1385"
                height="886"
                loading="lazy"
              />
            )}
            <p>
              {CONTACT.address}
              <br />
              대표 {CONTACT.ceo}
              <br />
              사업자등록번호 {CONTACT.bizNo}
              <br />
              {CONTACT.email}
            </p>
          </div>
          <div>
            <h5>바로가기</h5>
            {/* 푸터는 계층 없이 평평하게 — 상위 메뉴는 이동할 곳이 없어 링크가 되지 못한다. */}
            <ul className="kc-foot-links">
              {NAV_FLAT.map((n) => (
                <li key={n.to}>
                  <Link to={n.to}>{n.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>고객지원</h5>
            <ul className="kc-foot-links">
              <li>
                <a href={`mailto:${CONTACT.email}`}>이메일 문의</a>
              </li>
              {/* 관리자 콘솔. 호스팅에 /admin 경로가 이미 있어 /mng 를 쓴다. */}
              <li>
                <a href="/mng/login.html">관리자</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="kc-foot-bar">© {new Date().getFullYear()} {BRAND.name}. ALL RIGHTS RESERVED.</div>
      </div>
    </footer>
  )
}

/** 서브 페이지 상단 배너 + 빵부스러기. 네 화면이 같은 모양을 쓴다. */
export function SubHead({ title }) {
  return (
    <section className="kc-sub">
      <div className="kc-wrap">
        <ol className="kc-crumb">
          <li>
            <Link to="/">
              <span className="material-symbols-outlined">home</span>Home
            </Link>
          </li>
          <li>{title}</li>
        </ol>
        <h1>{title}</h1>
      </div>
    </section>
  )
}

/** 섹션 제목 묶음. 왼쪽 정렬이 기본이고, center 를 줄 때만 가운데로 간다. */
export function SecHead({ title, desc, center = false }) {
  return (
    <div className={`kc-sec-head${center ? ' center' : ''}`}>
      <h2 className="kc-sec-title">{title}</h2>
      {desc && <p className="kc-sec-desc">{desc}</p>}
    </div>
  )
}
