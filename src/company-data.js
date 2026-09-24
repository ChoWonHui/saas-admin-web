/**
 * KANCHENJUNGA 회사 사이트의 콘텐츠.
 *
 * 원본은 D:\kanchenjunga-nodejs\public (정적 HTML) 이다. 그 문구를 그대로 옮겨 왔다.
 * 화면(pages/company/*)과 문구를 분리해 둔다 — 문구는 자주 바뀌고,
 * 바꾸는 사람이 JSX 를 몰라도 되게 하려는 것이다. 여기만 고치면 화면이 따라온다.
 *
 * ⚠️ CONTACT 의 전화번호는 원본이 010-0000-0000 (미입력) 이다. 공개 전에 채울 것.
 */

/* Unsplash CDN 이미지. auto=format 이 브라우저에 맞춰 webp/avif 로 내려 준다. */
const shotTall = (id, w = 1200) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${Math.round(w * 1.25)}&q=75&auto=format&fit=crop`

export const BRAND = {
  // 회사명은 화면 어디서든 영문 KANCHENJUNGA 로 쓴다. "칸첸중가"·"(주)" 는 쓰지 않는다.
  name: 'KANCHENJUNGA',
  // 로고 아래 한 줄. 상단바·탭 제목에 같이 쓴다.
  sub: 'IT CONSULTING',
  subKo: 'IT 컨설팅',
  heroTitle: '미래를 코딩하다,',
  // 히어로 문구는 줄바꿈 위치를 직접 정한다. 화면 폭에 맡기면 "극대화하고," 뒤가 아니라
  // 엉뚱한 곳에서 끊겨 읽는 흐름이 깨진다.
  taglineLines: [
    '혁신적인 IT 솔루션으로 고객의 비즈니스 가치를 극대화하고,',
    '더 나은 내일을 만들어갑니다.',
  ],
}

/* 히어로 오른쪽 사진.
   예전에는 우주에서 본 지구 사진을 배경으로 깔고 그 위에 글을 얹었다.
   IT 회사와 연결이 약한 데다, 글이 사진의 밝은 부분과 겹쳐 잘 읽히지도 않았다.
   지금은 배경이 아니라 오른쪽 칸을 채우는 사진이라 세로로 긴 것을 쓴다. */
BRAND.heroImg = shotTall('photo-1522071820081-009f0129c71c')

// 상단 내비게이션. 원본의 .html 경로를 React 라우트로 바꿨다.
//
// children 이 있으면 상위 메뉴가 되고, 상위 자체에는 to 를 두지 않는다 — 제목 역할만 한다.
// (EXPRISM 관리자 콘솔 Shell.jsx 의 규칙과 같다: "상위에 URL 이 없으면 제목 역할만 한다")
export const NAV = [
  {
    label: '회사정보',
    children: [
      { to: '/company', label: '회사소개' },
      { to: '/company/greeting', label: '대표 인사말' },
      { to: '/company/org', label: '조직도' },
    ],
  },
  {
    label: '사업영역',
    children: [
      { to: '/biz-area/consulting', label: 'IT 컨설팅' },
      // 자사 솔루션. 같은 화면이 exprism.co.kr 루트에도 있지만, 회사 사이트를 보던 사람을
      // 다른 도메인으로 내보내면 흐름이 끊겨 이 도메인 안에서 연다.
      { to: '/exprism', label: 'EXPRISM' },
    ],
  },
  { to: '/design', label: '디자인 시안' },
  { to: '/notice', label: 'NOTICE' },
  { to: '/contact', label: 'CONTACT' },
]

/*
 * exprism.co.kr 전용 메뉴. 제품 홍보 사이트라 회사 메뉴를 싣지 않는다.
 * 회사 소개는 절대 주소로 kanchenjunga.co.kr 에 넘긴다(도메인이 다르므로 라우터가 아니라 링크다).
 */
export const NAV_EXPRISM = [
  { to: '/', label: '제품 소개' },
  // 손님 화면·사장님 화면은 제품 소개 안의 구역이라 헤더에서 뺐다.
  // 본문에는 그대로 있고, 화면 안에서 훑어 내려가며 보게 한다.
  {
    // 이 도메인에서도 그대로 열린다. 같은 빌드라 라우트가 이미 있고,
    // 다른 도메인으로 넘기면 보던 사이트를 벗어나게 되어 흐름이 끊긴다.
    label: '회사정보',
    children: [
      { to: '/company', label: '회사소개' },
      { to: '/company/greeting', label: '대표 인사말' },
      { to: '/company/org', label: '조직도' },
    ],
  },
  { to: '/contact', label: '도입 문의' },
]

/** 푸터·검색처럼 계층이 필요 없는 곳에서 쓸 평평한 목록. */
export const NAV_FLAT = NAV.flatMap((n) => (n.children ? n.children : [n]))

export const CONTACT = {
  // 주소는 한 곳에서만 관리한다 — 푸터·오시는 길·지도 검색이 모두 이 값을 쓴다.
  address: '서울특별시 마포구 월드컵북로 50길 6-10',
  company: 'KANCHENJUNGA',
  phone: '010-0000-0000',
  email: 'contact@kanchenjunga.co.kr',
  // 사업자등록번호. 국내 사업자 사이트는 표기 의무가 있어 푸터에 넣는다.
  bizNo: '515-31-02197',
  // 대표자 성명. GREETING.name 과 같은 사람이지만, 푸터는 인사말 없이도 떠야 하므로 여기 둔다.
  ceo: '조성호',
}

/* ===== 메인(/) ===== */

// 원본 index.html 의 사업분야 카드 3장.
// 이미지는 원본이 구글 드라이브 썸네일을 썼는데, 장당 464~726KB PNG 라 첫 화면이 느리다.
// 같은 주제의 Unsplash CDN 이미지로 바꿨다 — 상업적 이용 무료(unsplash.com/license),
// auto=format 이 브라우저에 맞춰 webp/avif 로 내려 준다. 자체 사진이 생기면 url 만 바꾸면 된다.
const shot = (id, w = 800) => `https://images.unsplash.com/${id}?w=${w}&q=75&auto=format&fit=crop`

