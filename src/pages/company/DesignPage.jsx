import { useEffect, useMemo, useState } from 'react'
import SiteShell, { SubHead, SecHead } from '../../components/company/SiteShell'
import DesignPreview from '../../components/company/DesignPreview'
import RequestForm, { MenuPicker } from '../../components/company/RequestForm'
import '../../design.css'
import {
  CONCEPTS, FILTERS, GROUPS, DEFAULT_ACCENT, hexToRgb,
  MENU_CATALOG, MENU_LABEL, DEFAULT_MENUS,
} from '../../design-concepts'

const PICK_KEY = 'kc.design.pick'
const COLOR_KEY = 'kc.design.color'
const MENU_KEY = 'kc.design.menus'
const TEXT_KEY = 'kc.design.text'

const EMPTY_TEXT = { brand: '', title1: '', title2: '', lead: '', cta: '' }

/**
 * 디자인 시안(/design). 서로 다른 레이아웃 구조 30가지를 보여주고 하나를 고르게 한다.
 *
 * 색은 시안에 묶어 두지 않는다 — 구조를 비교하는 자리라 색이 제각각이면 비교가 안 된다.
 * 위쪽 색 선택기에서 고른 포인트 색 하나가 30장 전부에 즉시 반영된다.
 *
 * 고른 값은 브라우저(localStorage)에만 둔다. 이 사이트에는 저장할 백엔드가 없다.
 * 대신 문의로 넘어갈 때 시안 번호와 색을 메일에 실어 담당자가 알 수 있게 한다.
 */
