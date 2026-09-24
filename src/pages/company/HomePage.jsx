import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteShell, { SecHead } from '../../components/company/SiteShell'
import { BRAND, HOME_SERVICES, HOME_PRODUCT, HOME_CTA } from '../../company-data'
import { homeNoticeApi } from '../../api/homeClient'

/**
 * KANCHENJUNGA 메인 — 손님 서버 root(/).
 * 원본 kanchenjunga-nodejs/public/index.html 을 옮긴 것이다.
 * 테이블 QR 이 아닌 접속(운영중이 아닌 가게·잘못된 경로 포함)은 모두 여기로 온다.
 *
 * 이 화면은 백엔드를 부르지 않는다 — 문구는 전부 company-data.js 의 상수다.
 */
export default function HomePage() {
  return (
    <SiteShell>
      <Hero />
      <Services />
      <Product />
      <Statement />
      <NoticeAndInquiry />
    </SiteShell>
  )
}

// 제목은 두 줄이다: "미래를 코딩하다," / "KANCHENJUNGA".
// 줄바꿈은 화면 폭에 맡기지 않고 <br> 로 고정한다 — 폭에 따라 붙었다 떨어졌다 하면 안 된다.
const TYPE_LINE1 = BRAND.heroTitle // "미래를 코딩하다,"
const TYPE_LINE2 = BRAND.name      // "KANCHENJUNGA"
const TYPE_FULL = TYPE_LINE1 + TYPE_LINE2
const TYPE_SPEED = 45 // 글자당 ms. 70 이면 제목이 다 찍히기까지 1.7초가 걸렸다.

/** 애니메이션을 꺼 달라고 설정한 사용자인지. 켜져 있으면 연출을 건너뛴다. */
function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    const on = (e) => setReduce(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduce
}

/** text 를 한 글자씩 드러낸다. 반환값은 지금까지 보여줄 글자 수. */
function useTypewriter(text, speed, enabled) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setCount(text.length) // 연출을 끄면 처음부터 전부 보인다
      return
    }
    setCount(0)
    let i = 0
    const id = setInterval(() => {
      i += 1
      setCount(i)
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, speed, enabled])

  return count
}