export const HOME_SERVICES = [
  {
    id: 'build',
    icon: 'design_services',
    tag: '기획부터',
    to: '/biz-area/consulting',
    title: '홈페이지 제작',
    desc:
      '무엇을 만들지 정하는 자리부터 함께 앉습니다. 기획과 디자인, 개발을 한 팀이 이어서 ' +
      '진행하므로 단계가 넘어갈 때마다 처음 목적을 다시 설명하지 않아도 됩니다.',
    img: shot('photo-1547658719-da2b51169166'),
    img2x: shot('photo-1547658719-da2b51169166', 1600),
    alt: '화면 설계도를 앞에 두고 홈페이지 구조를 논의하는 모습',
  },
  {
    id: 'maintain',
    icon: 'build',
    tag: '이어받아',
    to: '/biz-area/consulting',
    title: '시스템 유지보수',
    desc:
      '이미 쓰고 계신 시스템을 넘겨받아 돌봅니다. 만든 곳과 연락이 끊겼거나 손볼 사람이 없어 ' +
      '멈춰 있는 서비스도 소스와 서버를 인수인계받아 이어갑니다.',
    img: shot('photo-1518770660439-4636190af475'),
    img2x: shot('photo-1518770660439-4636190af475', 1600),
    alt: '서버와 코드를 점검하는 모습',
  },
  {
    id: 'consulting',
    icon: 'lightbulb',
    tag: '무엇부터',
    to: '/biz-area/consulting',
    title: 'IT 컨설팅',
    desc:
      '무엇부터 손대야 할지 모르겠다면 그 정리부터 돕습니다. 지금 상황을 듣고 필요한 만큼만 ' +
      '단순하게 제안합니다. 쓰지 않을 기능은 뺍니다.',
    img: shot('photo-1557804506-669a67965ba0'),
    img2x: shot('photo-1557804506-669a67965ba0', 1600),
    alt: '화이트보드를 놓고 전략을 논의하는 컨설팅 회의',
  },
]

