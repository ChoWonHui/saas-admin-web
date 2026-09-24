import { createContext, useContext } from 'react'
import { SAMPLE, shade, onColor } from '../../design-concepts'

/**
 * 미리보기에 들어갈 문구(로고·제목·설명·버튼).
 *
 * 컨텍스트로 내려보내는 이유 — 구조가 30갈래라 props 로 넘기면 30군데를 전부 고쳐야 한다.
 * 문구를 하나 추가할 때마다 30군데를 손대게 되므로 컨텍스트가 낫다.
 */
const ContentCtx = createContext(SAMPLE)
const useContent = () => useContext(ContentCtx)

/**
 * 시안 미리보기. 이미지가 아니라 실제 DOM 으로 축소된 웹사이트를 그린다.
 *
 * 30개 구조가 전부 이 컴포넌트 하나에서 나온다. 색은 바깥(화면의 색 선택기)에서 받아
 * CSS 변수로 내려보내므로, 색을 바꾸면 30장이 한꺼번에 따라 바뀐다.
 *
 * 안쪽 치수는 전부 cqw(컨테이너 폭의 %)다 — 카드에서든 상세 모달에서든 같은 비율로 커진다.
 */
export default function DesignPreview({ layout, accent, dark = false, detailed = false, nav, content }) {
  // 비어 있는 칸은 기본 문구로 채운다 — 입력하다 지웠을 때 미리보기가 빈 화면이 되지 않게.
  const c = {
    brand: content?.brand?.trim() || SAMPLE.brand,
    title: [content?.title1?.trim() || SAMPLE.title[0], content?.title2?.trim() || SAMPLE.title[1]],
    lead: content?.lead?.trim() || SAMPLE.lead,
    cta: content?.cta?.trim() || SAMPLE.cta,
  }
  // 고른 '메인 노출' 메뉴가 있으면 그대로 그린다 — 시안에서 실제 메뉴 구성을 확인할 수 있다.
  // 축소된 미리보기 폭에는 5개까지만 들어간다. 그냥 잘라내면 고른 메뉴가 조용히 사라져
  // 반영이 안 된 것처럼 보이므로, 넘치는 개수를 +N 으로 남긴다.
  const source = nav && nav.length ? nav : SAMPLE.nav
  const navItems = source.length > 5 ? [...source.slice(0, 5), `+${source.length - 5}`] : source
  const vars = {
    '--dp-accent': accent,
    '--dp-deep': shade(accent, -0.42),
    '--dp-soft': shade(accent, 0.86),
    '--dp-on-accent': onColor(accent),
    '--dp-ink': dark ? '#F2F4F8' : '#15181D',
    '--dp-mute': dark ? 'rgba(242,244,248,.62)' : '#6B7280',
    '--dp-line': dark ? 'rgba(255,255,255,.16)' : '#E4E7EC',
    '--dp-surface': dark ? 'rgba(255,255,255,.07)' : '#FFFFFF',
    '--dp-canvas': dark ? '#12151B' : '#F6F7F9',
  }

  return (
    <ContentCtx.Provider value={c}>
      <div
        className={`dp dp-l-${layout.id}${dark ? ' is-dark' : ''}${detailed ? ' is-detailed' : ''}`}
        style={vars}
        aria-hidden="true"
      >
        {render(layout.id, navItems)}
      </div>
    </ContentCtx.Provider>
  )
}

/* ===== 조각들 ===== */