function Hero() {
  const reduce = usePrefersReducedMotion()
  const n = useTypewriter(TYPE_FULL, TYPE_SPEED, !reduce)
  const done = n >= TYPE_FULL.length

  // 회사명 부분만 그라데이션이라 앞뒤를 나눠 그린다.
  const typedLine1 = TYPE_LINE1.slice(0, Math.min(n, TYPE_LINE1.length))
  const typedLine2 = n > TYPE_LINE1.length ? TYPE_LINE2.slice(0, n - TYPE_LINE1.length) : ''
  const onLine2 = n > TYPE_LINE1.length

  return (
    <section className="kc-hero">
      <div className="kc-hero-inner">
        {/*
          타이핑 중에는 글자 수가 늘면서 줄바꿈이 생겼다 없어졌다 한다.
          그대로 두면 아래 문구·버튼이 위아래로 튄다 — 완성된 문구로 자리를 먼저 잡아 두고
          실제 h1 을 그 위에 겹쳐 그린다. aria-label 로 전체 문구를 주어
          스크린리더가 한 글자씩 읽는 일도 막는다.
        */}
        <div className="kc-type">
          <p className="kc-type-sizer" aria-hidden="true">
            {TYPE_LINE1}
            <br />
            {TYPE_LINE2}
          </p>
          <h1 aria-label={`${TYPE_LINE1} ${TYPE_LINE2}`}>
            <span aria-hidden="true">{typedLine1}</span>
            {/* 첫 줄을 다 친 뒤에야 줄을 바꾼다 — 미리 넣으면 빈 둘째 줄이 먼저 보인다. */}
            {onLine2 && <br aria-hidden="true" />}
            <span className="kc-hero-mark" aria-hidden="true">{typedLine2}</span>
            {!done && <span className="kc-caret" aria-hidden="true" />}
          </h1>
        </div>

        {/* 타이핑이 끝나고 1초 뒤 문구, 다시 1초 뒤 버튼. 지연은 CSS 에 있다. */}
        <p className={`kc-hero-lead kc-reveal${done ? ' in' : ''}`}>
          {BRAND.taglineLines.map((line, i) => (
            <span key={line}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
        <div className={`kc-hero-actions kc-reveal kc-reveal-late${done ? ' in' : ''}`}>
          <a className="kc-btn kc-btn-primary" href="#services">
            사업분야 보기
            <span className="material-symbols-outlined">arrow_forward</span>
          </a>
          <Link className="kc-btn kc-btn-ghost" to="/contact">
            문의하기
          </Link>
        </div>
      </div>

      {/* 오른쪽 사진. 글 위에 겹치지 않으므로 어둡게 덮지 않아도 글이 읽힌다. */}
      <div className="kc-hero-media">
        <img src={BRAND.heroImg} alt="" width="1200" height="1400" fetchPriority="high" decoding="async" />
      </div>
    </section>
  )
}

function Services() {
  return (
    <section className="kc-sec" id="services">
      <div className="kc-wrap">
        <SecHead
          title="사업분야 소개"
          desc="새로 만드는 일과 이미 있는 것을 돌보는 일을 함께 합니다."
        />
        {/*
          카드 껍데기(테두리·그림자·들어올림)를 벗겼다. 항목이 둘뿐이라 테두리가
          위계를 알려주지 못하고, 같은 크기 흰 카드 두 장은 이 사이트에서만
          세 번 반복되던 구성이다. 지금은 사진과 여백이 경계를 대신하고,
          첫 칸을 넓게 잡아 주력 사업이 먼저 읽히게 한다.
        */}
        <div className="kc-svc kc-svc-3">
          {HOME_SERVICES.map((s, i) => {
            // to 가 있으면 블록 전체가 링크가 된다. 없으면 소개 글로 남는다
            // (a 태그로 감싸면 갈 곳 없는 링크가 되어 키보드·스크린리더에 걸린다).
            const Block = s.to ? Link : 'article'
            const props = s.to
              ? { to: s.to, className: 'kc-svc-item is-link' }
              : { className: 'kc-svc-item' }
            return (
              <Block {...props} key={s.id}>
                <div className="kc-svc-img">
                  <img
                    src={s.img}
                    srcSet={`${s.img} 1x, ${s.img2x} 2x`}
                    alt={s.alt}
                    width="800"
                    height="500"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="kc-svc-body">
                  <div className="kc-svc-meta">
                    <span className="kc-svc-no">{String(i + 1).padStart(2, '0')}</span>
                    {/* 자사 제품처럼 표시할 게 있는 항목에만 붙는다. */}
                    {s.tag && <span className="kc-svc-tag">{s.tag}</span>}
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                  {s.to && (
                    <span className="kc-svc-more">
                      자세히 보기
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </span>
                  )}
                </div>
              </Block>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/*
 * 자사 솔루션. 수주 업무(위 사업분야)와 성격이 달라 구성도 다르게 간다.
 * 사진을 왼쪽에 세우고 글을 오른쪽에 붙여, 앞 섹션의 3단 격자와 리듬이 겹치지 않게 한다.
 */
function Product() {
  return (
    <section className="kc-prod">
      <div className="kc-wrap kc-prod-inner">
        <div className="kc-prod-shot">
          <img src={HOME_PRODUCT.img} alt={HOME_PRODUCT.alt} width="640" height="1385" loading="lazy" decoding="async" />
        </div>
        <div>
          <p className="kc-prod-mark">{HOME_PRODUCT.name}</p>
          <h2>{HOME_PRODUCT.title}</h2>
          <p className="kc-prod-desc">{HOME_PRODUCT.desc}</p>
          {/* 제품 사이트는 다른 도메인(exprism.co.kr)이라 라우터 Link 가 아니라 외부 링크로 나간다. */}
          <a className="kc-btn kc-btn-primary" href={HOME_PRODUCT.to}>
            제품 자세히 보기
            <span className="material-symbols-outlined">arrow_forward</span>
          </a>
        </div>
      </div>
    </section>
  )
}

function Statement() {
  return (
    <section className="kc-cta">
      <div className="kc-cta-inner">
        <h2>{HOME_CTA.title}</h2>
        <p>{HOME_CTA.desc}</p>
        <Link className="kc-btn kc-btn-ghost" to="/company">
          회사 소개
          <span className="material-symbols-outlined">arrow_forward</span>
        </Link>
      </div>
    </section>
  )
}

function formatDate(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function NoticeAndInquiry() {
  // 메인에는 최신 3건만 건다. 전체는 /notice 에서 본다. (콘솔에서 등록한 공지를 API 로 받아 온다)
  const [latest, setLatest] = useState([])
  useEffect(() => {
    homeNoticeApi
      .list({ page: 0, size: 3 })
      .then((d) => setLatest(d?.content ?? []))
      .catch(() => setLatest([]))
  }, [])

  return (
    <section className="kc-sec kc-sec-alt">
      <div className="kc-wrap kc-close">
        {/* 공지는 목록이다. 카드에 담지 않고 가로선으로만 나눈다. */}
        <div className="kc-close-main">
          <div className="kc-close-head">
            <h2>새로운 소식</h2>
            <Link className="kc-close-all" to="/notice">
              전체 보기
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
          {latest.length === 0 ? (
            <p className="kc-sec-desc">등록된 소식이 없습니다.</p>
          ) : (
            <ul className="kc-feed">
              {latest.map((n) => (
                <li key={n.noticeId}>
                  <Link to={`/notice/${n.noticeId}`}>
                    <span className="kc-feed-title">{n.title}</span>
                    <span className="kc-feed-date">{formatDate(n.publishedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 문의는 목록이 아니라 하나의 행동이다. 그래서 형태를 다르게 준다. */}
        <aside className="kc-ask">
          <h2>궁금한 점이 있으신가요</h2>
          <p>
            {BRAND.name}에 대해 궁금하신 사항을 질문해 주세요. 각 분야의 담당자가 성심성의껏 답변해 드립니다.
          </p>
          <Link className="kc-btn kc-btn-primary" to="/contact">
            문의하기
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </aside>
      </div>
    </section>
  )
}