/*
 * 자사 솔루션. 수주 업무와 성격이 달라 사업분야 카드에 섞지 않고 따로 띄운다.
 * 소개는 제품 사이트(exprism.co.kr)가 맡고, 여기서는 "우리가 만들고 운영한다" 만 말한다.
 */
export const HOME_PRODUCT = {
  name: 'EXPRISM',
  title: '외식 매장을 위한 자사 솔루션, EXPRISM',
  desc:
    '수주 업무만 하지 않습니다. 손님이 테이블 QR 로 주문하고 사장님이 자리와 매출을 한 화면에서 ' +
    '보는 외식 매장용 솔루션을 직접 만들어 운영하고 있습니다. 개발부터 유지보수까지 저희가 합니다.',
  to: 'https://www.exprism.co.kr',
  // 이미지는 이미지 서버(S3+CloudFront)에서 받는다 — 앱에 정적 파일로 박지 않는다.
  img: 'https://d2ziky4ycezd5d.cloudfront.net/saas-admin/brand/kanchenjunga/order-table.jpg',
  alt: 'EXPRISM 테이블 주문 화면. 가게 이름과 자리 번호, 메뉴가 보인다.',
}

export const HOME_CTA = {
  title: '만드는 일과 돌보는 일을 함께 합니다',
  desc:
    '새로 만드는 것도, 이미 쓰고 계신 것을 고쳐 쓰는 것도 맡습니다. 한 번 만들고 떠나지 않고 ' +
    '넘겨받아 이어갈 수 있는 구조로 짓습니다.',
}

/* ===== EXPRISM 제품 소개(exprism.co.kr) ===== */

/*
 * 화면 사진은 운영 중인 주문앱을 실제로 캡쳐한 것이다(public/exprism/*.jpg).
 * 기능 설명도 코드에서 확인한 것만 적는다. 없는 기능을 적지 않는다.
 */
