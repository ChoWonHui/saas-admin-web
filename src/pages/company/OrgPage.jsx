import { Link } from 'react-router-dom'
import SiteShell, { SubHead, SecHead } from '../../components/company/SiteShell'
import { BRAND, ORG } from '../../company-data'

/**
 * 조직도(/company/org).
 * 구성은 company-data.js 의 ORG 에 있다 — 본부·팀을 늘리거나 줄여도 화면이 따라온다.
 */
export default function OrgPage() {
  return (
    <SiteShell solidHeader title="조직도">
      <SubHead title="조직도" />

      <section className="kc-sec">
        <div className="kc-wrap">
          <SecHead
            title="조직 구성"
            desc={`${BRAND.name}는 기획부터 개발, 보안까지 한 팀 안에서 함께 봅니다.`}
          />

          <div className="kc-org">
            {/* 대표이사 */}
            <div className="kc-org-top">
              <div className="kc-org-head">
                <strong>{ORG.head.title}</strong>
              </div>
            </div>

            {/* 대표이사 직속 */}
            {ORG.staff.length > 0 && (
              <div className="kc-org-staff">
                {ORG.staff.map((s) => (
                  <div className="kc-org-staff-card" key={s.name}>
                    <strong>{s.name}</strong>
                    {s.desc && <span>{s.desc}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* 본부 — 각 카드가 자기 몫의 연결선을 그린다(company.css 참조) */}
            <div className="kc-org-divs">
              {ORG.divisions.map((d) => (
                <div className="kc-org-div" key={d.id}>
                  <div className="kc-org-div-head">
                    <span className="material-symbols-outlined">{d.icon}</span>
                    {d.name}
                  </div>
                  <ul className="kc-org-teams">
                    {d.teams.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="kc-cta">
        <div className="kc-cta-inner">
          <h2>함께 일할 분을 찾고 있습니다</h2>
          <p>조직과 채용에 관해 궁금한 점이 있으시면 편하게 문의해 주세요.</p>
          <Link className="kc-btn kc-btn-primary" to="/contact">
            문의하기
            <span className="material-symbols-outlined">send</span>
          </Link>
        </div>
      </section>
    </SiteShell>
  )
}
