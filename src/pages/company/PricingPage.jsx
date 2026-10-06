import { Link } from 'react-router-dom'
import SiteShell, { SubHead } from '../../components/company/SiteShell'
import { PRICING } from '../../company-data'

/**
 * 홈페이지 제작 요금제(/pricing). 헤더 '요금제' 메뉴에서 온다.
 * 세 상품(START·BUSINESS·CUSTOM)을 카드로 나란히 두고, BUSINESS 를 추천(BEST)으로 띄운다.
 * 가격·기능은 company-data 의 PRICING 한 곳에서 관리한다.
 */
export default function PricingPage() {
  return (
    <SiteShell solidHeader title="요금제">
      <SubHead title="홈페이지 제작 상품" />

      <section className="kc-sec">
        <div className="kc-wrap">
          <p className="kc-pricing-lead">{PRICING.lead}</p>

          <div className="kc-pricing">
            {PRICING.plans.map((p) => (
              <article key={p.key} className={`kc-plan${p.best ? ' is-best' : ''}`}>
                {p.best && <span className="kc-plan-badge">BEST</span>}
                <h2 className="kc-plan-name">{p.name}</h2>
                <div className="kc-plan-price">
                  <strong>{p.price}</strong>
                  <span>{p.unit}</span>
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
                  {p.key === 'custom' ? '견적 문의' : '문의하기'}
                </Link>
              </article>
            ))}
          </div>

          <ul className="kc-plan-notes">
            {PRICING.notes.map((n) => (
              <li key={n}>※ {n}</li>
            ))}
          </ul>
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