export const EXPRISM = {
  // 회사가 스스로를 어떻게 부르는가. 히어로 맨 윗줄에 들어간다.
  eyebrow: '외식산업의 디지털 전환을 선도하는 기업',
  lead: '테이블 QR 을 찍으면 메뉴가 열리고, 고른 대로 주방에 바로 전달됩니다. 앱 설치도 회원가입도 없습니다.',

  // 히어로 바로 아래에 한 문장으로 세우는 선언.
  statement: '외식산업의 디지털 전환은 이제 선택이 아닌 필수 사항입니다',
  statementSub: '주문을 받고, 메뉴를 바꾸고, 매출을 확인하는 일이 모두 한 화면에서 끝납니다. EXPRISM 은 그 전환을 가장 빠르게 시작하는 방법입니다.',

  // 손님이 보는 화면. 세 장 모두 실제 캡쳐다.
  guest: [
    {
      img: '/exprism/store-landing.jpg',
      alt: '가게 홈 화면. 가게를 그림으로 꾸민 공간과 영업시간, 연락처, 주소가 보인다.',
      title: '가게를 소개하는 홈',
      desc: '영업시간과 브레이크타임, 연락처를 함께 보여줍니다. 가게 공간은 직접 꾸밀 수 있습니다.',
    },
    {
      img: '/exprism/order-table.jpg',
      alt: '테이블 QR 로 연 주문 화면. 가게 이름과 자리 번호, 메뉴 목록이 보인다.',
      title: '자리에서 바로 주문',
      desc: '자리 번호가 화면 위에 뜹니다. 직원을 부르지 않아도 주문이 주방으로 갑니다.',
    },
    {
      img: '/exprism/takeout.jpg',
      alt: '포장 주문 화면. 상단에 포장 주문 표시가 있고 같은 메뉴판이 열려 있다.',
      title: '포장도 같은 방식으로',
      desc: '포장 전용 QR 을 따로 둡니다. 손님은 같은 화면에서 고르고 결제까지 마칩니다.',
    },
  ],

  // 업체 콘솔 화면. 넷 다 실제로 로그인해 캡쳐한 것이다.
  // 헤더에 뜨던 계정 이메일은 캡쳐 전에 지웠다.
  ownerShots: [
    {
      img: '/exprism/own-tables.jpg',
      alt: '휴대폰으로 연 테이블 관리 화면. 총 테이블 15, 운영 층수 3층, 평균 좌석 6.9명, 포장 가능이 보인다.',
      title: '자리를 실제 모양대로 배치합니다',
      desc: '층을 나눠 테이블을 끌어다 놓고 저장하면 자리마다 주문용 QR 이 갱신됩니다. 포장 주문을 함께 받을지도 여기서 정합니다.',
    },
    {
      img: '/exprism/own-menu.jpg',
      alt: '휴대폰으로 연 메뉴판 관리 화면. 메인, 사이드, 음료 분류가 보인다.',
      title: '메뉴는 분류와 옵션까지',
      desc: '분류를 만들고 메뉴에 가격, 사진, 옵션을 붙입니다. 품절로 바꾸면 손님 화면에 바로 반영됩니다.',
    },
    {
      img: '/exprism/own-home.jpg',
      alt: '휴대폰으로 연 스토어 디자인 화면. 벽지와 바닥을 고르고 가구를 배치한다.',
      title: '가게 홈을 직접 꾸밉니다',
      desc: '벽지와 바닥을 고르고 가구를 놓으면 손님이 보는 가게 페이지가 그대로 바뀝니다.',
    },
    {
      img: '/exprism/own-stats.jpg',
      alt: '휴대폰으로 연 매출 통계 화면. 오늘, 최근 7일, 이번 달, 기간별 집계 탭이 있다.',
      title: '매출은 기간을 골라 봅니다',
      desc: '결제가 끝난 주문만 집계합니다. 취소 건은 빠집니다.',
    },
  ],

  // 화면으로 보여주지 않는 나머지 기능. 목록으로만 짧게 적는다.
  ownerMore: [
    { title: '주문 관리', desc: '결제·접수, 조리, 서빙 완료, 종료까지 상태를 넘기며 진행합니다. 새 주문은 실시간으로 알립니다.' },
    { title: '예약과 대기', desc: '미리 오는 손님은 예약으로 받고, 자리가 차면 대기표를 발급합니다.' },
    { title: '직원 계정', desc: '홀과 주방 직원의 로그인 계정을 만들고 역할과 상태를 관리합니다.' },
    { title: '공지와 문의', desc: '가게 공지를 올리고, 운영 문의는 관리자와 화면 안에서 주고받습니다.' },
  ],

  // i18n.js 가 실제로 담고 있는 다섯 언어.
  languages: ['한국어', 'English', '日本語', '中文', 'Español'],
}

/* ===== 회사소개(/company) ===== */

export const ABOUT = {
  title: 'KANCHENJUNGA: 미래를 선도하는 기술 혁신 파트너',
  // 설립 시점은 언급하지 않는다 — 아직 얼마 되지 않아 강조할 근거가 못 된다.
  // 대신 무엇을 어떻게 하는 회사인지로 채운다.
  paragraphs: [
    'KANCHENJUNGA는 끊임없는 기술 개발과 혁신을 통해 IT 산업의 새로운 기준을 제시하고 있습니다. 고객의 비즈니스 성장을 최우선 가치로 삼고, 최첨단 기술과 전문성을 바탕으로 맞춤형 IT 솔루션을 제공합니다.',
    '우리는 인간과 기술의 조화를 통해 더 나은 미래를 만들어가고자 합니다. KANCHENJUNGA의 도전과 혁신은 멈추지 않을 것입니다.',
  ],
  img: shot('photo-1497366754035-f200968a6e72', 1200),
  alt: 'KANCHENJUNGA 사무실의 회의 공간',
}

/* ===== 대표 인사말(/company/greeting) ===== */

