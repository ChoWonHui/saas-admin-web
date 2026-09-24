import { useEffect, useRef, useState } from 'react'
import { MENU_CATALOG } from '../../design-concepts'

const MAX_FILES = 5
const MAX_SIZE = 5 * 1024 * 1024
const OK_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * 디자인 시안 요청서.
 *
 * 고른 시안·색 + 넣고 싶은 메뉴 + 요구사항 + 참고 이미지를 담아 /mail.php 로 보낸다.
 * 시안을 못 고르셨어도 보낼 수 있다 — 이름과 이메일만 있으면 된다.
 */
export default function RequestForm({ concept, accent, menus, content, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' })
  const [files, setFiles] = useState([])
  const [state, setState] = useState({ sending: false, error: '', done: false })
  const fileRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])

  // 미리보기 URL 은 다 쓰면 반드시 해제한다. 안 하면 메모리에 계속 남는다.
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function addFiles(list) {
    const next = [...files]
    let err = ''
    for (const file of list) {
      if (next.length >= MAX_FILES) { err = `이미지는 최대 ${MAX_FILES}장까지 첨부할 수 있습니다.`; break }
      // accept 속성만으로는 못 막는다(파일 선택창에서 '모든 파일'을 고를 수 있다) — 여기서 다시 본다.
      if (!OK_TYPES.includes(file.type)) { err = `이미지 파일만 첨부할 수 있습니다. (${file.name})`; continue }
      if (file.size > MAX_SIZE) { err = `한 장에 5MB 이하만 됩니다. (${file.name})`; continue }
      next.push({ file, url: URL.createObjectURL(file), key: `${file.name}-${file.size}-${file.lastModified}` })
    }
    setFiles(next)
    setState((s) => ({ ...s, error: err }))
  }

  function removeFile(key) {
    setFiles((fs) => {
      const t = fs.find((f) => f.key === key)
      if (t) URL.revokeObjectURL(t.url)
      return fs.filter((f) => f.key !== key)
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setState({ sending: false, error: '이름과 이메일은 입력해 주세요.', done: false })
      return
    }
    setState({ sending: true, error: '', done: false })

    const fd = new FormData()
    fd.append('name', form.name)
    fd.append('email', form.email)
    fd.append('phone', form.phone)
    fd.append('note', form.note)
    fd.append('concept', concept ? `${concept.no} ${concept.name}` : '')
    fd.append('accent', accent)
    fd.append('menus', menus.text)
    // 직접 입력한 로고·문구도 함께 보낸다. 비워 둔 칸은 아예 넣지 않는다.
    fd.append('texts', [
      content?.brand && `로고/회사명: ${content.brand}`,
      content?.title1 && `메인 문구 1행: ${content.title1}`,
      content?.title2 && `메인 문구 2행: ${content.title2}`,
      content?.lead && `설명 문구: ${content.lead}`,
      content?.cta && `버튼 문구: ${content.cta}`,
    ].filter(Boolean).join('\n'))
    fd.append('website', '') // 봇 잡는 빈 칸. 사람은 건드리지 않는다.
    files.forEach((f) => fd.append('images[]', f.file, f.file.name))

    try {
      const res = await fetch('/mail.php', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.message || '전송하지 못했습니다.')
      setState({ sending: false, error: '', done: true })
    } catch (err) {
      setState({ sending: false, error: err.message || '전송 중 오류가 발생했습니다.', done: false })
    }
  }

  if (state.done) {
    return (
      <Shell onClose={onClose} title="접수되었습니다">
        <div className="rq-done">
          <span className="material-symbols-outlined">mark_email_read</span>
          <p>요청서가 전달되었습니다. 확인 후 남겨주신 이메일로 연락드리겠습니다.</p>
          <button type="button" className="kc-btn kc-btn-primary" onClick={onClose}>
            닫기
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell onClose={onClose} title="시안 요청서">
      <form className="rq-form" onSubmit={submit}>
        {/* 무엇을 보내는지 먼저 보여준다 */}
        <div className="rq-summary">
          <div>
            <dt>선택 시안</dt>
            <dd>{concept ? `${concept.no} · ${concept.name}` : '고르지 않음 (상담 요청)'}</dd>
          </div>
          <div>
            <dt>포인트 색</dt>
            <dd>
              <i className="rq-swatch" style={{ background: accent }} />
              {accent.toUpperCase()}
            </dd>
          </div>
          <div>
            <dt>선택 메뉴</dt>
            <dd>
              {menus.count}개 {menus.mainCount > 0 && <em>(상단 노출 {menus.mainCount})</em>}
            </dd>
          </div>
        </div>

        <div className="kc-row">
          <label className="kc-field">
            <span>이름<span className="kc-req">*</span></span>
            <input type="text" placeholder="홍길동" value={form.name} onChange={set('name')} required />
          </label>
          <label className="kc-field">
            <span>이메일<span className="kc-req">*</span></span>
            <input type="email" placeholder="name@example.com" value={form.email} onChange={set('email')} required />
          </label>
        </div>

        <label className="kc-field">
          <span>연락처 (선택)</span>
          <input type="tel" placeholder="010-1234-5678" value={form.phone} onChange={set('phone')} />
        </label>

        <label className="kc-field">
          <span>요구사항 (선택)</span>
          <textarea
            placeholder={'원하시는 느낌, 참고 사이트, 일정이나 예산 등 무엇이든 적어주세요.\n잘 모르시겠으면 비워 두셔도 됩니다. 저희가 여쭤보겠습니다.'}
            value={form.note}
            onChange={set('note')}
          />
        </label>

        {/* 첨부 — 이미지만 */}
        <div className="kc-field">
          <span>참고 이미지 (선택 · 최대 {MAX_FILES}장, 장당 5MB)</span>
          <div className="rq-drop">
            <button type="button" className="kc-btn kc-btn-line" onClick={() => fileRef.current?.click()}>
              <span className="material-symbols-outlined">image</span>
              이미지 고르기
            </button>
            <span className="rq-drop-hint">jpg · png · gif · webp</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              hidden
              onChange={(e) => {
                addFiles([...e.target.files])
                e.target.value = '' // 같은 파일을 다시 고를 수 있게 비운다
              }}
            />
          </div>

          {files.length > 0 && (
            <ul className="rq-thumbs">
              {files.map((f) => (
                <li key={f.key}>
                  <img src={f.url} alt={f.file.name} />
                  <button type="button" onClick={() => removeFile(f.key)} aria-label={`${f.file.name} 제거`}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {state.error && <p className="kc-alert kc-alert-err">{state.error}</p>}

        <div className="rq-actions">
          <button type="button" className="kc-btn kc-btn-line" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="kc-btn kc-btn-primary" disabled={state.sending}>
            {state.sending ? '보내는 중…' : '요청서 보내기'}
            {!state.sending && <span className="material-symbols-outlined">send</span>}
          </button>
        </div>
      </form>
    </Shell>
  )
}

function Shell({ title, children, onClose }) {
  return (
    <div className="dg-modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="dg-modal rq-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dg-modal-head">
          <h3>{title}</h3>
          <button type="button" className="dg-modal-x" onClick={onClose} aria-label="닫기">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * 메뉴 고르기. 각 항목은 두 단계로 정한다 —
 *   ① 사이트에 넣을지  ② 넣는다면 상단(메인) 메뉴에 올릴지
 * 상단에 올린 것은 시안 미리보기의 헤더에 그대로 나타난다.
 */
export function MenuPicker({ picked, onToggle, onMain, custom, onAddCustom, onRemoveCustom }) {
  const [text, setText] = useState('')

  function add(e) {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    onAddCustom(v)
    setText('')
  }

  return (
    <div className="mp">
      <div className="mp-head">
        <div>
          <h3>어떤 메뉴가 필요하세요?</h3>
          <p>넣고 싶은 것을 고르고, 상단 메뉴에 올릴 것은 오른쪽도 함께 켜주세요. 잘 모르시겠으면 그냥 두셔도 됩니다.</p>
        </div>
        <span className="mp-count">
          {picked.size + custom.length}개 선택
        </span>
      </div>

      <div className="mp-groups">
        {MENU_CATALOG.map((g) => (
          <section className="mp-group" key={g.group}>
            <h4>{g.group}</h4>
            <ul>
              {g.items.map((it) => {
                const on = picked.has(it.id)
                const main = picked.get(it.id)
                return (
                  <li key={it.id} className={on ? 'is-on' : ''}>
                    <label className="mp-item">
                      <input type="checkbox" checked={on} onChange={() => onToggle(it.id)} />
                      <span>{it.label}</span>
                    </label>
                    {/* 넣기로 한 항목에만 '상단 노출' 스위치가 나온다 */}
                    <button
                      type="button"
                      className={`mp-main${main ? ' on' : ''}`}
                      disabled={!on}
                      onClick={() => onMain(it.id)}
                      aria-label={`${it.label} 상단 메뉴 노출`}
                      title="상단 메뉴에 노출"
                    >
                      <span className="material-symbols-outlined">{main ? 'star' : 'star_border'}</span>
                      상단
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        {/* 기타 — 목록에 없는 메뉴 직접 추가 */}
        <section className="mp-group mp-custom">
          <h4>기타</h4>
          <form className="mp-add" onSubmit={add}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="예: 온라인 견적, 예약하기"
              aria-label="메뉴 직접 추가"
            />
            <button type="submit" className="kc-btn kc-btn-line">추가</button>
          </form>
          {custom.length > 0 && (
            <ul className="mp-chips">
              {custom.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`mp-chip${c.main ? ' on' : ''}`}
                    onClick={() => onMain(c.id)}
                    title="상단 메뉴에 노출"
                  >
                    <span className="material-symbols-outlined">{c.main ? 'star' : 'star_border'}</span>
                    {c.label}
                  </button>
                  <button type="button" className="mp-chip-x" onClick={() => onRemoveCustom(c.id)} aria-label={`${c.label} 삭제`}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
