import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SiteShell, { SubHead, SecHead } from '../../components/company/SiteShell'
import { BRAND } from '../../company-data'
import { homeNoticeApi } from '../../api/homeClient'

/**
 * 공지사항(/notice). 관리자 콘솔 > 홈페이지 공지에서 등록하고,
 * 화면은 /api/public/home-notices 로 받아 온다(공개된 글만).
 * 분류 칩으로 거르고, 목록은 페이지 단위로 넘긴다. 항목을 누르면 /notice/:id 상세로.
 */
function formatDate(v) {
  if (!v) return ''
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function NoticePage() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const page = Number(params.get('page') ?? 0)
  const [data, setData] = useState(null)
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    homeNoticeApi.categories().then(setCategories).catch(() => setCategories([]))
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      setData(await homeNoticeApi.list({ category, page, size: 10 }))
    } catch (e) {
      setData({ content: [], totalPages: 0, totalElements: 0 })
      setError(e.message || '공지사항을 불러오지 못했습니다.')
    }
  }, [category, page])

  useEffect(() => { load() }, [load])

  // 분류·페이지는 쿼리스트링으로 관리한다(뒤로가기·공유가 자연스럽다).
  function go(patch) {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === '' || v == null) next.delete(k)
      else next.set(k, String(v))
    })
    setParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const items = data?.content ?? []
  const loading = data === null

  return (
    <SiteShell solidHeader title="공지사항">
      <SubHead title="공지사항" />

      <section className="kc-sec" id="notice-list">
        <div className="kc-wrap">
          <SecHead title={`${BRAND.name} 소식`} desc="새로운 서비스와 안내 사항을 전해드립니다." />

          {categories.length > 0 && (
            <div className="kc-notice-filter">
              <button
                type="button"
                className={`kc-notice-chip${category === '' ? ' on' : ''}`}
                onClick={() => go({ category: '', page: 0 })}
              >
                전체
              </button>
              {categories.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className={`kc-notice-chip${category === c.code ? ' on' : ''}`}
                  onClick={() => go({ category: c.code, page: 0 })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {error && <p className="kc-alert kc-alert-err">{error}</p>}

          {loading ? (
            <p className="kc-sec-desc">불러오는 중입니다.</p>
          ) : items.length === 0 ? (
            <p className="kc-sec-desc">등록된 공지사항이 없습니다.</p>
          ) : (
            <ul className="kc-notice">
              {items.map((n) => (
                <li className="kc-notice-item" key={n.noticeId}>
                  <Link to={`/notice/${n.noticeId}`} className="kc-notice-link">
                    <div className="kc-notice-top">
                      <span className="kc-tag">{n.categoryLabel}</span>
                      {n.pinned && <span className="kc-tag kc-tag-pin">고정</span>}
                      <h3>{n.title}</h3>
                    </div>
                    {n.summary && <p>{n.summary}</p>}
                    <div className="kc-notice-meta">
                      <span>
                        <span className="material-symbols-outlined">calendar_today</span>
                        {formatDate(n.publishedAt)}
                      </span>
                      <span>
                        <span className="material-symbols-outlined">visibility</span>
                        조회수 {n.viewCount.toLocaleString()}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {data && data.totalPages > 1 && (
            <div className="kc-pager">
              <button type="button" className="kc-pager-btn" disabled={page <= 0} onClick={() => go({ page: page - 1 })}>
                이전
              </button>
              <span className="kc-pager-info">{page + 1} / {data.totalPages}</span>
              <button
                type="button"
                className="kc-pager-btn"
                disabled={page >= data.totalPages - 1}
                onClick={() => go({ page: page + 1 })}
              >
                다음
              </button>
            </div>
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