// ⚠️ paragraphs 와 lead 는 아직 임시로 작성한 문구다. 원본 사이트에 없던 페이지라
//    참고할 글이 없었다 — 대표님 실제 표현으로 교체할 것. (서명·성함은 확인 완료)
export const GREETING = {
  lead: '고객의 문제를 끝까지 책임지는 회사가 되겠습니다.',
  paragraphs: [
    // "웹 서비스를 찾아주신" 은 어색해서 단어를 뺐다. 방문 인사에는 회사명만으로 충분하다.
    '안녕하십니까. KANCHENJUNGA를 찾아주신 여러분께 진심으로 감사드립니다.',
    '저희는 기술이 그 자체로 목적이 되어서는 안 된다고 믿습니다. 아무리 앞선 기술이라도 고객의 업무를 편하게 만들지 못한다면 의미가 없습니다. 그래서 저희는 무엇을 만들지 정하는 단계부터 고객과 함께 앉습니다.',
    '기획과 디자인, 개발과 보안을 한 팀 안에서 함께 보는 것도 같은 이유입니다. 단계마다 담당이 바뀌면 처음의 목적이 흐려지고, 그 부담은 결국 고객이 지게 됩니다. 저희는 시작부터 이관까지 한 팀이 끝까지 함께합니다.',
    '넘겨받아 이어갈 수 있는 결과물을 만들겠습니다. 저희가 떠난 뒤에도 다른 사람이 읽고 고칠 수 있어야 진짜 완성이라고 생각합니다. 그 약속을 지키는 회사가 되겠습니다.',
  ],
  sign: 'KANCHENJUNGA 대표이사',
  name: '조성호',
  // 대표이사 사진. 원본(2MB PNG, 1402x1122)을 900px 폭 JPEG(84KB)로 줄여 public/ 에 두었다 —
  // 화면에서 400px 로 쓰므로 900px 면 고해상도 화면에서도 충분하다.
  // 대표이사 사진도 이미지 서버(S3+CloudFront)에서 받는다.
  img: 'https://d2ziky4ycezd5d.cloudfront.net/saas-admin/brand/kanchenjunga/ceo.jpg',
  alt: '집무실에서 업무 중인 조성호 대표이사',

  // 대표이사 이력. 받은 순서를 그대로 둔다(前/現 을 따로 묶지 않았다).
  //  - when 이 비면 배지 없이 항목만 나온다 — 학위처럼 재직 여부가 없는 줄에 쓴다.
  //  - text 를 배열로 주면 그 지점에서 줄을 바꾸고 둘째 줄부터 들여쓴다.
  //    이름이 긴 기관은 자동 줄바꿈에 맡기면 끝 글자 하나만 넘어가 보기 나쁘다.
  career: [
    { when: '', text: '세종대학교 경영학 박사' },
    { when: '前', text: '신안산대학교 교수' },
    { when: '現', text: '김포대학교 교수' },
    { when: '前', text: '김포대학교 대학일자리플러스 센터장' },
    { when: '前', text: '김포대학교 산학협력단장' },
    { when: '現', text: ['인천 강화군 어린이·', '사회복지급식관리지원센터장'] },
  ],
}

// 대표이사 관련 보도. 기사 본문은 옮기지 않고 원문으로 링크만 건다
// (언론사에 저작권이 있어 전재·재배포가 금지되어 있다).
// 최신순으로 둔다.
export const PRESS = [
  {
    title: '김포대, 미래교육혁신지원체계 구축 워크숍 개최',
    outlet: 'NSP통신',
    date: '2023.12.19',
    url: 'https://www.nspna.com/country/?mode=view&newsid=673792',
  },
  {
    title: '김포시정신건강복지센터, 김포대학교와 청년 정신건강증진 업무협약 체결',
    outlet: '김포신문',
    date: '2022.08.24',
    url: 'https://www.igimpo.com/news/articleView.html?idxno=72145',
  },
  {
    title: "김포大, 취·창업지원 '자격증 챌린지' 운영",
    outlet: '씨티21',
    date: '2021.07.20',
    // 이 언론사는 https 인증서가 만료돼 있어 http 로 연결한다.
    // 링크(내비게이션)라서 혼합 콘텐츠 차단 대상이 아니다 — 페이지 안에 불러오는 리소스가 아니다.
    url: 'http://www.city21.co.kr/news/articleView.html?idxno=35022',
  },
]

/* ===== 조직도(/company/org) ===== */

