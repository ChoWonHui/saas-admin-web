# EXPRISM Admin (saas-admin-web) — 화면 개발 규칙

> **EXPRISM** — *We express your vision through innovation.*

관리자 콘솔. React 18 + Vite. 백엔드는 `../saas-admin-api` (Spring Boot, :8089).

**브랜드 표기 규칙**: 워드마크는 항상 **대문자 `EXPRISM`** (`.wordmark` — 자간 0.14em).
"SaaS 관리자" 같은 옛 이름을 새로 쓰지 않는다. 상단바는 `EXPRISM Admin`, 브라우저 탭도 `EXPRISM Admin`.
슬로건은 로그인 화면에만 둔다 — 매 화면에 반복하지 않는다.
빌드 결과(`dist/`)는 nginx 가 서빙하고 `/api/*` 는 백엔드로 프록시된다 → **같은 오리진이라 CORS 설정이 없다.**

```powershell
npm run dev                      # 개발 (:5173, HMR). /api 는 :8089 로 프록시
npm run build                    # dist/ 생성
..\tools\nginx.ps1 reload        # nginx 에 반영 (http://localhost:8080)
```

---

## 0. 🚨 모든 목록 화면은 이 틀을 따른다

**새 화면을 만들 때 이 규칙을 벗어나지 않는다.** 화면마다 조작 방식이 다르면 사용자가 매번 다시 배워야 한다.
기준 구현은 [`src/pages/AdminsPage.jsx`](./src/pages/AdminsPage.jsx) 다. **새 목록 화면은 이 파일을 복사해서 시작한다.**

### 0-1. 레이아웃

```jsx
<Shell>                       {/* 상단바 + 내비게이션. 로그인 후 모든 화면이 이걸 쓴다 */}
  <div className="page-head">
    <h2>제목</h2>
    <span className="count">{총건수}명</span>
    <div className="page-actions">…필터·추가 버튼…</div>
  </div>
  {error && <p className="alert">{error}</p>}
  <div className="table-wrap"><table className="table">…</table></div>
</Shell>
```

### 0-2. 그리드(표)

| 규칙 | 이유 |
|---|---|
| **모든 셀은 `white-space: nowrap`** (`.table` 에 이미 적용) | 창이 좁아지면 열이 글자 하나 폭까지 줄어 "연 / 락 / 처" 로 쪼개진다 |
| **표는 `.table-wrap`(overflow-x) 으로 감싼다** | 넘칠 때 표 안에서만 가로 스크롤한다. **페이지 전체가 밀리면 안 된다** |
| 남는 공간을 흡수할 열 하나에 `className="col-grow"` | 넓은 화면에서 표가 왼쪽에 몰려 보이지 않게 |
| **"관리" 컬럼(버튼 열)을 만들지 않는다** | 조작은 더블클릭·우클릭으로 한다 (아래) |
| `min-width: max-content` 를 쓰지 말 것 | 넓은 화면에서도 불필요한 가로 스크롤이 생긴다. 실제로 겪었다 |

### 0-3. 행 조작 — 버튼이 아니라 마우스로

```
더블클릭  →  수정 창
우클릭    →  컨텍스트 메뉴 (수정 / 비밀번호 재설정 / 퇴사처리 …)
```

- 메뉴는 **바깥 클릭 · Esc · 스크롤** 시 닫는다. 스크롤에도 닫는 이유는, 안 닫으면 메뉴만 화면에 붙박여 엉뚱한 행을 가리키기 때문이다.
- 파괴적 항목(퇴사처리·삭제)은 `className="danger"` 로 빨갛게 둔다.
- **이미 삭제(퇴사)된 행은 더블클릭·우클릭이 열리지 않는다.** 할 수 있는 게 없다.

### 0-4. 파괴적 동작은 확인창을 거친다

`window.confirm` 을 쓰지 않는다. 브라우저 기본 대화상자는 스타일이 다르고, 자동화 테스트를 막는다.
**`<Modal>` 로 만든 확인창**을 쓰고, 문구에 **대상을 반드시 명시**한다.

