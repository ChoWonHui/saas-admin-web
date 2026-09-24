import { useState } from 'react'
import { Link } from 'react-router-dom'
import SiteShell, { SubHead, SecHead } from '../../components/company/SiteShell'
import { BRAND, BIZ_SERVICES, INDUSTRIES, TECH_STACK } from '../../company-data'

/** 사업영역(/biz-area). 원본 kanchenjunga-nodejs/public/biz_area.html 을 옮긴 것이다. */
export default function BizAreaPage() {
  return (
    <SiteShell solidHeader title="사업영역">
      <SubHead title="사업영역" />
      <CoreServices />
      <Industries />
      <TechStack />
      <Cta />
    </SiteShell>
  )
}

function CoreServices() {
  return (
    <section className="kc-sec" id="business-overview">
      <div className="kc-wrap">
        <SecHead
          title={`${BRAND.name}의 핵심 사업 분야`}
          desc="KANCHENJUNGA는 변화하는 IT 환경에 최적화된 솔루션과 서비스를 제공하여 고객의 비즈니스 혁신을 지원합니다."
        />
        <div className="kc-biz">
          {BIZ_SERVICES.map((s) => (
            <article className="kc-biz-card" key={s.id}>
              <span className="kc-biz-ic">
                <span className="material-symbols-outlined">{s.icon}</span>
              </span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              <ul className="kc-biz-items">
                {s.items.map((it) => (
                  <li key={it}>
                    <span className="material-symbols-outlined">check</span>
                    {it}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function Industries() {
  return (
    <section className="kc-sec kc-sec-alt" id="industry-expertise">
      <div className="kc-wrap">
        <SecHead
          title="산업별 전문 솔루션"
          desc={`${BRAND.name}는 다양한 산업 분야의 특성을 이해하고, 각 산업에 최적화된 맞춤형 IT 솔루션을 제공하여 고객의 경쟁력 강화를 지원합니다.`}
        />
        {INDUSTRIES.map((ind) => (
          <div className={`kc-ind${ind.reverse ? ' rev' : ''}`} key={ind.id}>
            <div className="kc-ind-img">
              <img src={ind.img} alt={ind.alt} width="1200" height="800" loading="lazy" decoding="async" />
            </div>
            <div>
              <h3>
                <span className="material-symbols-outlined">{ind.icon}</span>
                {ind.title}
              </h3>
              <p className="kc-ind-en">{ind.en}</p>
              <p>{ind.desc}</p>
              <ul className="kc-ind-items">
                {ind.items.map((it) => (
                  <li key={it}>
                    <span className="material-symbols-outlined">check_circle</span>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TechStack() {
  const [tab, setTab] = useState(TECH_STACK[0].id)
  const current = TECH_STACK.find((t) => t.id === tab) ?? TECH_STACK[0]

  return (
    <section className="kc-sec" id="technology-stack">
      <div className="kc-wrap">
        <SecHead
          title="우리의 기술 스택"
          desc="최신 기술 트렌드를 반영한 다양한 기술 스택을 활용하여 최고의 솔루션을 제공합니다."
        />

        {/* 탭. role=tablist 로 묶어 스크린리더가 "탭 3/4" 처럼 읽게 한다. */}
        <div className="kc-tabs" role="tablist" aria-label="기술 스택 분류">
          {TECH_STACK.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={t.id === tab}
              aria-controls={`panel-${t.id}`}
              className={`kc-tab${t.id === tab ? ' on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="kc-chips" role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`}>
          {current.items.map((it) => (
            <span className="kc-chip" key={it}>
              {it}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Cta() {
  return (
    <section className="kc-cta">
      <div className="kc-cta-inner">
        <h2>어떤 solution 이 필요하신가요?</h2>
        <p>
          사업 분야가 아직 정해지지 않았어도 괜찮습니다. 지금 상황만 알려주시면 어디서부터 손대야 할지 함께
          찾아보겠습니다.
        </p>
        <Link className="kc-btn kc-btn-primary" to="/contact">
          문의하기
          <span className="material-symbols-outlined">arrow_forward</span>
        </Link>
      </div>
    </section>
  )
}
