// 웹 푸시(브라우저/PWA 알림) 구독을 다루는 헬퍼.
//
// 흐름: VAPID 공개키를 서버에서 받아 → 알림 권한 요청 → 서비스워커 등록 → pushManager.subscribe
//      → 만들어진 구독(endpoint·키)을 서버에 저장. 끄면 반대로 서버 구독을 지우고 로컬 구독도 해제.
import { pushApi } from './api/client'

/** VAPID 공개키(Base64URL) → subscribe 가 요구하는 Uint8Array. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

/** 이 브라우저가 웹 푸시를 지원하는가. */
export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** 현재 상태: unsupported | denied | on | off. */
export async function pushState() {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

/** 알림 켜기. 성공하면 'on'. 실패하면 사용자에게 보여줄 메시지를 담아 throw. */
export async function enablePush() {
  if (!pushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않습니다.')

  const { publicKey } = await pushApi.vapidPublicKey()
  if (!publicKey) throw new Error('서버에 푸시가 설정되어 있지 않습니다. 관리자에게 문의하세요.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.')

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
  }
  const json = sub.toJSON()
  await pushApi.subscribe({ endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth })
  return 'on'
}

/** 알림 끄기. 서버 구독을 지우고 로컬 구독도 해제한다. */
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    if (sub) {
      await pushApi.unsubscribe(sub.endpoint).catch(() => {})
      await sub.unsubscribe().catch(() => {})
    }
  } catch {
    /* 이미 없으면 무시 */
  }
  return 'off'
}
