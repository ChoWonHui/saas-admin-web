import { Link } from 'react-router-dom'
import SiteShell, { SubHead, SecHead } from '../../components/company/SiteShell'
import { BRAND, ABOUT, VISION, CONTACT } from '../../company-data'

/** 회사소개(/company). 원본 kanchenjunga-nodejs/public/company_into.html 을 옮긴 것이다. */
export default function AboutPage() {
  return (
    <SiteShell solidHeader title="회사소개">
      <SubHead title="회사소개" />
      <Intro />
      <Vision />
      <Location />
    </SiteShell>
  )
}

function Intro() {
  return (
    <section className="kc-sec" id="company-intro">
      <div className="kc-wrap">
        <div className="kc-split">
          <div>
            <h2>{ABOUT.title}</h2>
            {ABOUT.paragraphs.map((p) => (
              <p key={p.slice(0, 12)}>{p}</p>
            ))}
            <Link className="kc-btn kc-btn-primary" to="/contact">
              문의하기
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
          <div className="kc-split-img">
            <img src={ABOUT.img} alt={ABOUT.alt} width="1200" height="900" loading="lazy" decoding="async" />
          </div>
        </div>
      </div>
    </section>
  )
}

function Vision() {
  return (
    <section className="kc-sec kc-sec-alt" id="company-vision">
      <div className="kc-wrap">
        <SecHead title="우리의 비전과 미션" desc="KANCHENJUNGA는 명확한 비전과 미션을 바탕으로 성장합니다." />
        <div className="kc-vision">
          {VISION.map((v) => (
            <div className="kc-vision-card" key={v.title}>
              <div className="kc-vision-top">
                <span className="material-symbols-outlined">{v.icon}</span>
                <h3>{v.title}</h3>
              </div>
              <p>{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Location() {
  // 지도는 주소 문자열로 검색해 띄운다 — 좌표를 박아 두면 이전할 때 같이 고쳐야 한다.
  const q = encodeURIComponent(`${CONTACT.address} ${CONTACT.company}`)

  return (
    <section className="kc-sec" id="company-location">
      <div className="kc-wrap">
        <SecHead title="오시는 길" desc={`${BRAND.name} 본사 위치를 안내해드립니다.`} />
        <div className="kc-split">
          <div className="kc-map">
            <iframe
              title="본사 위치 지도"
              src={`https://maps.google.com/maps?q=${q}&output=embed&hl=ko`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <div className="kc-info">
            <div className="kc-info-card">
              <h3>
                <span className="material-symbols-outlined">location_on</span>주소
              </h3>
              <p>
                {CONTACT.address}, {CONTACT.company}
              </p>
            </div>
            <div className="kc-info-card">
              <h3>
                <span className="material-symbols-outlined">mail</span>이메일
              </h3>
              <p>
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
