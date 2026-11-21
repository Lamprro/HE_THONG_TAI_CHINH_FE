import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, ExternalLink, Globe, MapPin, Search } from 'lucide-react';
import { apiData, apiPage, type Row, type Security } from '../shared/api';
import { date, safeUrl, text } from '../shared/format';
import { Pagination, QueryState, securityLink, useTitle } from '../shared/ui';

type CompanyDetail = {
  id: string;
  companyCode: string;
  legalName: string;
  shortName: string | null;
  industryName: string | null;
  sectorName: string | null;
  website: string | null;
  headquarters: string | null;
  foundedDate: string | null;
  listingStatus: string | null;
  description: string | null;
  active: boolean;
  updatedAt: string | null;
  securities: Security[];
};

type CompanySummary = {
  id: string;
  companyCode: string;
  legalName: string;
  shortName: string | null;
  industryName: string | null;
  sectorName: string | null;
  active: boolean;
};

export function CompanyDetailPage({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['company', id],
    staleTime: 3_600_000,
    queryFn: ({ signal }) => apiData<CompanyDetail>('company', [id], {}, signal),
  });
  const data = query.data?.data;
  const website = safeUrl(data?.website);

  useTitle(data?.legalName ? `${data.legalName} · Hồ sơ công ty` : 'Hồ sơ công ty');

  return (
    <>
      <a className="back-link" href="#/companies">
        <ArrowLeft size={14} /> Danh sách doanh nghiệp
      </a>
      <QueryState loading={query.isPending} error={query.error} retry={query.refetch}>
        {data && (
          <div className="company-layout" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="security-heading">
              <div className="security-title">
                <span className="symbol-avatar" style={{ fontSize: '1.2rem' }}>
                  <Building2 size={24} />
                </span>
                <div>
                  <h1>{data.legalName}</h1>
                  <p>
                    {data.shortName ? `${data.shortName} · ` : ''}
                    Mã tổ chức: <b>{data.companyCode}</b>
                    {data.industryName ? ` · Ngành: ${data.industryName}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <section className="panel">
              <div className="panel-heading">
                <h2>Thông tin pháp lý & trụ sở</h2>
              </div>
              <dl className="stats">
                <div>
                  <dt>Tên pháp lý</dt>
                  <dd>{data.legalName}</dd>
                </div>
                <div>
                  <dt>Tên viết tắt</dt>
                  <dd>{text(data.shortName)}</dd>
                </div>
                <div>
                  <dt>Mã doanh nghiệp</dt>
                  <dd>{data.companyCode}</dd>
                </div>
                <div>
                  <dt>Trụ sở chính</dt>
                  <dd>
                    {data.headquarters ? (
                      <span>
                        <MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />
                        {data.headquarters}
                      </span>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Ngày thành lập</dt>
                  <dd>{date(data.foundedDate)}</dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>{data.active ? 'Đang hoạt động' : 'Tạm dừng/Hủy'}</dd>
                </div>
                <div>
                  <dt>Trang thông tin</dt>
                  <dd>
                    {website ? (
                      <a href={website} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={13} /> {website} <ExternalLink size={12} />
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
              </dl>
              {data.description && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.08))', paddingTop: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--text-muted, #94a3b8)' }}>Giới thiệu</h3>
                  <p style={{ lineHeight: '1.6', fontSize: '0.95rem', margin: 0 }}>{data.description}</p>
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Mã chứng khoán niêm yết ({data.securities?.length || 0})</h2>
                  <span className="muted">Các mã cổ phiếu trực thuộc tổ chức phát hành này</span>
                </div>
              </div>
              {data.securities && data.securities.length > 0 ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Mã</th>
                        <th>Sàn</th>
                        <th>Loại chứng khoán</th>
                        <th>Tiền tệ</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.securities.map(sec => (
                        <tr key={sec.id}>
                          <td>
                            <a className="ticker" href={securityLink(sec.symbol, sec.exchange)}>
                              <b>{sec.symbol}</b>
                            </a>
                          </td>
                          <td>{sec.exchange}</td>
                          <td>{text(sec.securityType)}</td>
                          <td>{sec.currency || 'VND'}</td>
                          <td>
                            <a className="button" href={securityLink(sec.symbol, sec.exchange)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem' }}>
                              Xem chi tiết ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="state">
                  <strong>Chưa có mã chứng khoán nào được liên kết</strong>
                </div>
              )}
            </section>
          </div>
        )}
      </QueryState>
    </>
  );
}

export function CompaniesListPage() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ['companies', search, page],
    staleTime: 1_800_000,
    queryFn: ({ signal }) =>
      apiPage<CompanySummary>('companies', [], { search: search || undefined, activeOnly: true, page, size: 25 }, signal),
  });

  useTitle('Danh mục doanh nghiệp');

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">DỮ LIỆU CÔNG TY</p>
          <h1>Danh mục doanh nghiệp</h1>
          <p>Hồ sơ pháp lý, mã định danh và thông tin tổ chức phát hành trên thị trường chứng khoán.</p>
        </div>
      </div>

      <section className="panel">
        <form
          className="toolbar"
          onSubmit={e => {
            e.preventDefault();
            setSearch(input.trim());
            setPage(0);
          }}
        >
          <label className="search" style={{ flex: 1 }}>
            <Search size={16} />
            <input
              aria-label="Tìm doanh nghiệp"
              placeholder="Tìm theo tên pháp lý, tên viết tắt, mã doanh nghiệp…"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
          </label>
          <button type="submit">Tìm kiếm</button>
        </form>

        <QueryState loading={query.isPending} error={query.error} empty={!query.data?.items.length} retry={query.refetch}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã DN</th>
                  <th>Tên pháp lý</th>
                  <th>Tên viết tắt</th>
                  <th>Ngành</th>
                  <th>Lĩnh vực</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map(row => (
                  <tr key={row.id}>
                    <td>
                      <a href={`#/company/${encodeURIComponent(row.id)}`}>
                        <b>{row.companyCode}</b>
                      </a>
                    </td>
                    <td>
                      <a href={`#/company/${encodeURIComponent(row.id)}`}>{row.legalName}</a>
                    </td>
                    <td>{text(row.shortName)}</td>
                    <td>{text(row.industryName)}</td>
                    <td>{text(row.sectorName)}</td>
                    <td>
                      <a className="button" href={`#/company/${encodeURIComponent(row.id)}`} style={{ padding: '0.2rem 0.6rem', fontSize: '0.85rem' }}>
                        Hồ sơ
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.data && (page > 0 || query.data.hasNext) && (
            <Pagination page={page} total={query.data.total} hasNext={query.data.hasNext} onChange={setPage} />
          )}
        </QueryState>
      </section>
    </>
  );
}