// ⚠️ 실제 조직 구성을 받지 못해 사업영역(BIZ_SERVICES)을 기준으로 임시 구성했다.
//    본부·팀 이름과 개수를 실제 조직으로 반드시 교체할 것.
//    divisions 를 늘리거나 줄여도 연결선은 자동으로 맞는다(company.css 의 .kc-org-div 주석 참조).
export const ORG = {
  // 조직도에는 직위만 둔다 — 사람 이름은 대표 인사말에서 밝힌다.
  head: { title: '대표이사' },
  // 대표이사 직속 조직. 없으면 빈 배열로 두면 화면에서 사라진다.
  staff: [{ name: '경영지원팀', desc: '인사 · 총무 · 재무' }],
  divisions: [
    {
      id: 'consulting',
      icon: 'model_training',
      name: '컨설팅본부',
      teams: ['IT전략팀', 'PI컨설팅팀'],
    },
    {
      id: 'dev',
      icon: 'developer_mode',
      name: '개발본부',
      teams: ['소프트웨어개발팀', 'UX디자인팀'],
    },
    {
      id: 'infra',
      icon: 'cloud_queue',
      name: '인프라본부',
      teams: ['클라우드팀', '네트워크팀'],
    },
    {
      id: 'security',
      icon: 'security',
      name: '보안본부',
      teams: ['정보보안팀', '기술지원팀'],
    },
  ],
}

export const VISION = [
  {
    icon: 'visibility',
    title: '비전 (Vision)',
    desc: '기술 혁신을 통해 사회 발전에 기여하고, 글로벌 IT 시장을 선도하는 기업이 된다.',
  },
  {
    icon: 'rocket_launch',
    title: '미션 (Mission)',
    desc: '최고의 IT 솔루션과 서비스를 제공하여 고객의 성공적인 디지털 전환을 지원하고, 지속 가능한 가치를 창출한다.',
  },
]

// 연혁(발자취)은 두지 않는다. 설립한 지 얼마 되지 않아 채울 내용이 없고,
// 비어 있는 연표는 오히려 회사가 작다는 인상만 준다.
// 쌓이면 여기에 배열을 만들고 AboutPage 에 섹션을 되살리면 된다.

// "숫자로 보는 KANCHENJUNGA"(성공 프로젝트·성장률 등 지표) 섹션은 뺐다.
// 뒷받침할 실적이 아직 없는 수치라 그대로 두면 사실과 다른 인상을 준다.
// 실제 수치가 쌓이면 배열을 만들고 AboutPage 에 섹션을 되살리면 된다.

/* ===== 사업영역(/biz-area) ===== */

export const BIZ_SERVICES = [
  {
    id: 'cloud',
    icon: 'cloud_queue',
    title: '클라우드 솔루션',
    desc: '안정적이고 유연한 클라우드 인프라 구축 및 운영, 마이그레이션 컨설팅을 제공하여 비즈니스 연속성을 보장합니다.',
    items: ['AWS, Azure, GCP 기반 컨설팅', 'DevOps 및 자동화 시스템 구축', '클라우드 보안 및 모니터링'],
  },
  {
    id: 'network',
    icon: 'lan',
    title: '네트워크 통합',
    desc: '최신 기술을 활용한 효율적인 네트워크 설계, 구축, 유지보수를 통해 기업의 디지털 전환을 가속화합니다.',
    items: ['유/무선 네트워크 솔루션', '네트워크 보안 및 관제', 'SD-WAN 및 차세대 네트워크'],
  },
  {
    id: 'security',
    icon: 'security',
    title: '정보 보안',
    desc: '기업의 중요 자산을 보호하기 위한 종합적인 정보보안 컨설팅 및 솔루션 구축, 관제 서비스를 제공합니다.',
    items: ['보안 취약점 분석 및 모의 해킹', '통합 보안 관제 시스템 (SIEM)', '개인정보보호 솔루션'],
  },
  {
    id: 'software',
    icon: 'developer_mode',
    title: '소프트웨어 개발',
    desc: '고객의 요구사항에 맞춘 웹/앱 서비스, 업무 자동화 시스템 등 맞춤형 소프트웨어를 개발하고 공급합니다.',
    items: ['Web/Mobile App 개발', '업무 자동화 (RPA) 솔루션', 'AI/Big Data 기반 분석 플랫폼'],
  },
  {
    id: 'consulting',
    icon: 'model_training',
    title: 'IT 컨설팅',
    desc: '다년간의 경험과 전문 지식을 바탕으로 기업의 IT 전략 수립, 시스템 최적화 등 맞춤형 컨설팅을 제공합니다.',
    items: ['IT 전략 및 로드맵 수립', '프로세스 혁신 (PI) 컨설팅', '디지털 전환 전략 컨설팅'],
  },
  {
    id: 'support',
    icon: 'support_agent',
    title: '기술 지원 및 유지보수',
    desc: 'IT 시스템의 안정적인 운영을 위한 24/7 기술 지원 및 유지보수 서비스를 제공하여 고객 만족을 극대화합니다.',
    items: ['원격/방문 기술 지원', '시스템 장애 예방 및 복구', '정기 점검 및 성능 최적화'],
  },
]

