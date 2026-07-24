import { useEffect, useRef, useState } from 'react'

/**
 * 화면 하단에서 올라왔다가 잠시 뒤 내려가며 사라지는 알림(에러) 토스트.
 * message 가 바뀌면 새로 뜬다. 클릭하면 즉시 닫힌다. 모달 위에도 보이도록 z-index 를 높인다.
 */
export default function Toast({ message, onClose, duration = 3200 }) {
  const [content, setContent] = useState('')
  const [show, setShow] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!message) return
    setContent(message)
    const raf = requestAnimationFrame(() => setShow(true)) // 다음 프레임에 올려서 슬라이드
    const hide = setTimeout(() => setShow(false), duration)
    const clear = setTimeout(() => { setContent(''); onCloseRef.current?.() }, duration + 380)
    return () => { cancelAnimationFrame(raf); clearTimeout(hide); clearTimeout(clear) }
  }, [message, duration])

  if (!content) return null
  return (
    <div
      className={`app-toast${show ? ' show' : ''}`}
      role="alert"
      onClick={() => { setShow(false); setContent(''); onCloseRef.current?.() }}
    >
      {content}
    </div>
  )
}
