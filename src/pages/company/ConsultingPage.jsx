import { Link } from 'react-router-dom'
import SiteShell, { SubHead, SecHead } from '../../components/company/SiteShell'
import { BRAND, CONSULTING } from '../../company-data'

/** IT 컨설팅(/biz-area/consulting). 메인의 'IT 컨설팅' 카드에서도 이리로 온다. */
export default function ConsultingPage() {
  return (
    <SiteShell solidHeader title="IT 컨설팅">
      <SubHead title="IT 컨설팅" />
      <Intro />
      <Tracks />
      <Steps />
      <Fits />

      <section className="kc-cta">
        <div className="kc-cta-inner">
          <h2>무엇부터 해야 할지 몰라도 괜찮습니다</h2>
          <p>지금 상황만 알려주시면 어디서부터 손대야 할지 함께 찾아보겠습니다.</p>
          <Link className="kc-btn kc-btn-primary" to="/contact">
            문의하기
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>
    </SiteShell>
  )
}

function Intro() {
  return (
    <section className="kc-sec">
      <div className="kc-wrap">
        <div className="kc-split">
          <div>
            <h2>{CONSULTING.lead}</h2>
            {CONSULTING.paragraphs.map((p) => (
              <p key={p.slice(0, 14)}>{p}</p>
            ))}
          </div>
          <div className="kc-split-img">
            <img src={CONSULTING.img} alt={CONSULTING.alt} width="1200" height="900" loading="lazy" decoding="async" />
          </div>
        </div>
      </div>
    </section>
  )
}

function Tracks() {
  return (
    <section className="kc-sec kc-sec-alt">
      <div className="kc-wrap">
        <SecHead
          title="새로 만드는 일, 돌보는 일"
          desc="처음부터 만드는 것도, 이미 쓰고 계신 것을 고쳐 쓰는 것도 맡습니다."
        />
        {/* 두 장뿐이라 사업영역의 3열 그리드(.kc-biz) 대신 2열인 .kc-vision 을 쓴다. */}
        <div className="kc-vision">
          {CONSULTING.tracks.map((t) => (
            <article className="kc-vision-card" key={t.id}>
              <div className="kc-vision-top">
                <span className="material-symbols-outlined">{t.icon}</span>
                <h3>{t.title}</h3>
              </div>
              <p>{t.desc}</p>
              <ul className="kc-biz-items">
                {t.items.map((it) => (
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

function Steps() {
  return (
    <section className="kc-sec">
      <div className="kc-wrap">
        <SecHead title="어떻게 진행되나요" desc="가장 많이 받는 질문입니다. 네 단계로 나눠 답을 드립니다." />
        <ol className="kc-steps">
          {CONSULTING.steps.map((s) => (
            <li key={s.no}>
              <span className="kc-step-no">{s.no}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Fits() {
  return (
    <section className="kc-sec kc-sec-alt">
      <div className="kc-wrap">
        <SecHead title="이런 경우에 찾아주세요" />
        <ul className="kc-fits">
          {CONSULTING.fits.map((f) => (
            <li key={f}>
              <span className="material-symbols-outlined">check_circle</span>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
