import { Link } from 'react-router-dom'
import SiteShell, { SubHead, SecHead } from '../../components/company/SiteShell'
import { BRAND, GREETING, PRESS } from '../../company-data'

/**
 * 대표 인사말(/company/greeting).
 *
 * 배치 순서: 관련 보도 → 인사말 → CTA.
 * 보도를 위로 올린 이유 — 맨 아래 두면 스크롤을 끝까지 내리는 사람만 보게 되어
 * 사실상 없는 것과 같다. 대신 카드를 낮고 가볍게 만들어 본문(인사말)을 가리지 않게 했다.
 *
 * 인사말 본문은 company-data.js 의 GREETING 에 임시로 적어 두었다 — 실제 표현으로 교체해야 한다.
 */
export default function GreetingPage() {
  return (
    <SiteShell solidHeader title="대표 인사말">
      <SubHead title="대표 인사말" />
      <Press />
      <Greeting />

      <section className="kc-cta">
        <div className="kc-cta-inner">
          <h2>{BRAND.name}와 함께하시겠습니까?</h2>
          <p>어떤 일을 하는 회사인지 더 알고 싶으시면 회사소개와 사업영역을 살펴봐 주세요.</p>
          <Link className="kc-btn kc-btn-primary" to="/contact">
            문의하기
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        </div>
      </section>
    </SiteShell>
  )
}

/** 기사 내용을 옮겨 적지 않고 원문으로 보낸다 — 저작권이 언론사에 있다. */
function Press() {
  return (
    <section className="kc-sec kc-sec-tight kc-sec-alt">
      <div className="kc-wrap">
        <SecHead title="언론 속 대표이사" desc="대표이사 관련 언론 보도입니다." />
        <ul className="kc-press">
          {PRESS.map((a) => (
            <li key={a.url}>
              <a href={a.url} target="_blank" rel="noreferrer">
                <span className="kc-press-outlet">{a.outlet}</span>
                <span className="kc-press-title">{a.title}</span>
                <span className="kc-press-foot">
                  <span className="kc-press-date">{a.date}</span>
                  <span className="material-symbols-outlined">open_in_new</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Greeting() {
  return (
    <section className="kc-sec">
      <div className="kc-wrap">
        <div className="kc-greet">
          {/* 왼쪽 칸: 사진 + 그 아래 이력 */}
          <div className="kc-greet-side">
            <figure className="kc-greet-img">
              <img src={GREETING.img} alt={GREETING.alt} width="900" height="720" loading="lazy" decoding="async" />
            </figure>

            <div className="kc-career">
              <h2 className="kc-career-head">대표이사 이력</h2>
              <ul>
                {GREETING.career.map((c) => {
                  const lines = Array.isArray(c.text) ? c.text : [c.text]
                  return (
                    <li key={lines.join('')}>
                      {/* 배지가 없는 줄도 같은 폭을 차지해야 글머리가 한 줄로 맞는다. */}
                      <span className={`kc-career-when${c.when ? '' : ' none'}`}>{c.when}</span>
                      <span className="kc-career-text">
                        {lines.map((line, i) => (
                          <span key={line} className={i ? 'kc-career-cont' : undefined}>
                            {line}
                          </span>
                        ))}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          <div className="kc-greet-body">
            <p className="kc-greet-lead">{GREETING.lead}</p>
            {GREETING.paragraphs.map((p) => (
              <p key={p.slice(0, 14)}>{p}</p>
            ))}

            <p className="kc-greet-sign">
              {GREETING.sign}
              {/* 성함이 비어 있으면 자리만 남긴다 — 빈 문자열이 그대로 붙어 어색해지지 않게. */}
              {GREETING.name && <strong>{GREETING.name}</strong>}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