const Head = ({ nav, vertical = false }) => {
  const c = useContent()
  // 세로 내비는 폭이 좁아 회사명이 다 안 들어간다 — 머리글자만 쓴다.
  const initials = c.brand.split(/[\s·-]+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase()
  return vertical ? (
    <div className="dp-sidenav">
      <span className="dp-logo">{initials}</span>
      {nav.map((n) => (
        <i key={n} data-more={n.startsWith('+') || undefined}>{n}</i>
      ))}
    </div>
  ) : (
    <div className="dp-head">
      <span className="dp-logo">{c.brand}</span>
      <span className="dp-nav">
        {nav.map((n) => (
          <i key={n} data-more={n.startsWith('+') || undefined}>{n}</i>
        ))}
      </span>
    </div>
  )
}

const Title = ({ sm = false }) => {
  const c = useContent()
  return (
    <div className={`dp-title${sm ? ' is-sm' : ''}`}>
      <b>{c.title[0]}</b>
      <b className="dp-accent-text">{c.title[1]}</b>
    </div>
  )
}

const Lead = ({ sm = false }) => <p className={`dp-lead${sm ? ' is-sm' : ''}`}>{useContent().lead}</p>
const Cta = () => <span className="dp-cta">{useContent().cta}</span>
const Hint = () => <span className="dp-hint" />

// 아래 둘은 render() 안에서 직접 useContent() 를 부르지 않으려고 만든 것이다.
// render() 는 컴포넌트가 아니라 Provider 바깥에서 실행되므로, 거기서 훅을 부르면
// Provider 값이 아니라 기본값(SAMPLE)을 읽어 입력한 문구가 무시된다.
const Huge = () => <b className="dp-huge">{useContent().title[1]}</b>
const LeadText = () => <span>{useContent().lead}</span>
const BentoTitle = () => <b>{useContent().title[0]}</b>

/**
 * 사진·영상이 들어갈 자리.
 * 그냥 색 블록으로 두면 "이 색 덩어리가 뭐냐"는 오해를 산다 — 무엇이 들어가는지 적어 둔다.
 */
const Visual = ({ className = '', label = '이미지' }) => (
  <div className={`dp-vis ${className}`}>
    <span className="dp-vis-tag">
      <i className="material-symbols-outlined">image</i>
      {label}
    </span>
  </div>
)

const Cards = ({ n = 3 }) => (
  <div className="dp-cards" style={{ '--n': n }}>
    {SAMPLE.cards.slice(0, n).map((c) => (
      <div className="dp-card" key={c}>
        <i className="dp-dot" />
        <span>{c}</span>
      </div>
    ))}
  </div>
)

const Stats = () => (
  <div className="dp-stats">
    {SAMPLE.stats.map(([v, l]) => (
      <div key={l}>
        <b>{v}</b>
        <span>{l}</span>
      </div>
    ))}
  </div>
)

const Rows = ({ n = 4, numbered = false }) => (
  <div className="dp-rows">
    {SAMPLE.rows.slice(0, n).map((r, i) => (
      <div className="dp-row" key={r}>
        {numbered && <i className="dp-rownum">{String(i + 1).padStart(2, '0')}</i>}
        <span>{r}</span>
        <i className="dp-chev" />
      </div>
    ))}
  </div>
)

/* ===== 30가지 구조 ===== */

function render(id, nav) {
  switch (id) {
    /* --- 히어로 중심 --- */
    case 'center':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-mid">
            <Title />
            <Lead />
            <Cta />
            <Hint />
          </div>
        </>
      )

    case 'left':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-two">
            <div className="dp-col">
              <Title />
              <Lead />
              <Cta />
            </div>
            <Visual className="dp-vis-40" />
          </div>
        </>
      )

    case 'right':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-two">
            <Visual className="dp-vis-40" />
            <div className="dp-col">
              <Title />
              <Lead />
              <Cta />
            </div>
          </div>
        </>
      )

    case 'overlay':
      return (
        <div className="dp-full">
          <div className="dp-full-bg"><span className="dp-vis-tag is-onbg"><i className="material-symbols-outlined">image</i>배경 이미지</span></div>
          <div className="dp-full-fg">
            <Head nav={nav} />
            <div className="dp-body dp-mid">
              <Title />
              <Lead />
              <Hint />
            </div>
          </div>
        </div>
      )

    case 'typeonly':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-typeonly">
            <Huge />
            <Lead sm />
            <div className="dp-ruler" />
          </div>
        </>
      )

    case 'boxed':
      return (
        <div className="dp-boxed">
          <div className="dp-boxed-in">
            <Head nav={nav} />
            <div className="dp-body dp-mid">
              <Title sm />
              <Lead sm />
              <Cta />
            </div>
          </div>
        </div>
      )

    case 'bottomcta':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-mid">
            <Title />
            <Lead />
          </div>
          <div className="dp-ctabar">
            <LeadText />
            <Cta />
          </div>
        </>
      )

    /* --- 분할 --- */
    case 'split':
    case 'split64':
      return (
        <>
          <Head nav={nav} />
          <div className={`dp-body dp-split ${id === 'split64' ? 'is-64' : ''}`}>
            <div className="dp-col">
              <Title sm />
              <Lead />
              <Cta />
            </div>
            <Visual />
          </div>
        </>
      )

    case 'splitv':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-splitv">
            <div className="dp-col dp-mid">
              <Title sm />
              <Lead sm />
            </div>
            <Visual className="dp-vis-wide" />
          </div>
        </>
      )

    case 'diagonal':
      return (
        <div className="dp-full">
          <div className="dp-diag"><span className="dp-vis-tag is-onbg"><i className="material-symbols-outlined">image</i>배경 이미지</span></div>
          <div className="dp-full-fg">
            <Head nav={nav} />
            <div className="dp-body dp-two">
              <div className="dp-col">
                <Title sm />
                <Lead sm />
                <Cta />
              </div>
              <span />
            </div>
          </div>
        </div>
      )

    case 'offset':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-offset">
            <Visual className="dp-vis-offset" />
            <div className="dp-offset-box">
              <Title sm />
              <Lead sm />
            </div>
          </div>
        </>
      )

    case 'sidebar':
      return (
        <div className="dp-sidewrap">
          <Head nav={nav} vertical />
          <div className="dp-body dp-mid dp-sidebody">
            <Title sm />
            <Lead sm />
            <Cta />
          </div>
        </div>
      )

    case 'sticky':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-sticky">
            <div className="dp-col dp-sticky-l">
              <Title sm />
              <Lead sm />
            </div>
            <div className="dp-sticky-r">
              <Visual className="dp-vis-sm" />
              <Visual className="dp-vis-sm" />
              <Visual className="dp-vis-sm" />
            </div>
          </div>
        </>
      )

    /* --- 그리드 --- */
    case 'bento':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-bento">
            <div className="dp-bento-main">
              <i className="dp-chip">STORY</i>
              <BentoTitle />
            </div>
            <div className="dp-bento-side">
              {SAMPLE.cards.map((c, i) => (
                <div className={`dp-card${i === 1 ? ' is-fill' : ''}`} key={c}>
                  <span>{c}</span>
                  <i className="dp-chev" />
                </div>
              ))}
            </div>
          </div>
        </>
      )

    case 'quad':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-quad">
            {['기획', '디자인', '개발', '보안'].map((t, i) => (
              <div className={`dp-tile${i === 0 ? ' is-fill' : ''}`} key={t}>
                <i className="dp-dot" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </>
      )

    case 'cards3':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-stack">
            <div className="dp-mid dp-stack-hero">
              <Title sm />
              <Lead sm />
            </div>
            <Cards n={3} />
          </div>
        </>
      )

    case 'mosaic':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-mosaic">
            <div className="m1" />
            <div className="m2" />
            <div className="m3" />
            <div className="m4" />
            <div className="m5" />
          </div>
        </>
      )

    case 'gallery':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-gallery">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={i % 3 === 0 ? 'is-fill' : ''} />
            ))}
          </div>
        </>
      )

    case 'stats':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-stack">
            <div className="dp-mid dp-stack-hero">
              <Title sm />
              <Lead sm />
            </div>
            <Stats />
          </div>
        </>
      )

    case 'stair':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-stair">
            {[0, 1, 2].map((i) => (
              <div className="dp-stair-item" key={i} style={{ '--i': i }}>
                <i className="dp-dot" />
                <span>{SAMPLE.cards[i]}</span>
              </div>
            ))}
          </div>
        </>
      )

    /* --- 목록 · 매거진 --- */
    case 'magazine':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-mag">
            <div className="dp-mag-head">
              <Title sm />
            </div>
            <div className="dp-mag-cols">
              {[0, 1, 2].map((i) => (
                <div className="dp-mag-col" key={i}>
                  {i === 1 && <div className="dp-mag-img"><span className="dp-vis-tag is-onbg"><i className="material-symbols-outlined">image</i>이미지</span></div>}
                  <span className="l" />
                  <span className="l" />
                  <span className="l s" />
                  <span className="l" />
                  <span className="l s" />
                </div>
              ))}
            </div>
          </div>
        </>
      )

    case 'newslist':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-news">
            <Visual className="dp-vis-news" />
            <div className="dp-news-list">
              {SAMPLE.rows.slice(0, 4).map((r) => (
                <div key={r}>
                  <i className="dp-dot sm" />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )

    case 'bigrow':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-bigrows">
            <Rows n={4} numbered />
          </div>
        </>
      )

    case 'timeline':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-timeline">
            {SAMPLE.rows.slice(0, 3).map((r) => (
              <div className="dp-tl-item" key={r}>
                <i />
                <span>{r}</span>
              </div>
            ))}
          </div>
        </>
      )

    case 'accordion':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-acc">
            <div className="dp-acc-item is-open">
              <span>{SAMPLE.rows[0]}</span>
              <p />
              <p className="s" />
            </div>
            {SAMPLE.rows.slice(1, 4).map((r) => (
              <div className="dp-acc-item" key={r}>
                <span>{r}</span>
                <i className="dp-plus" />
              </div>
            ))}
          </div>
        </>
      )

    /* --- 변형 --- */
    case 'circle':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-two">
            <div className="dp-col">
              <Title sm />
              <Lead sm />
              <Cta />
            </div>
            <div className="dp-circle"><span className="dp-vis-tag is-onbg"><i className="material-symbols-outlined">image</i>이미지</span></div>
          </div>
        </>
      )

    case 'ticker':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-mid">
            <Title sm />
            <Lead sm />
          </div>
          <div className="dp-ticker">
            <span>
              {SAMPLE.brand} · 기획 · 디자인 · 개발 · 보안 · {SAMPLE.brand} · 기획 · 디자인 · 개발 · 보안
            </span>
          </div>
        </>
      )

    case 'dashboard':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-dash">
            <div className="dp-dash-kpi">
              {SAMPLE.stats.slice(0, 3).map(([v, l]) => (
                <div key={l}>
                  <b>{v}</b>
                  <span>{l}</span>
                </div>
              ))}
            </div>
            <div className="dp-dash-chart">
              {[38, 62, 45, 78, 55, 88].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
            <div className="dp-dash-side">
              <span className="l" />
              <span className="l s" />
              <span className="l" />
            </div>
          </div>
        </>
      )

    case 'bignum':
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-bignum">
            <b>04</b>
            <div className="dp-col">
              <Title sm />
              <Lead sm />
            </div>
          </div>
        </>
      )

    default:
      return (
        <>
          <Head nav={nav} />
          <div className="dp-body dp-mid">
            <Title />
          </div>
        </>
      )
  }
}
