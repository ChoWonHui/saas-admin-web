/*
 * 관리자 콘솔 푸시 전용 서비스워커.
 *
 * 새 메일이 오면 백엔드가 이 브라우저의 push 로 알림을 밀어준다. 여기서는 그 알림을 화면에 띄우고,
 * 알림을 누르면 메일함을 연다. 그게 전부다.
 *
 * ⚠️ 일부러 fetch 를 가로채지 않는다(캐싱 없음). 이 앱은 kanchenjunga.co.kr 회사 사이트와 콘솔을
 *    같은 오리진에서 서빙하므로, 서비스워커가 응답을 캐싱하면 두 화면 모두에 영향을 준다.
 *    푸시만 다루고 네트워크는 건드리지 않는다.
 */

// 알림에 뜨는 KANCHENJUNGA 산 아이콘. 같은 출처(앱에 포함)로 둬서 로딩 실패 없이 확실히 뜨게 한다.
//   ICON  : 알림 큰 아이콘(컬러)
//   BADGE : 안드로이드 상태바 작은 배지(흰 실루엣·투명)
const ICON = '/brand/noti-icon-192.png'
const BADGE = '/brand/noti-badge-96.png'
const MAILBOX_URL = '/console/9f7a3d81/mailbox'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: '새 메일', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || '새 메일'
  const options = {
    body: data.body || '',
    icon: ICON,
    badge: BADGE,
    tag: 'kc-new-mail',
    renotify: true,
    data: { url: data.url || MAILBOX_URL },
  }
  // 홈 화면 앱 아이콘에 안 읽은 개수 배지를 표시(지원 브라우저). 값이 없으면 점만 표시.
  const n = Number(data.badge)
  if (self.navigator && 'setAppBadge' in self.navigator) {
    self.navigator.setAppBadge(Number.isFinite(n) && n > 0 ? n : undefined).catch(() => {})
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || MAILBOX_URL
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // 이미 열린 콘솔 창이 있으면 그 창을 메일함으로 옮겨 포커스한다.
      for (const w of wins) {
        if ('focus' in w) {
          if ('navigate' in w) { try { w.navigate(url) } catch (e) { /* 크로스오리진 등 — 무시 */ } }
          return w.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    }),
  )
})
