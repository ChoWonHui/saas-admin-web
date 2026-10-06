import { Link } from 'react-router-dom'
import SiteShell, { SubHead, SecHead } from '../../components/company/SiteShell'
import { PRICING, MAINTENANCE } from '../../company-data'

/**
 * 요금제(/pricing). 헤더 '요금제' 메뉴에서 온다.
 * 두 가지를 함께 보여준다 — 홈페이지 제작 상품(PRICING)과 월 유지보수 상품(MAINTENANCE).
 * 각 상품은 세 플랜을 카드로 나란히 두고 BUSINESS 를 추천(BEST)으로 띄운다.
 * 가격·기능은 company-data 한 곳에서 관리한다.
 */
export default function PricingPage() {
  return (
    <SiteShell solidHeader title="요금제">
      <SubHead title="요금제 안내" />

      <section className="kc-sec">
        <div className="kc-wrap">
          <SecHead title="홈페이지 제작 상품" desc={PRICING.lead} center />
          <PlanGrid data={PRICING} />
        </div>
      </section>

      <section className="kc-sec kc-sec-alt">
        <div className="kc-wrap">
          <SecHead title="월 유지보수 요금제" desc={MAINTENANCE.lead} center />
          <PlanGrid data={MAINTENANCE} />
          {MAINTENANCE.scope && (
            <div className="kc-scope">
              <span className="kc-scope-title">유지관리 범위 예시</span>
              <ul className="kc-scope-list">
                {MAINTENANCE.scope.map((s) => (
                  <li key={s.label}>
                    <span className="material-symbols-outlined">{s.icon}</span>
                    {s.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="kc-cta">
        <div className="kc-cta-inner">
          <h2>어떤 상품이 맞을지 고민되시나요?</h2>
          <p>원하시는 기능과 예산만 알려주시면 가장 알맞은 구성으로 안내해 드립니다.</p>
          <Link className="kc-btn kc-btn-primary" to="/contact">
            문의하기
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>
    </SiteShell>
  )
}

/** 세 플랜 카드 + 유의사항. 제작·유지보수 두 섹션이 공통으로 쓴다. */
function PlanGrid({ data }) {
  return (
    <>
      <div className="kc-pricing">
        {data.plans.map((p) => (
          <article key={p.key} className={`kc-plan${p.best ? ' is-best' : ''}`}>
            {p.best && <span className="kc-plan-badge">BEST</span>}
            <h3 className="kc-plan-name">{p.name}</h3>
            <div className="kc-plan-price">
              {p.priceText ? (
                <strong className="kc-plan-price-text">{p.priceText}</strong>
              ) : (
                <>
                  {p.pricePrefix && <span className="kc-plan-price-pre">{p.pricePrefix}</span>}
                  <strong>{p.price}</strong>
                  <span className="kc-plan-price-unit">{p.unit}</span>
                </>
              )}
            </div>
            <p className="kc-plan-tag">{p.tagline}</p>
            <ul className="kc-plan-feats">
              {p.features.map((f) => (
                <li key={f}>
                  <span className="material-symbols-outlined">check</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              className={`kc-btn ${p.best ? 'kc-btn-primary' : 'kc-btn-line'} kc-plan-cta`}
              to="/contact"
            >
              {p.priceText || p.key === 'custom' ? '견적 문의' : '문의하기'}
            </Link>
          </article>
        ))}
      </div>

      <ul className="kc-plan-notes">
        {data.notes.map((n) => (
          <li key={n}>※ {n}</li>
        ))}
      </ul>
    </>
  )
}
