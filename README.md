# EXPRISM Admin

> **EXPRISM** — *We express your vision through innovation.*

멀티테넌트 SaaS 의 **내부 직원(플랫폼 관리자) 전용 콘솔**입니다.
백엔드는 [`saas-admin-api`](https://github.com/ChoWonHui/saas-admin-api) (Spring Boot 3.2 / Java 17 / MySQL 5.7).

React 18 + Vite. 화면 개발 규칙은 [`CLAUDE.md`](./CLAUDE.md) 를 따릅니다.

---

## 구성

```text
브라우저 → nginx :8080 ┬─ /       → dist/     (이 저장소의 빌드 결과)
                       └─ /api/*  → :8089     (saas-admin-api)
```

정적 파일과 API 가 **같은 오리진**이라 CORS 설정이 필요 없습니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 :5173 — /api 는 :8089 로 프록시된다 (vite.config.js)
npm run build    # dist/ 생성 → nginx 가 서빙
```

백엔드(:8089)가 떠 있어야 로그인할 수 있습니다.

## 로그인

내부 직원은 이메일이 아니라 **사번**으로 로그인합니다.

```text
사번      260001      ← YY(입사연도) + 4자리 순번. 서버가 채번한다
비밀번호               ← 계정 생성·초기화 시 exprism1234! 로 시작한다
```

**초기 비밀번호로 로그인하면 비밀번호 변경 화면을 벗어날 수 없습니다.** 새 비밀번호로 바꾼 뒤
다시 로그인해야 콘솔을 쓸 수 있습니다. (서버가 강제한다 — 화면만의 제약이 아니다)

## 화면

| 경로 | 내용 |
|---|---|
| `/login` | 사번 로그인 |
| `/password` | 강제 비밀번호 변경 (초기 비밀번호 상태일 때만) |
| `/admins` | 관리자 계정 — 생성 / 수정 / 비밀번호 초기화 / 퇴사처리 |
| `/tenants` | 업체 목록 |

**행 조작은 버튼이 아니라 마우스로 합니다** — 더블클릭은 수정, 우클릭은 메뉴입니다.
자세한 규칙은 [`CLAUDE.md`](./CLAUDE.md) §0 을 보세요.
