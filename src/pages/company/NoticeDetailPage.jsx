import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import SiteShell, { SubHead } from '../../components/company/SiteShell'
import { homeNoticeApi } from '../../api/homeClient'

// 공지 상세(/notice/:id). 관리자 콘솔 > 홈페이지 공지에서 등록한 글을
// /api/public/home-notices/{id} 로 받아 보여준다. 조회수는 서버가 올린다.
function formatDate(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function NoticeDetailPage() {
  const { id } = useParams()
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setNotice(null)
    setError('')
    homeNoticeApi
      .get(id)
      .then((d) => { if (alive) setNotice(d) })
      .catch((e) => { if (alive) setError(e.message || '공지사항을 불러오지 못했습니다.') })
    return () => { alive = false }
  }, [id])

  return (
    <SiteShell solidHeader title={notice?.title ?? '공지사항'}>
      <SubHead title="공지사항" />

      <section className="kc-sec">
        <div className="kc-wrap">
          {error ? (
            <>
              <p className="kc-alert kc-alert-err">{error}</p>
              <Link className="kc-btn kc-btn-primary" to="/notice">목록으로</Link>
            </>
          ) : notice ? (
            <article className="kc-article">
              <div className="kc-notice-top">
                <span className="kc-tag">{notice.categoryLabel}</span>
                {notice.pinned && <span className="kc-tag kc-tag-pin">고정</span>}
              </div>
              <h1 className="kc-article-title">{notice.title}</h1>
              <div className="kc-notice-meta kc-article-meta">
                <span>
                  <span className="material-symbols-outlined">calendar_today</span>
                  {formatDate(notice.publishedAt)}
                </span>
                <span>
                  <span className="material-symbols-outlined">visibility</span>
                  조회수 {notice.viewCount.toLocaleString()}
                </span>
                <span>
                  <span className="material-symbols-outlined">edit</span>
                  {notice.authorName}
                </span>
              </div>
              {/* 본문은 리치에디터 HTML 이라 그대로 렌더한다(서버가 정제해 저장). */}
              <div className="kc-article-body" dangerouslySetInnerHTML={{ __html: notice.content }} />
              <nav className="kc-article-nav">
                {notice.prev ? (
                  <Link className="kc-article-nav-item" to={`/notice/${notice.prev.noticeId}`}>
                    <span className="kc-article-nav-label">이전 글</span>
                    <span className="kc-article-nav-title">{notice.prev.title}</span>
                  </Link>
                ) : (
                  <span className="kc-article-nav-item is-empty">이전 글이 없습니다.</span>
                )}
                {notice.next ? (
                  <Link className="kc-article-nav-item" to={`/notice/${notice.next.noticeId}`}>
                    <span className="kc-article-nav-label">다음 글</span>
                    <span className="kc-article-nav-title">{notice.next.title}</span>
                  </Link>
                ) : (
                  <span className="kc-article-nav-item is-empty">다음 글이 없습니다.</span>
                )}
              </nav>
              <div className="kc-article-actions">
                <Link className="kc-btn kc-btn-primary" to="/notice">목록으로</Link>
              </div>
            </article>
          ) : (
            <p className="kc-sec-desc">불러오는 중입니다.</p>
          )}
        </div>
      </section>

      <section className="kc-cta">
        <div className="kc-cta-inner">
          <h2>더 궁금한 점이 있으신가요?</h2>
          <p>공지에서 다루지 않은 내용도 편하게 물어보세요. 담당자가 확인 후 답변드립니다.</p>
          <Link className="kc-btn kc-btn-primary" to="/contact">
            문의하기
            <span className="material-symbols-outlined">send</span>
          </Link>
        </div>
      </section>
    </SiteShell>
  )
}
