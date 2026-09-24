import { useState } from 'react'
import SiteShell, { SubHead, SecHead, isProductHost } from '../../components/company/SiteShell'
import { CONTACT, EMAIL_DOMAINS, EXPRISM_LEAD } from '../../company-data'

const DIRECT = '__direct__'

/**
 * 문의(/contact). 원본 kanchenjunga-nodejs/public/contact.html 을 옮긴 것이다.
 *
 * 한 경로가 두 가지 문의를 받는다.
 *   - kanchenjunga.co.kr : 프로젝트 문의 (제목 + 내용)
 *   - exprism.co.kr      : EXPRISM 도입 문의 (매장 정보)
 * 가게 사장님에게 "문의 제목" 을 지어 달라고 하면 아무도 제대로 못 쓴다.
 * 대신 우리가 안내에 필요한 것(매장명·규모·시기·관심 기능)을 항목으로 묻는다.
 *
 * 보내는 방식은 두 경우가 같다.
 *   1) 먼저 API 로 보낸다 (백엔드가 붙어 있으면 그대로 동작한다)
 *   2) 실패하면 이유를 밝히고, 같은 내용을 담은 메일 앱 링크를 준다
 * 어느 쪽이든 문의가 우리에게 도달하는 길이 남는다.
 */
export default function ContactPage() {
  const lead = isProductHost()

  const [form, setForm] = useState({
    name: '', phone: '', emailId: '', emailDomain: EMAIL_DOMAINS[0], emailCustom: '',
    subject: '', message: '', privacy: false,
    // 도입 문의 전용
    store: '', size: '', timing: '', interests: [],
  })
  const [state, setState] = useState({ sending: false, error: '', done: false, mailto: '' })

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
  }

  const toggleInterest = (label) => setForm((f) => ({
    ...f,
    interests: f.interests.includes(label)
      ? f.interests.filter((x) => x !== label)
      : [...f.interests, label],
  }))

  const email =
    form.emailDomain === DIRECT ? `${form.emailId}@${form.emailCustom}` : `${form.emailId}${form.emailDomain}`

  /** 도입 문의는 제목을 받지 않으므로 매장명으로 만든다. */
  const subject = lead ? `[EXPRISM 도입 문의] ${form.store}`.trim() : form.subject

  /** 메일 본문. 폼에 적은 것이 하나도 빠지지 않게 여기서 한 번에 엮는다. */
  function buildBody() {
    const rows = lead
      ? [
        `매장명: ${form.store}`,
        `담당자: ${form.name}`,
        `연락처: ${form.phone}`,
        `이메일: ${email}`,
        `매장 규모: ${form.size || '-'}`,
        `도입 희망 시기: ${form.timing || '-'}`,
        `관심 기능: ${form.interests.length ? form.interests.join(', ') : '-'}`,
      ]
      : [
        `이름: ${form.name}`,
        `연락처: ${form.phone || '-'}`,
        `이메일: ${email}`,
      ]
    return [...rows, '', form.message || ''].join('\n')
  }

  function buildMailto() {
    return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildBody())}`
  }

  async function onSubmit(e) {
    e.preventDefault()
    setState({ sending: true, error: '', done: false, mailto: '' })

    const payload = {
      name: form.name, phone: form.phone, email, subject, message: buildBody(),
      ...(lead ? { store: form.store, size: form.size, timing: form.timing, interests: form.interests } : {}),
    }

    try {
      const res = await fetch('/api-proxy/home/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        // 서버가 응답은 했지만 거절한 경우 — 서버 메시지를 그대로 보여준다.
        const text = await res.text()
        let msg = `전송하지 못했습니다. (${res.status})`
        try { msg = JSON.parse(text)?.message || msg } catch { /* JSON 이 아니면 기본 문구를 쓴다 */ }
        throw new Error(msg)
      }
      setState({ sending: false, error: '', done: true, mailto: '' })
      setForm((f) => ({ ...f, subject: '', message: '', privacy: false, interests: [] }))
    } catch (err) {
      // 네트워크 자체가 실패한 경우(백엔드 미연결) 포함.
      setState({
        sending: false,
        done: false,
        error: err.message || '전송 중 오류가 발생했습니다.',
        mailto: buildMailto(),
      })
    }
  }

  const pageTitle = lead ? '도입 문의' : '문의하기'

  return (
    <SiteShell solidHeader title={pageTitle}>
      <SubHead title={pageTitle} />

      <section className="kc-sec">
        <div className="kc-wrap">
          <SecHead
            title={lead ? 'EXPRISM 도입 문의' : '프로젝트 문의'}
            desc={lead
              ? '매장 사정을 남겨주시면 담당자가 확인 후 연락드립니다. 규모와 메뉴 구성에 맞춰 안내드립니다.'
              : '궁금하신 내용을 남겨주시면 각 분야의 담당자가 확인 후 성심껏 답변드립니다.'}
          />

          <form className="kc-form" onSubmit={onSubmit} noValidate={false}>
            {lead && (
              <label className="kc-field">
                <span>매장명<span className="kc-req">*</span></span>
                <input
                  type="text" placeholder="맛있는식당" required
                  value={form.store} onChange={set('store')}
                />
              </label>
            )}

            <div className="kc-row">
              <label className="kc-field">
                <span>{lead ? '담당자 이름' : '이름'}<span className="kc-req">*</span></span>
                <input type="text" placeholder="홍길동" required value={form.name} onChange={set('name')} />
              </label>
              <label className="kc-field">
                {/* 도입 문의는 전화로 안내하는 편이 빠르므로 연락처를 필수로 받는다. */}
                <span>연락처{lead ? <span className="kc-req">*</span> : ' (선택)'}</span>
                <input
                  type="tel" placeholder="010-1234-5678" required={lead}
                  value={form.phone} onChange={set('phone')}
                />
              </label>
            </div>

            <div className="kc-field">
              <span>이메일<span className="kc-req">*</span></span>
              <div className="kc-email">
                <input
                  type="text" placeholder="yourname" required
                  value={form.emailId} onChange={set('emailId')} aria-label="이메일 아이디"
                />
                <span className="kc-email-at" aria-hidden="true">@</span>
                {form.emailDomain === DIRECT ? (
                  <input
                    type="text" placeholder="example.com" required
                    value={form.emailCustom} onChange={set('emailCustom')} aria-label="이메일 도메인 직접 입력"
                  />
                ) : (
                  <select value={form.emailDomain} onChange={set('emailDomain')} aria-label="이메일 도메인">
                    {EMAIL_DOMAINS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value={DIRECT}>직접 입력</option>
                  </select>
                )}
              </div>
            </div>

            {lead ? (
              <>
                <div className="kc-row">
                  <label className="kc-field">
                    <span>매장 규모</span>
                    <select value={form.size} onChange={set('size')}>
                      <option value="">선택해주세요</option>
                      {EXPRISM_LEAD.sizes.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                  <label className="kc-field">
                    <span>도입 희망 시기</span>
                    <select value={form.timing} onChange={set('timing')}>
                      <option value="">선택해주세요</option>
                      {EXPRISM_LEAD.timings.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </label>
                </div>

                <div className="kc-field">
                  <span>관심 있는 기능 (여러 개 고를 수 있습니다)</span>
                  <div className="kc-chips">
                    {EXPRISM_LEAD.interests.map((v) => (
                      <label key={v} className={`kc-chip${form.interests.includes(v) ? ' on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={form.interests.includes(v)}
                          onChange={() => toggleInterest(v)}
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <label className="kc-field">
                <span>문의 제목<span className="kc-req">*</span></span>
                <input
                  type="text" placeholder="문의 제목을 입력해주세요." required
                  value={form.subject} onChange={set('subject')}
                />
              </label>
            )}

            <label className="kc-field">
              <span>문의 내용{lead ? ' (선택)' : <span className="kc-req">*</span>}</span>
              <textarea
                placeholder={lead
                  ? '메뉴 수, 포장 주문 여부, 지금 쓰고 계신 방식 등 알려주시면 더 정확히 안내드립니다.'
                  : '문의하실 내용을 자세하게 작성해주세요.'}
                required={!lead}
                value={form.message} onChange={set('message')}
              />
            </label>

            <label className="kc-check">
              <input type="checkbox" required checked={form.privacy} onChange={set('privacy')} />
              <span>
                개인정보 수집 및 이용에 동의합니다. 수집한 정보는 문의 답변 목적으로만 사용하며, 답변 완료 후
                파기합니다.<span className="kc-req">*</span>
              </span>
            </label>

            {state.error && (
              <p className="kc-alert kc-alert-err">
                {state.error}{' '}
                {state.mailto && (
                  <a href={state.mailto} style={{ textDecoration: 'underline' }}>
                    메일 앱으로 보내기
                  </a>
                )}
              </p>
            )}
            {state.done && <p className="kc-alert kc-alert-ok">문의가 접수되었습니다. 확인 후 연락드리겠습니다.</p>}

            <div className="kc-form-actions">
              <button type="submit" className="kc-btn kc-btn-primary" disabled={state.sending}>
                {state.sending ? '보내는 중…' : (lead ? '도입 문의 보내기' : '문의 보내기')}
                {!state.sending && <span className="material-symbols-outlined">send</span>}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="kc-sec kc-sec-alt">
        <div className="kc-wrap">
          {/* 2열 배치는 CSS 클래스로 준다 — 인라인 style 은 미디어쿼리가 못 이겨서
              좁은 화면에서도 2열로 남고, 그러면 이메일 주소 때문에 가로로 넘친다. */}
          <div className="kc-info">
            <div className="kc-info-card">
              <h3><span className="material-symbols-outlined">mail</span>이메일</h3>
              <p><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></p>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}