/* ===== IT 컨설팅(/biz-area/consulting) ===== */

export const CONSULTING = {
  lead: '기획부터 개발까지, 한 팀이 한 번에',
  paragraphs: [
    '보통은 기획사에 맡기고, 디자인은 따로 구하고, 개발은 또 다른 곳을 찾습니다. 단계가 넘어갈 때마다 처음의 목적을 다시 설명해야 하고, 그 사이에 일정과 비용이 늘어납니다.',
    'KANCHENJUNGA는 기획·디자인·개발을 한 팀 안에서 함께 봅니다. 한 번 이야기하면 끝까지 갑니다.',
    '그리고 필요 이상으로 복잡하게 만들지 않습니다. 쓰지 않을 기능은 빼고, 나중에 다른 사람이 넘겨받아 고칠 수 있는 구조로 짓습니다.',
  ],
  img: shot('photo-1487338875411-8880f74114a2', 1200),
  alt: '화면 시안과 디자인 도구가 떠 있는 작업용 모니터',

  // 두 가지 축 — 새로 만드는 일과 이미 있는 것을 돌보는 일.
  tracks: [
    {
      id: 'new',
      icon: 'add_circle',
      title: '웹 서비스 신규 제작',
      desc: '무엇을 만들지 정하는 것부터 같이 합니다. 기획안이 없어도 괜찮습니다.',
      items: ['요구사항 정리 · 화면 설계', '브랜드에 맞는 UI 디자인', '반응형 웹 · 모바일 대응', '도메인 · 서버 · 배포까지 설정'],
    },
    {
      id: 'maintain',
      icon: 'build',
      title: '기존 서비스 유지보수',
      desc: '만든 곳과 연락이 끊겼거나, 손볼 사람이 없어 방치된 서비스도 맡습니다.',
      items: ['소스 인수인계 · 현황 점검', '오류 수정 · 기능 추가', '보안 취약점 조치', '정기 점검 · 속도 개선'],
    },
  ],

  steps: [
    { no: '01', title: '듣기', desc: '지금 무엇이 불편한지부터 듣습니다. 정리된 기획안이 없어도 됩니다.' },
    { no: '02', title: '정하기', desc: '만들 범위와 일정, 비용을 문서로 확정합니다. 여기서 합의한 것만 만듭니다.' },
    { no: '03', title: '만들기', desc: '중간중간 동작하는 화면을 보여드립니다. 다 만든 뒤 처음 보는 일은 없습니다.' },
    { no: '04', title: '넘기기', desc: '소스와 계정, 배포 절차까지 정리해 드립니다. 계속 저희에게 맡기지 않아도 됩니다.' },
  ],

  fits: [
    '웹 서비스가 없거나, 몇 년째 그대로인 경우',
    '만든 업체와 연락이 닿지 않아 수정을 못 하는 경우',
    '견적을 받아봤는데 무엇에 얼마인지 이해가 안 되는 경우',
    '기능이 너무 많아 정작 쓰는 건 몇 개 안 되는 경우',
  ],
}

