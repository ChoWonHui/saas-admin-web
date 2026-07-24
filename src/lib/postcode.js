// 다음(카카오) 우편번호 서비스 연동.
// 클릭 시 팝업이 떠서 주소를 검색·선택하면 { zonecode(우편번호), address(도로명/지번) } 를 돌려준다.
// 스크립트는 최초 1회만 CDN 에서 로드하고 이후 재사용한다.

const SCRIPT_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

let loading = null

function loadScript() {
  if (window.daum && window.daum.Postcode) return Promise.resolve()
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => { loading = null; reject(new Error('우편번호 서비스를 불러오지 못했습니다.')) }
      document.head.appendChild(s)
    })
  }
  return loading
}

/** 팝업이 뜨기 전 지연을 줄이려 미리 스크립트를 받아둔다(모달 열릴 때 호출). */
export function preloadPostcode() {
  loadScript().catch(() => {})
}

/**
 * 우편번호 검색 팝업을 연다.
 * @param onComplete ({ zonecode, address }) => void — 주소 선택 시 호출
 * @param onError (Error) => void — 스크립트 로드 실패 시
 */
export function openPostcode(onComplete, onError) {
  loadScript()
    .then(() => {
      new window.daum.Postcode({
        oncomplete: (data) => {
          const address = data.roadAddress || data.jibunAddress || data.address || ''
          onComplete({ zonecode: data.zonecode || '', address })
        },
      }).open()
    })
    .catch((e) => { if (onError) onError(e) })
}
