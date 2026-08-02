import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 개발 중에는 Vite 가 /api 를 백엔드로 넘겨준다.
// nginx 도 같은 경로(/api)를 백엔드로 프록시하므로, 프론트 코드에는 호스트가 등장하지 않는다.
// → 개발/운영에서 코드가 동일하고, 같은 오리진이라 CORS 설정이 필요 없다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8089',
        changeOrigin: true,
      },
      // 관리자 실시간 알림 웹소켓 — 백엔드로 업그레이드 프록시.
      '/ws': {
        target: 'ws://localhost:8089',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