export default function DesignPage() {
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)
  const [pick, setPick] = useState('')
  const [accent, setAccent] = useState(DEFAULT_ACCENT)
  const [dark, setDark] = useState(false)
  const [request, setRequest] = useState(false)
  const [text, setText] = useState(EMPTY_TEXT) // 로고·문구 직접 입력

  // 고른 메뉴: id -> 상단 노출 여부(boolean). Map 이라 순서가 고른 순서대로 유지된다.
  const [menuMap, setMenuMap] = useState(() => new Map(DEFAULT_MENUS.map((id) => [id, true])))
  const [custom, setCustom] = useState([]) // 직접 추가한 메뉴

  useEffect(() => {
    try {
      setPick(localStorage.getItem(PICK_KEY) || '')
      const c = localStorage.getItem(COLOR_KEY)
      if (c && hexToRgb(c)) setAccent(c)
      const m = JSON.parse(localStorage.getItem(MENU_KEY) || 'null')
      if (m?.picked) setMenuMap(new Map(m.picked))
      if (Array.isArray(m?.custom)) setCustom(m.custom)
      const t = JSON.parse(localStorage.getItem(TEXT_KEY) || 'null')
      if (t) setText({ ...EMPTY_TEXT, ...t })
    } catch {
      /* 사생활 보호 모드에서 막혀도 화면은 동작해야 한다 */
    }
  }, [])

  // 메뉴 선택이 바뀔 때마다 저장한다(Map 은 JSON 이 못 다루므로 배열로 바꿔 둔다).
  useEffect(() => {
    try {
      localStorage.setItem(MENU_KEY, JSON.stringify({ picked: [...menuMap], custom }))
    } catch { /* 저장 실패는 무시 */ }
  }, [menuMap, custom])

  useEffect(() => {
    try { localStorage.setItem(TEXT_KEY, JSON.stringify(text)) } catch { /* 무시 */ }
  }, [text])

  const save = (k, v) => {
    try { localStorage.setItem(k, v) } catch { /* 저장 실패는 무시 */ }
  }

  function choose(id) {
    setPick(id)
    save(PICK_KEY, id)
  }

  function changeColor(hex) {
    setAccent(hex)
    save(COLOR_KEY, hex)
  }

  /* ── 메뉴 조작 ─────────────────────────── */
  function toggleMenu(id) {
    setMenuMap((m) => {
      const next = new Map(m)
      if (next.has(id)) next.delete(id)
      else next.set(id, false) // 넣기만 하고 상단 노출은 따로 켠다
      return next
    })
  }

  function toggleMain(id) {
    if (menuMap.has(id)) {
      setMenuMap((m) => new Map(m).set(id, !m.get(id)))
      return
    }
    // 직접 추가한 메뉴는 custom 쪽에 있다
    setCustom((cs) => cs.map((c) => (c.id === id ? { ...c, main: !c.main } : c)))
  }

  function addCustom(label) {
    setCustom((cs) =>
      cs.some((c) => c.label === label) ? cs : [...cs, { id: `x-${Date.now()}`, label, main: false }],
    )
  }

  const removeCustom = (id) => setCustom((cs) => cs.filter((c) => c.id !== id))

  /* ── 파생값 ────────────────────────────── */
  // 시안 헤더에 그릴 메뉴 = 상단 노출로 켠 것들
  const navLabels = useMemo(
    () => [
      ...[...menuMap].filter(([, main]) => main).map(([id]) => MENU_LABEL[id]).filter(Boolean),
      ...custom.filter((c) => c.main).map((c) => c.label),
    ],
    [menuMap, custom],
  )

  // 메일 본문에 넣을 메뉴 목록. 상단 노출은 [상단] 으로 표시한다.
  const menuSummary = useMemo(() => {
    const lines = []
    for (const g of MENU_CATALOG) {
      const hit = g.items.filter((i) => menuMap.has(i.id))
      if (hit.length) {
        lines.push(`· ${g.group}: ` + hit.map((i) => `${i.label}${menuMap.get(i.id) ? ' [상단]' : ''}`).join(', '))
      }
    }
    if (custom.length) {
      lines.push('· 기타: ' + custom.map((c) => `${c.label}${c.main ? ' [상단]' : ''}`).join(', '))
    }
    return {
      text: lines.join('\n'),
      count: menuMap.size + custom.length,
      mainCount: navLabels.length,
    }
  }, [menuMap, custom, navLabels])

  const list = useMemo(
    () => (filter === 'all' ? CONCEPTS : CONCEPTS.filter((c) => c.group === filter)),
    [filter],
  )
  const picked = CONCEPTS.find((c) => c.id === pick)

  return (
    <SiteShell solidHeader title="디자인 시안">
      <SubHead title="디자인 시안" />

      <section className="kc-sec">
        <div className="kc-wrap">
          <SecHead
            title="구조를 먼저 고르고, 색은 직접 맞춰보세요"
            desc="배치가 서로 다른 30가지 구조입니다. 아래 미리보기는 그림이 아니라 실제로 그려진 화면이라, 색을 바꾸면 30장이 한꺼번에 바뀝니다."
          />

          <ColorTools accent={accent} onColor={changeColor} dark={dark} onDark={setDark} />

          <TextTools value={text} onChange={setText} onReset={() => setText(EMPTY_TEXT)} />

          {/* 색 블록이 무엇인지 먼저 알려준다 — 안 그러면 "이 색 덩어리가 뭐냐"는 오해를 산다. */}
          <p className="dg-hintline">
            <span className="material-symbols-outlined">image</span>
            시안에서 <b>포인트 색으로 칠해진 영역</b>은 사진·영상이 들어갈 자리입니다. 실제 제작 때 준비하신
            이미지로 채웁니다.
          </p>

          <MenuPicker
            picked={menuMap}
            onToggle={toggleMenu}
            onMain={toggleMain}
            custom={custom}
            onAddCustom={addCustom}
            onRemoveCustom={removeCustom}
          />

          <Filters value={filter} onChange={setFilter} count={list.length} />

          <ul className="dg-grid">
            {list.map((c) => (
              <li key={c.id}>
                <ConceptCard
                  concept={c}
                  accent={accent}
                  dark={dark}
                  nav={navLabels}
                  content={text}
                  picked={pick === c.id}
                  onOpen={() => setOpen(c)}
                  onPick={() => choose(c.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PickedBar
        concept={picked}
        accent={accent}
        menus={menuSummary}
        onOpen={() => picked && setOpen(picked)}
        onClear={() => choose('')}
        onSend={() => setRequest(true)}
      />

      {open && (
        <DetailModal
          concept={open}
          accent={accent}
          dark={dark}
          nav={navLabels}
          content={text}
          picked={pick === open.id}
          onPick={() => choose(open.id)}
          onClose={() => setOpen(null)}
        />
      )}

      {request && (
        <RequestForm
          concept={picked}
          accent={accent}
          menus={menuSummary}
          content={text}
          onClose={() => setRequest(false)}
        />
      )}

      <section className="kc-cta">
        <div className="kc-cta-inner">
          <h2>고르기 어려우시면 그냥 보내셔도 됩니다</h2>
          <p>시안을 못 고르셨어도 괜찮습니다. 이름과 이메일만 남겨주시면 저희가 여쭤보겠습니다.</p>
          <button type="button" className="kc-btn kc-btn-primary" onClick={() => setRequest(true)}>
            요청서 작성하기
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </section>
    </SiteShell>
  )
}

/** 포인트 색 선택. 색상환(input type=color)과 HEX 입력을 함께 둔다. */
function ColorTools({ accent, onColor, dark, onDark }) {
  // 타이핑 중에는 아직 색이 아닐 수 있으므로 입력값을 따로 들고 있는다.
  const [text, setText] = useState(accent)
  useEffect(() => setText(accent), [accent])

  const rgb = hexToRgb(accent)
  const bad = !hexToRgb(text)

  function onText(v) {
    setText(v)
    const hex = v.startsWith('#') ? v : `#${v}`
    if (hexToRgb(hex)) onColor(hex.toLowerCase())
  }

  return (
    <div className="dg-tools">
      <div className="dg-color">
        <label htmlFor="dg-accent">포인트 색</label>
        <input id="dg-accent" type="color" value={accent} onChange={(e) => onColor(e.target.value)} />
        <input
          className={`dg-hex${bad ? ' is-bad' : ''}`}
          value={text}
          onChange={(e) => onText(e.target.value)}
          spellCheck={false}
          aria-label="색상 HEX 값"
        />
        {rgb && <span className="dg-rgb">rgb({rgb.r}, {rgb.g}, {rgb.b})</span>}
      </div>

      <label className="dg-toggle">
        <input type="checkbox" checked={dark} onChange={(e) => onDark(e.target.checked)} />
        다크모드
      </label>
    </div>
  )
}

/** 로고·문구 직접 입력. 비워 두면 예시 문구가 그대로 보인다. */
function TextTools({ value, onChange, onReset }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  const dirty = Object.values(value).some((v) => v.trim() !== '')

  return (
    <div className="dg-text">
      <div className="dg-text-head">
        <div>
          <h3>로고와 문구를 넣어보세요</h3>
          <p>입력하는 대로 30개 시안에 바로 반영됩니다. 비워 두면 예시 문구가 보입니다.</p>
        </div>
        {dirty && (
          <button type="button" className="dg-text-reset" onClick={onReset}>
            <span className="material-symbols-outlined">restart_alt</span>
            초기화
          </button>
        )}
      </div>

      <div className="dg-text-grid">
        <label>
          <span>로고 / 회사명</span>
          <input value={value.brand} onChange={set('brand')} placeholder="KANCHENJUNGA" maxLength={24} />
        </label>
        <label>
          <span>버튼 문구</span>
          <input value={value.cta} onChange={set('cta')} placeholder="프로젝트 문의" maxLength={16} />
        </label>
        <label>
          <span>메인 문구 1행</span>
          <input value={value.title1} onChange={set('title1')} placeholder="미래를 코딩하다," maxLength={30} />
        </label>
        <label>
          <span>메인 문구 2행 <i>(포인트 색으로 표시됩니다)</i></span>
          <input value={value.title2} onChange={set('title2')} placeholder="KANCHENJUNGA" maxLength={30} />
        </label>
        <label className="dg-text-wide">
          <span>설명 문구</span>
          <input
            value={value.lead}
            onChange={set('lead')}
            placeholder="기획부터 디자인, 개발, 보안까지 한 팀이 끝까지 책임집니다."
            maxLength={80}
          />
        </label>
      </div>
    </div>
  )
}

function Filters({ value, onChange, count }) {
  return (
    <div className="dg-filters">
      <div className="kc-tabs dg-tabs" role="tablist" aria-label="구조 분류">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={f.id === value}
            className={`kc-tab${f.id === value ? ' on' : ''}`}
            onClick={() => onChange(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className="dg-count">{count}개</p>
    </div>
  )
}

const groupLabel = (id) => GROUPS.find((g) => g.id === id)?.label ?? ''

function ConceptCard({ concept, accent, dark, nav, content, picked, onOpen, onPick }) {
  return (
    <article className={`dg-card${picked ? ' is-picked' : ''}`}>
      {/* 카드 전체를 버튼으로 만들면 안쪽 '선택' 버튼과 중첩된다 — 미리보기만 버튼으로 둔다. */}
      <button type="button" className="dg-shot" onClick={onOpen} aria-label={`${concept.name} 크게 보기`}>
        <DesignPreview layout={concept} accent={accent} dark={dark} nav={nav} content={content} />
        <span className="dg-zoom">
          <span className="material-symbols-outlined">zoom_in</span>
        </span>
      </button>

      <div className="dg-meta">
        <div className="dg-meta-top">
          <span className="dg-no">{concept.no}</span>
          <h3>{concept.name}</h3>
        </div>
        <p className="dg-desc">{concept.desc}</p>
        <div className="dg-actions">
          <span className="dg-group">{groupLabel(concept.group)}</span>
          <button type="button" className={`dg-pick${picked ? ' on' : ''}`} onClick={onPick}>
            <span className="material-symbols-outlined">{picked ? 'check_circle' : 'radio_button_unchecked'}</span>
            {picked ? '선택함' : '선택'}
          </button>
        </div>
      </div>
    </article>
  )
}

/**
 * 화면 아래에 항상 붙어 있는 요약 바.
 * 시안을 고르지 않아도 뜬다 — 메뉴만 정하고 보내는 경우도 있기 때문이다.
 */
function PickedBar({ concept, accent, menus, onOpen, onClear, onSend }) {
  return (
    <div className="dg-bar">
      <div className="dg-bar-inner">
        <span className="dg-bar-no" style={{ background: accent }}>
          {concept ? concept.no : '-'}
        </span>
        <span className="dg-bar-name">
          {concept ? concept.name : '시안 미선택'}
          <i>
            {accent.toUpperCase()} · 메뉴 {menus.count}개
            {menus.mainCount > 0 && ` (상단 ${menus.mainCount})`}
          </i>
        </span>
        <div className="dg-bar-btns">
          {concept && (
            <button type="button" className="kc-btn kc-btn-line" onClick={onOpen}>
              크게 보기
            </button>
          )}
          <button type="button" className="kc-btn kc-btn-primary" onClick={onSend}>
            {concept ? '이 시안으로 보내기' : '요청서 보내기'}
          </button>
          {concept && (
            <button type="button" className="dg-bar-x" onClick={onClear} aria-label="선택 해제">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailModal({ concept, accent, dark, nav, content, picked, onPick, onClose }) {
  // 열려 있는 동안 Esc 로 닫고 뒤 본문 스크롤을 잠근다(프로젝트 공통 규칙).
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('no-scroll')
    }
  }, [onClose])

  return (
    <div className="dg-modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label={concept.name}>
      <div className="dg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="dg-modal-head">
          <div>
            <span className="dg-no">{concept.no}</span>
            <h3>{concept.name}</h3>
          </div>
          <button type="button" className="dg-modal-x" onClick={onClose} aria-label="닫기">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="dg-modal-shot">
          <DesignPreview layout={concept} accent={accent} dark={dark} nav={nav} content={content} detailed />
        </div>

        <div className="dg-modal-body">
          <p className="dg-modal-desc">{concept.desc}</p>
        </div>

        <div className="dg-modal-foot">
          <span className="dg-group">{groupLabel(concept.group)} · 포인트 색 {accent.toUpperCase()}</span>
          <button type="button" className={`kc-btn ${picked ? 'kc-btn-line' : 'kc-btn-primary'}`} onClick={onPick}>
            <span className="material-symbols-outlined">{picked ? 'check_circle' : 'radio_button_unchecked'}</span>
            {picked ? '선택함' : '이 구조 선택'}
          </button>
        </div>
      </div>
    </div>
  )
}