```
제목:  퇴사처리
본문:  260006 홍길동님을 퇴사처리 하시겠습니까?     ← 사번 + 이름을 그대로 보여준다
설명:  계정 기록은 남지만 로그인할 수 없게 되고, 발급된 토큰도 즉시 폐기됩니다.
버튼:  [취소]  [퇴사처리(빨강)]
```

### 0-5. 용어

| 쓰는 말 | 쓰지 않는 말 |
|---|---|
| 퇴사처리 | 삭제 |
| 재직 / 중지 / 잠김 | ACTIVE / DISABLED / LOCKED (화면에 영문 상태를 그대로 노출하지 않는다) |
| 퇴사자 포함 | 삭제된 계정 포함 |

**백엔드 에러 메시지도 같은 용어를 쓴다** (`ErrorCode.java`). 화면과 서버가 다른 말을 하면 안 된다.

---

## 1. 데이터 — 서버 응답을 가정하지 말 것

**목록 API 는 배열이 아니라 Spring `Page` 를 준다.** 실제로 이걸 배열로 가정했다가 목록이 0건으로 나왔다.

```js
const page = await adminApi.list()
page.content        // ← 목록은 여기 있다
page.totalElements  // ← 건수는 여기
```

---

## 2. 인증 — 관리자는 사번으로 로그인한다

이 콘솔은 **내부 직원 전용**이다. 이메일이 아니라 **사번(260001)** 으로 로그인한다.

```js
POST /api/auth/admin/login   { empNo, password }   // 관리자 (이 콘솔)
POST /api/auth/login         { email, password }   // 업체 사용자 — 이 콘솔에서 쓰지 않는다
```

- 관리자를 가리키는 키는 **사번**이다. API 경로도 `/api/platform-admin/admins/260002` 처럼 사번을 쓴다.
- 토큰 보관·자동 재발급은 [`src/api/client.js`](./src/api/client.js) 한 곳에서만 한다. **화면에서 fetch 를 직접 부르지 않는다.**
- 401 이면 client 가 리프레시로 한 번 되살리고, 그래도 안 되면 토큰을 비운다 → `RequireAuth` 가 로그인 화면으로 보낸다.

---

## 3. 에러 표시

백엔드는 `{ code, message, fieldErrors }` 를 준다. **서버 메시지를 그대로 보여준다.**
프론트에서 문구를 새로 지어내지 않는다 — "마지막으로 남은 관리자는 퇴사처리할 수 없습니다" 같은
규칙은 서버만 알고 있고, 그 이유를 사용자에게 정확히 전달해야 한다.

```jsx
catch (e) { setError(e.message) }   // ApiError.message = 서버의 message
{error && <p className="alert">{error}</p>}
```

---

## 4. 스타일

`src/index.css` 하나에 다 있다. CSS 프레임워크를 도입하지 않는다.
색·간격은 `:root` 의 CSS 변수를 쓰고, 새 색을 즉흥적으로 만들지 않는다.

| 클래스 | 용도 |
|---|---|
| `.table` / `.table-wrap` / `.col-grow` | 그리드 (§0-2) |
| `.context-menu` / `.context-menu li.danger` | 우클릭 메뉴 (§0-3) |
| `.modal` / `.modal-backdrop` / `.dialog-actions` | 모달·확인창 (§0-4) |
| `.badge-active` / `.badge-suspended` / `.badge-disabled` | 상태 배지 |
| `.alert` | 에러 |
| `.btn-primary` / `.btn-ghost` / `.btn-danger-solid` | 버튼 |

---

## 5. 검증 — 화면은 브라우저로 확인한다

빌드가 통과한 것은 "동작한다"가 아니다. **Playwright 로 실제 흐름을 밟아 확인한다.**
목록 화면이면 최소한 이만큼:

```text
로그인 → 목록이 실제 건수로 그려지는가
더블클릭 → 수정 창이 뜨는가
우클릭 → 메뉴가 뜨는가
파괴적 동작 → 확인창 문구에 대상이 찍히는가 → 실행 후 목록에서 사라지는가
서버가 막는 경우(자기 자신 퇴사처리 등) → 그 이유가 화면에 뜨는가
콘솔 에러 0
좁은 창(785px) → 헤더가 세로로 쪼개지지 않는가, 페이지가 가로로 밀리지 않는가
```
