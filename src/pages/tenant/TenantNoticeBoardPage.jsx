import { useCallback, useEffect, useMemo, useState } from 'react'
import TenantShell from '../../components/TenantShell'
import Toast from '../../components/Toast'
import Icon from '../../components/Icon'
import Loading from '../../components/Loading'
import { tenantNoticeBoardApi } from '../../api/tenantClient'

const PAGE_SIZE = 8
const fmtDate = (dt) => (dt ? dt.slice(0, 10).replace(/-/g, '.') : '')
const fmtDateTime = (dt) => (dt ? dt.slice(0, 16).replace('T', ' ').replace(/-/g, '.') : '')
const isNew = (dt) => {
  if (!dt) return false
  const t = new Date(dt).getTime()
  return Number.isFinite(t) && (Date.now() - t) < 7 * 24 * 60 * 60 * 1000
}

// 업체(사장님) 콘솔 공지사항 — 관리자가 등록한 공지를 읽는 공지 센터(검색·정렬·페이징 + 상세 모달).
export default function TenantNoticeBoardPage() {
  const [items, setItems] = useState(null)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('new') // 'new' | 'old'
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    try { setItems(await tenantNoticeBoardApi.list()) }
    catch (e) { setError(e.message); setItems([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function open(n) {
    setDetail({ ...n, loading: true })
    try { setDetail(await tenantNoticeBoardApi.get(n.id)) }
    catch (e) { setError(e.message); setDetail(null) }
  }

  // 상세를 보면 서버가 조회수를 올리므로, 닫을 때 목록을 다시 불러와 조회수를 갱신한다.
  function closeDetail() { setDetail(null); load() }

  const filtered = useMemo(() => {
    const kw = q.trim()
    const arr = (items || []).filter((n) => !kw || `${n.title} ${n.summary || ''}`.includes(kw))
    return [...arr].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1 // 고정 먼저
      const ta = a.createdAt || '', tb = b.createdAt || ''
      return sort === 'new' ? tb.localeCompare(ta) : ta.localeCompare(tb)
    })
  }, [items, q, sort])

  // NO. 는 표시 순서 기준 행 번호(ROWNUM). 고정글은 TOP, 나머지는 위에서부터 1,2,3 … (페이지 넘어가도 연속).
  const rowNo = useMemo(() => {
    const m = {}; let k = 0
    filtered.forEach((n) => { if (!n.pinned) { k += 1; m[n.id] = k } })
    return m
  }, [filtered])

  useEffect(() => { setPage(1) }, [q, sort])
  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const cur = Math.min(page, pages)
  const pageItems = filtered.slice((cur - 1) * PAGE_SIZE, cur * PAGE_SIZE)
  const pageNums = pages <= 5
    ? Array.from({ length: pages }, (_, i) => i + 1)
    : [...new Set([1, 2, 3, pages])]

  return (
    <TenantShell>
      <div className="m-page-head" style={{ marginBottom: 20 }}>
        <span className="m-eyebrow"><Icon name="campaign" /> OPERATIONAL UPDATES</span>
        <h1>공지사항</h1>
        <p>운영에 필요한 공지사항을 확인하세요.</p>
      </div>

      {items === null ? (
        <Loading label="공지를 불러오는 중…" />
      ) : (
        <>
          <div className="nb-toolbar">
            <select className="nb-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
              <option value="new">최신순</option>
              <option value="old">오래된순</option>
            </select>
            <div className="nb-search">
              <Icon name="search" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="공지사항 제목 또는 내용 검색" />
              {q && <button type="button" className="nb-search-x" onClick={() => setQ('')} aria-label="지우기">✕</button>}
            </div>
          </div>

          <div className="nb-panel">
            {total === 0 ? (
              <div className="nb-empty">
                <span className="nb-empty-ico">📢</span>
                <p>{q ? `‘${q}’에 해당하는 공지가 없습니다.` : '등록된 공지사항이 없습니다.'}</p>
              </div>
            ) : (
              <>
                {/* 데스크톱 — 표 */}
                <div className="nb-table-wrap">
                  <table className="nb-table">
                    <thead>
                      <tr>
                        <th className="nb-c-no">NO.</th>
                        <th className="nb-c-title">제목</th>
                        <th className="nb-c-author">작성자</th>
                        <th className="nb-c-date">등록일</th>
                        <th className="nb-c-views">조회</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((n) => (
                        <tr key={n.id} className="nb-row" onClick={() => open(n)}>
                          <td className="nb-c-no">
                            {n.pinned ? <span className="nb-top">TOP</span> : <span className="nb-num">{rowNo[n.id]}</span>}
                          </td>
                          <td className="nb-c-title">
                            <span className="nb-title-line">
                              {n.pinned && <Icon name="push_pin" className="nb-pin" filled />}
                              <span className="nb-title">{n.title}</span>
                              {isNew(n.createdAt) && <span className="nb-new">NEW</span>}
                            </span>
                            {n.summary && <span className="nb-subtitle">{n.summary}</span>}
                          </td>
                          <td className="nb-c-author">{n.authorName || '관리자'}</td>
                          <td className="nb-c-date">{fmtDate(n.createdAt)}</td>
                          <td className="nb-c-views">{(n.viewCount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 모바일 — 카드 */}
                <ul className="nb-cards">
                  {pageItems.map((n) => (
                    <li key={n.id}>
                      <button type="button" className={`nb-mcard${n.pinned ? ' pinned' : ''}`} onClick={() => open(n)}>
                        <div className="nb-mcard-top">
                          {n.pinned ? <span className="nb-top">TOP</span> : <span className="nb-mcard-no">{rowNo[n.id]}</span>}
                          {n.pinned && <Icon name="push_pin" className="nb-pin" filled />}
                          <span className="nb-mcard-title">{n.title}</span>
                          {isNew(n.createdAt) && <span className="nb-new">NEW</span>}
                        </div>
                        {n.summary && <p className="nb-mcard-desc">{n.summary}</p>}
                        <div className="nb-mcard-meta">
                          <span>{n.authorName || '관리자'}</span>
                          <span className="nb-dot">·</span>
                          <span>{fmtDate(n.createdAt)}</span>
                          <span className="nb-dot">·</span>
                          <span>조회 {(n.viewCount || 0).toLocaleString()}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {pages > 1 && (
              <div className="nb-foot">
                <div className="nb-pager">
                  <button type="button" className="nb-pg-nav" disabled={cur === 1} onClick={() => setPage(cur - 1)} aria-label="이전"><Icon name="chevron_left" /></button>
                  {pageNums.map((p, i) => {
                    const prev = pageNums[i - 1]
                    return (
                      <span key={p} className="nb-pgwrap">
                        {prev && p - prev > 1 && <span className="nb-gap">…</span>}
                        <button type="button" className={`nb-pg${p === cur ? ' on' : ''}`} onClick={() => setPage(p)}>{p}</button>
                      </span>
                    )
                  })}
                  <button type="button" className="nb-pg-nav" disabled={cur === pages} onClick={() => setPage(cur + 1)} aria-label="다음"><Icon name="chevron_right" /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {detail && (
        <div className="nd-bd" onMouseDown={closeDetail}>
          <div className="nd-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button type="button" className="nd-x" onClick={closeDetail} aria-label="닫기">
              <Icon name="close" />
            </button>
            <div className="nd-head">
              {(detail.pinned || isNew(detail.createdAt)) && (
                <div className="nd-chips">
                  {detail.pinned && <span className="nd-chip pin"><Icon name="push_pin" filled /> 고정</span>}
                  {isNew(detail.createdAt) && <span className="nd-chip new">NEW</span>}
                </div>
              )}
              <h2 className="nd-title">{detail.title}</h2>
              <div className="nd-meta">
                <span><Icon name="person" /> {detail.authorName || '관리자'}</span>
                <span><Icon name="calendar_today" /> {fmtDateTime(detail.createdAt)}</span>
                {typeof detail.viewCount === 'number' && <span><Icon name="visibility" /> {detail.viewCount.toLocaleString()}</span>}
              </div>
            </div>
            <div className="nd-body">
              {detail.loading
                ? <div className="nd-loading"><Loading label="불러오는 중…" /></div>
                : <div className="tn-detail-body" dangerouslySetInnerHTML={{ __html: detail.content }} />}
            </div>
          </div>
        </div>
      )}

      <Toast message={error} onClose={() => setError('')} />
    </TenantShell>
  )
}
