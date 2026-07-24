import { useEffect, useRef, useState } from 'react'
import { fileApi } from '../api/client'

/**
 * contentEditable 기반 미니 리치 에디터 (굵게/색상/글자크기/정렬/목록/이미지).
 * 이미지 업로드 함수는 prop 으로 주입한다(기본값은 관리자 fileApi). 업체 콘솔은 tenant 업로더를 넘긴다.
 */
export default function RichEditor({ value, onChange, uploadImage = fileApi.uploadImage }) {
  const ref = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || ''
    // 마운트 시 1회만 초기 HTML 주입 (이후엔 contentEditable 이 소유)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sync = () => onChange(ref.current.innerHTML)
  const exec = (cmd, arg) => { ref.current.focus(); document.execCommand(cmd, false, arg); sync() }

  const uploadSeq = useRef(0)
  function insertImageFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const id = `imgup${Date.now()}x${uploadSeq.current++}`
      ref.current.focus()
      document.execCommand('insertHTML', false, `<img id="${id}" src="${reader.result}" style="max-width:100%" />`)
      sync()
      uploadImage(file)
        .then(({ url }) => {
          const el = ref.current?.querySelector(`#${id}`)
          if (el) { el.setAttribute('src', url); el.removeAttribute('id') }
          sync()
        })
        .catch((err) => {
          console.warn('이미지 업로드 실패 — base64 로 대체합니다.', err)
          const el = ref.current?.querySelector(`#${id}`)
          if (el) el.removeAttribute('id')
        })
    }
    reader.readAsDataURL(file)
  }

  function onImage(e) {
    insertImageFile(e.target.files[0])
    e.target.value = ''
  }

  const [dragOver, setDragOver] = useState(false)
  function onDrop(e) {
    const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (files.length === 0) return
    e.preventDefault()
    setDragOver(false)
    files.forEach(insertImageFile)
  }
  function onPaste(e) {
    const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
    if (!item) return
    e.preventDefault()
    insertImageFile(item.getAsFile())
  }

  const noBlur = (e) => e.preventDefault()

  const canvasRef = useRef(null)
  const [selImg, setSelImg] = useState(null)
  const [, tick] = useState(0)
  const redraw = () => tick((t) => t + 1)

  useEffect(() => {
    if (!selImg) return
    window.addEventListener('scroll', redraw, true)
    window.addEventListener('resize', redraw)
    return () => { window.removeEventListener('scroll', redraw, true); window.removeEventListener('resize', redraw) }
  }, [selImg])

  function onBodyClick(e) {
    setSelImg(e.target.tagName === 'IMG' ? e.target : null)
  }

  function overlayBox() {
    if (!selImg || !canvasRef.current) return null
    const ir = selImg.getBoundingClientRect()
    const cr = canvasRef.current.getBoundingClientRect()
    return { left: ir.left - cr.left, top: ir.top - cr.top, width: ir.width, height: ir.height }
  }

  function startResize(e) {
    e.preventDefault(); e.stopPropagation()
    const img = selImg
    const startX = e.clientX
    const startW = img.getBoundingClientRect().width
    const maxW = ref.current.clientWidth - 4
    function move(ev) {
      const w = Math.max(40, Math.min(startW + (ev.clientX - startX), maxW))
      img.style.width = `${Math.round(w)}px`
      img.style.height = 'auto'
      redraw()
    }
    function up() {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      sync()
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function resizePreset(pct) {
    if (!selImg) return
    selImg.style.width = `${pct}%`
    selImg.style.height = 'auto'
    redraw(); sync()
  }
  function deleteImg() {
    if (!selImg) return
    selImg.remove()
    setSelImg(null)
    sync()
  }

  const box = overlayBox()

  return (
    <div className="editor">
      <div className="editor-toolbar" onMouseDown={noBlur}>
        <button type="button" onClick={() => exec('bold')} title="굵게"><b>B</b></button>
        <button type="button" onClick={() => exec('italic')} title="기울임"><i>I</i></button>
        <button type="button" onClick={() => exec('underline')} title="밑줄"><u>U</u></button>
        <span className="editor-sep" />
        <label className="editor-color" title="글자색">
          <span>색</span>
          <input type="color" onChange={(e) => exec('foreColor', e.target.value)} />
        </label>
        <select className="editor-size" title="글자 크기" defaultValue="3" onChange={(e) => exec('fontSize', e.target.value)}>
          <option value="1">아주 작게</option>
          <option value="2">작게</option>
          <option value="3">보통</option>
          <option value="5">크게</option>
          <option value="6">더 크게</option>
          <option value="7">아주 크게</option>
        </select>
        <span className="editor-sep" />
        <button type="button" onClick={() => exec('justifyLeft')} title="왼쪽">⯇</button>
        <button type="button" onClick={() => exec('justifyCenter')} title="가운데">≡</button>
        <button type="button" onClick={() => exec('justifyRight')} title="오른쪽">⯈</button>
        <button type="button" onClick={() => exec('insertUnorderedList')} title="목록">•≣</button>
        <span className="editor-sep" />
        <button type="button" className="editor-icon" onClick={() => fileRef.current.click()} title="사진 넣기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2.5" />
            <circle cx="8.5" cy="8.5" r="1.6" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </button>
      </div>
      <div className="editor-canvas" ref={canvasRef}>
        <div
          ref={ref}
          className={`editor-body${dragOver ? ' drag-over' : ''}`}
          contentEditable
          suppressContentEditableWarning
          onInput={() => { sync(); if (selImg && !selImg.isConnected) setSelImg(null) }}
          onClick={onBodyClick}
          onDrop={onDrop}
          onDragOver={(e) => { if ([...(e.dataTransfer?.types ?? [])].includes('Files')) { e.preventDefault(); setDragOver(true) } }}
          onDragLeave={() => setDragOver(false)}
          onPaste={onPaste}
        />
        {box && (
          <div className="img-overlay" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
            <div className="img-tools" onMouseDown={noBlur}>
              <button type="button" onClick={() => resizePreset(25)} title="25%">S</button>
              <button type="button" onClick={() => resizePreset(50)} title="50%">M</button>
              <button type="button" onClick={() => resizePreset(100)} title="100%">L</button>
              <button type="button" className="img-del" onClick={deleteImg} title="이미지 삭제">✕</button>
            </div>
            <span className="img-handle" onMouseDown={startResize} title="드래그로 크기 조절" />
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onImage} />
    </div>
  )
}