// 산업별 솔루션. 원본은 이미지와 글을 좌우로 번갈아 배치했다 — reverse 로 그 순서를 표현한다.
export const INDUSTRIES = [
  {
    id: 'lms',
    icon: 'computer',
    title: 'LMS 시스템',
    en: 'Learning Management System',
    desc: '온라인 학습 과정 운영, 학습자 진도 및 성취도 추적, 콘텐츠 관리 등 통합적인 학습 관리 기능을 제공하여 효율적인 교육 환경을 지원합니다.',
    items: ['온라인 강의 및 학습 자료 관리', '학습자 진도/성취도 추적', '시험·과제 관리 및 평가'],
    img: shot('photo-1503676260728-1c00da094a0b', 1200),
    alt: '온라인 학습 화면이 열린 노트북',
    reverse: false,
  },
  {
    id: 'erp',
    icon: 'business',
    title: 'ERP 시스템',
    en: 'Enterprise Resource Planning',
    desc: '전사적 자원 관리를 통합하여 생산, 재무, 인사, 물류 등 다양한 업무 프로세스를 효율적으로 운영할 수 있도록 지원합니다. 실시간 데이터 분석과 자동화를 통해 의사결정 속도를 높이고, 운영 효율성과 경쟁력을 강화합니다.',
    items: ['생산·물류·재고 관리 통합', '재무·회계 프로세스 자동화', '인사·급여·근태 관리 시스템'],
    img: shot('photo-1460925895917-afdab827c52f', 1200),
    alt: '경영 지표가 표시된 대시보드 화면',
    reverse: true,
  },
  {
    id: 'emr',
    icon: 'medical_services',
    title: 'EMR 시스템',
    en: 'Electronic Medical Records',
    desc: '환자의 진료 기록, 검사 결과, 처방 이력 등을 통합 관리하여 의료진 간 신속한 정보 공유와 정확한 진료를 지원합니다. 보안 강화와 법규 준수를 통해 안전하고 효율적인 의료 데이터 환경을 제공합니다.',
    items: ['실시간 환자 진료 기록 관리', '진단·처방·검사 데이터 통합', '의료정보 보안 및 접근 권한 제어'],
    img: shot('photo-1516549655169-df83a0774514', 1200),
    alt: '의료 데이터를 확인하는 병원 업무 환경',
    reverse: false,
  },
]

export const TECH_STACK = [
  { id: 'frontend', label: '프론트엔드', items: ['React', 'Vue.js', 'Angular', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3', 'Tailwind CSS'] },
  { id: 'backend', label: '백엔드', items: ['Java', 'Spring', 'Node.js', 'Python', 'PHP', 'Ruby', 'Go', 'C#'] },
  { id: 'database', label: '데이터베이스', items: ['MySQL', 'PostgreSQL', 'Oracle', 'MongoDB', 'Redis'] },
  { id: 'infra', label: '인프라 · DevOps', items: ['AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Jenkins'] },
]

/* ===== 공지사항(/notice) ===== */

// 공지사항은 더 이상 여기 두지 않는다 (2026-09-11).
// 관리자 콘솔 > 홈페이지 공지에서 등록하고, 화면은 /api/public/home-notices 로 받아 온다.
// 예전에 있던 고정 배열은 2023년 샘플이라 그대로 노출되고 있었다.

/* ===== 문의(/contact) ===== */

export const EMAIL_DOMAINS = ['@naver.com', '@gmail.com', '@daum.net', '@kakao.com']

/*
 * EXPRISM 도입 문의에서 묻는 것들.
 *
 * 회사 사이트의 "프로젝트 문의" 와 묻는 내용이 다르다. 가게 사장님은 제목을 짓기보다
 * 매장 사정을 알려 주기를 원하고, 우리는 규모와 시기를 알아야 안내할 수 있다.
 * 그래서 제목·본문 대신 매장 정보를 항목으로 받는다.
 */
export const EXPRISM_LEAD = {
  sizes: ['10석 이하', '11~30석', '31~50석', '51석 이상', '아직 모르겠습니다'],
  timings: ['최대한 빨리', '1개월 안', '3개월 안', '우선 알아보는 중'],
  interests: ['테이블 주문', '포장 주문', '예약과 대기', '메뉴판 자동 번역', '매출 통계', '가게 소개 홈'],
}
