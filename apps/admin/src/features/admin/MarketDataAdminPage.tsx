import { Pagination, usePagination } from '../../shared/components/Pagination';
import { fetchAdminPage } from './dataViews';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, ExternalLink, Layers, PlayCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { API_BASE, getJson, postJson } from '../../shared/api/client';
import { Badge, Drawer, Panel, QueryState } from '../../shared/components/Ui';
import { dateTime, safeText } from '../../shared/utils/format';

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface MarketIndexItem {
  id?: string;
  code: string;
  name: string;
  exchange: string;
  description?: string;
  [key: string]: unknown;
}

interface IndexPriceItem {
  id: string;
  tradingDate?: string;
  trading_date?: string;
  openPrice?: number | string;
  highPrice?: number | string;
  lowPrice?: number | string;
  closePrice?: number | string;
  volume?: number | string;
  [key: string]: unknown;
}

interface SecurityMembershipItem {
  id: string;
  securityId?: string;
  symbol?: string;
  weight?: number | string;
  effectiveDate?: string;
  effective_date?: string;
  [key: string]: unknown;
}

interface MarketPriceItem {
  id: string;
  priceTimestamp?: string;
  price_timestamp?: string;
  openPrice?: number | string;
  open_price?: number | string;
  highPrice?: number | string;
  high_price?: number | string;
  lowPrice?: number | string;
  low_price?: number | string;
  closePrice?: number | string;
  close_price?: number | string;
  adjustedClose?: number | string;
  adjusted_close?: number | string;
  volume?: number | string;
  priceBasis?: string;
  price_basis?: string;
  isCanonical?: boolean;
  is_canonical?: boolean;
  [key: string]: unknown;
}

function useMarketPage<T>(path: string, pagination: ReturnType<typeof usePagination>, enabled = true) {
  const { page, size } = pagination;
  return useQuery({
    queryKey: ['admin-market-table', path, page, size],
    queryFn: () => fetchAdminPage<T>(page, size, async (offset, limit) => {
      const result = await getJson<PageResponse<T>>(API_BASE, path + '?page=' + offset + '&size=' + limit);
      return { rows: result.content, total: result.totalElements };
    }).then(result => ({ content: result.rows, totalElements: result.total })),
    enabled,
    staleTime: 60000,
  });
}

export function MarketDataAdminPage() {
  const [subTab, setSubTab] = useState<'indices' | 'prices'>('indices');
  const [selectedIndexCode, setSelectedIndexCode] = useState('VN30');
  const [stockSymbol, setStockSymbol] = useState('FPT');
  const stockPagination = usePagination();
  const indicesPagination = usePagination();
  const indexPricePagination = usePagination();
  const indexMembersPagination = usePagination();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Seed confirmation modals
  const [showSeedIndicesModal, setShowSeedIndicesModal] = useState(false);
  const [seedIndicesReason, setSeedIndicesReason] = useState('Khởi tạo catalog job chỉ số thị trường');
  const [showSeedMacroModal, setShowSeedMacroModal] = useState(false);
  const [seedMacroReason, setSeedMacroReason] = useState('Khởi tạo danh mục macro jobs');

  const queryClient = useQueryClient();

  // Securities lookup map to resolve UUID to ticker symbol
  const securitiesMapQuery = useQuery({
    queryKey: ['admin-securities-map-market-data'],
    queryFn: async () => {
      const result = await fetchAdminPage(0, 500, (page, size) => getJson<{
        rows: { id: string; symbol: string }[]; total: number;
      }>(API_BASE, '/api/admin/console/data/securities?page=' + page + '&size=' + size));
      const rows = result.rows;
      const map: Record<string, string> = {};
      rows.forEach(s => {
        if (s.id && s.symbol) map[s.id] = s.symbol;
      });
      return map;
    },
    staleTime: 5 * 60 * 1000,
  });

  const indicesQuery = useMarketPage<MarketIndexItem>('/api/admin/market-indices', indicesPagination, subTab === 'indices');
  const indexPath = '/api/admin/market-indices/' + encodeURIComponent(selectedIndexCode);
  const indexPricesQuery = useMarketPage<IndexPriceItem>(indexPath + '/prices', indexPricePagination, subTab === 'indices' && !!selectedIndexCode);
  const indexMembersQuery = useMarketPage<SecurityMembershipItem>(indexPath + '/memberships', indexMembersPagination, subTab === 'indices' && !!selectedIndexCode);
  const securityPricesQuery = useMarketPage<MarketPriceItem>('/api/admin/market-prices/' + encodeURIComponent(stockSymbol), stockPagination, subTab === 'prices' && !!stockSymbol);

  // Mutations
  const seedIndicesMutation = useMutation({
    mutationFn: () => postJson(API_BASE, '/api/admin/market-indices/catalog/seed', {}),
    onSuccess: (res: any) => {
      setActionMessage(`Khởi tạo Index Jobs thành công. Số job tạo/cập nhật: ${res?.jobs ?? 'OK'}.`);
      void queryClient.invalidateQueries({ queryKey: ['admin-market-table', '/api/admin/market-indices'] });
    },
    onError: (err: Error) => {
      setActionMessage(`Lỗi khởi tạo Index Jobs: ${err.message}`);
    },
  });

  const seedMacroMutation = useMutation({
    mutationFn: () => postJson(API_BASE, '/api/admin/macro/jobs/seed', {}),
    onSuccess: (res: any) => {
      setActionMessage(`Khởi tạo Macro Jobs thành công. Kết quả: ${JSON.stringify(res)}.`);
    },
    onError: (err: Error) => {
      setActionMessage(`Lỗi khởi tạo Macro Jobs: ${err.message}`);
    },
  });

  const indices = indicesQuery.data?.content || [];

  return (
    <div className="admin-stack">
      <Panel
        title="Dữ liệu Thị trường & Chỉ số Canonical"
        action={
          <button
            className="text-button"
            onClick={() => {
              void indicesQuery.refetch();
              if (subTab === 'indices') {
                void indexPricesQuery.refetch();
                void indexMembersQuery.refetch();
              } else {
                void securityPricesQuery.refetch();
              }
            }}
          >
            <RefreshCw size={14} /> Tải lại
          </button>
        }
      >
        <div className="tabs" role="tablist" style={{ marginBottom: '1rem' }}>
          <button
            role="tab"
            aria-selected={subTab === 'indices'}
            className={subTab === 'indices' ? 'active' : ''}
            onClick={() => setSubTab('indices')}
          >
            Chỉ số thị trường &amp; Rổ thành phần
          </button>
          <button
            role="tab"
            aria-selected={subTab === 'prices'}
            className={subTab === 'prices' ? 'active' : ''}
            onClick={() => setSubTab('prices')}
          >
            Tra cứu Giá Canonical cổ phiếu
          </button>
        </div>

        {actionMessage && (
          <div className="mini-record" style={{ marginBottom: '1rem', background: 'var(--panel-alt, #f8fafc)', borderLeft: '4px solid var(--accent, #3b82f6)' }}>
            <strong>Thông báo:</strong> {actionMessage}
            <button className="text-button" style={{ marginLeft: 8 }} onClick={() => setActionMessage(null)}>Đóng</button>
          </div>
        )}

        {/* SubTab 1: Indices */}
        {subTab === 'indices' && (
          <div className="admin-stack">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Danh mục Chỉ số Thị trường</h3>
                <span className="subtle">Các chỉ số được định nghĩa trong hệ thống (`market_indices`)</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="primary-button"
                  disabled={seedIndicesMutation.isPending}
                  onClick={() => setShowSeedIndicesModal(true)}
                >
                  <Layers size={14} style={{ marginRight: 4 }} />
                  {seedIndicesMutation.isPending ? 'Đang khởi tạo…' : 'Khởi tạo Index Jobs'}
                </button>
                <button
                  className="light-button"
                  disabled={seedMacroMutation.isPending}
                  onClick={() => setShowSeedMacroModal(true)}
                >
                  <Database size={14} style={{ marginRight: 4 }} />
                  {seedMacroMutation.isPending ? 'Đang khởi tạo…' : 'Khởi tạo Macro Jobs'}
                </button>
              </div>
            </div>

            <QueryState query={indicesQuery} empty="Chưa có chỉ số nào trong hệ thống. Bấm Khởi tạo Index Jobs để nạp.">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Mã chỉ số</th>
                      <th>Tên chỉ số</th>
                      <th>Sàn</th>
                      <th>Mô tả</th>
                      <th style={{ textAlign: 'right' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indices.map(idx => (
                      <tr key={idx.code}>
                        <td><strong>{idx.code}</strong></td>
                        <td>{idx.name}</td>
                        <td><Badge tone="neutral">{idx.exchange || 'HOSE'}</Badge></td>
                        <td><small>{safeText(idx.description || 'Chỉ số thị trường')}</small></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className={selectedIndexCode === idx.code ? 'primary-button' : 'light-button'}
                            onClick={() => { setSelectedIndexCode(idx.code); indexPricePagination.setPage(0); indexMembersPagination.setPage(0); }}
                          >
                            Xem giá &amp; rổ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                <Pagination page={indicesPagination.page} size={indicesPagination.size} total={indicesQuery.data?.totalElements ?? 0} onPage={indicesPagination.setPage} onSize={indicesPagination.changeSize} busy={indicesQuery.isFetching}/>
            </QueryState>

            {selectedIndexCode && (
              <div className="admin-stack" style={{ marginTop: '1.5rem', background: 'var(--panel-alt, #f8fafc)', padding: '1rem', borderRadius: 4, border: '1px solid var(--border, #e2e8f0)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>Giá đóng cửa &amp; Thành phần rổ chỉ số: <strong>{selectedIndexCode}</strong></h4>
                  {indexPricesQuery.data?.content && indexPricesQuery.data.content.length > 0 ? (
                    <Badge tone="green">{indexPricesQuery.data.content.length} PHIÊN CANONICAL</Badge>
                  ) : (
                    <Badge tone="amber">CHƯA CÓ GIÁ CANONICAL</Badge>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                  {/* Prices */}
                  <div>
                    <h5 style={{ margin: '0 0 0.5rem' }}>Giá đóng cửa ({selectedIndexCode})</h5>
                    <QueryState query={indexPricesQuery} empty="Chưa có dữ liệu giá cho chỉ số này.">
                      <div className="table-scroll" style={{ maxHeight: 300 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Ngày</th>
                              <th className="number">Đóng cửa</th>
                              <th className="number">Khối lượng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(indexPricesQuery.data?.content || []).map((p, i) => {
                              const dateVal = p.tradingDate || p.trading_date || (p as any).priceTimestamp || (p as any).price_timestamp;
                              const closeVal = p.closePrice ?? (p as any).closeValue ?? (p as any).close_price ?? (p as any).close_value ?? 0;
                              const volVal = p.volume ?? (p as any).volume ?? 0;
                              return (
                                <tr key={p.id || i}>
                                  <td>{dateVal ? dateTime(dateVal).split(' ')[0] : '—'}</td>
                                  <td className="number" style={{ fontWeight: 600 }}>{Number(closeVal).toLocaleString('vi-VN')}</td>
                                  <td className="number">{Number(volVal).toLocaleString('vi-VN')}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                <Pagination page={indexPricePagination.page} size={indexPricePagination.size} total={indexPricesQuery.data?.totalElements ?? 0} onPage={indexPricePagination.setPage} onSize={indexPricePagination.changeSize} busy={indexPricesQuery.isFetching}/>
                    </QueryState>
                  </div>

                  {/* Memberships */}
                  <div>
                    <h5 style={{ margin: '0 0 0.5rem' }}>Cổ phiếu thành phần rổ ({selectedIndexCode})</h5>
                    <QueryState query={indexMembersQuery} empty="Chưa có danh sách thành phần cho chỉ số này.">
                      <div className="table-scroll" style={{ maxHeight: 300 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Mã CK</th>
                              <th className="number">Tỷ trọng</th>
                              <th>Hiệu lực từ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(indexMembersQuery.data?.content || []).map((m, i) => {
                              const secId = m.securityId || (m as any).security_id || '';
                              const sym = m.symbol || securitiesMapQuery.data?.[secId] || (secId ? `${secId.slice(0, 8)}…` : '—');
                              const effDate = m.effectiveDate || m.effective_date || (m as any).effectiveFrom || (m as any).effective_from;
                              return (
                                <tr key={m.id || i}>
                                  <td>
                                    <strong>{sym}</strong>
                                    {secId && sym !== secId ? <code className="subtle" style={{ fontSize: '0.7rem', marginLeft: 4 }}>({secId.slice(0, 8)}…)</code> : null}
                                  </td>
                                  <td className="number">{m.weight ? `${Number(m.weight).toFixed(2)}%` : '—'}</td>
                                  <td><small>{safeText(effDate)}</small></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                <Pagination page={indexMembersPagination.page} size={indexMembersPagination.size} total={indexMembersQuery.data?.totalElements ?? 0} onPage={indexMembersPagination.setPage} onSize={indexMembersPagination.changeSize} busy={indexMembersQuery.isFetching}/>
                    </QueryState>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SubTab 2: Security Prices */}
        {subTab === 'prices' && (
          <div className="admin-stack">
            <div className="toolbar filters" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                Mã cổ phiếu:
                <input
                  type="text"
                  value={stockSymbol}
                  onChange={e => {
                    setStockSymbol(e.target.value.toUpperCase());
                    stockPagination.setPage(0);
                  }}
                  style={{ width: '120px', padding: '0.35rem 0.6rem', fontWeight: 700 }}
                  placeholder="VD: FPT"
                />
              </label>

              <span className="subtle">
                Xem trực tiếp các bản ghi canonical trong bảng `market_prices`
              </span>
            </div>

            <QueryState query={securityPricesQuery} empty={`Chưa có dữ liệu giá canonical cho mã ${stockSymbol}.`}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Phiên giao dịch</th>
                      <th className="number">Mở cửa</th>
                      <th className="number">Cao nhất</th>
                      <th className="number">Thấp nhất</th>
                      <th className="number">Đóng cửa (VND)</th>
                      <th className="number">Giá điều chỉnh</th>
                      <th className="number">Khối lượng</th>
                      <th>Cơ sở giá</th>
                      <th>Canonical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(securityPricesQuery.data?.content || []).map(p => {
                      const dt = p.priceTimestamp || p.price_timestamp;
                      const open = p.openPrice ?? p.open_price;
                      const high = p.highPrice ?? p.high_price;
                      const low = p.lowPrice ?? p.low_price;
                      const close = p.closePrice ?? p.close_price;
                      const adj = p.adjustedClose ?? p.adjusted_close;
                      const basis = p.priceBasis || p.price_basis || 'UNADJUSTED';
                      const canonical = p.isCanonical ?? p.is_canonical ?? true;

                      return (
                        <tr key={p.id}>
                          <td><strong>{dt ? String(dt).slice(0, 10) : '—'}</strong></td>
                          <td className="number">{open ? Number(open).toLocaleString('vi-VN') : '—'}</td>
                          <td className="number">{high ? Number(high).toLocaleString('vi-VN') : '—'}</td>
                          <td className="number">{low ? Number(low).toLocaleString('vi-VN') : '—'}</td>
                          <td className="number" style={{ fontWeight: 600 }}>{close ? Number(close).toLocaleString('vi-VN') : '—'}</td>
                          <td className="number">{adj ? Number(adj).toLocaleString('vi-VN') : '—'}</td>
                          <td className="number">{p.volume ? Number(p.volume).toLocaleString('vi-VN') : '—'}</td>
                          <td><Badge tone="neutral">{basis}</Badge></td>
                          <td>
                            <Badge tone={canonical ? 'green' : 'amber'}>
                              {canonical ? 'CANONICAL' : 'BACKUP'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                <Pagination page={stockPagination.page} size={stockPagination.size} total={securityPricesQuery.data?.totalElements ?? 0} onPage={stockPagination.setPage} onSize={stockPagination.changeSize} busy={securityPricesQuery.isFetching}/>

            </QueryState>
          </div>
        )}
      </Panel>

      {/* Modal Seed Indices Jobs */}
      {showSeedIndicesModal && (
        <Drawer
          title="Khởi tạo Index Ingestion Jobs"
          subtitle="Tạo hoặc cập nhật các job thu thập dữ liệu chỉ số thị trường"
          onClose={() => setShowSeedIndicesModal(false)}
        >
          <div className="detail-section">
            <p>
              Thao tác này sẽ quét danh mục chỉ số (VNINDEX, VN30, HNX-INDEX...) và đăng ký/cập nhật các job định kỳ trong hệ thống.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 3 }}>Lý do thực hiện (Audit reason)</label>
              <input
                type="text"
                value={seedIndicesReason}
                onChange={e => setSeedIndicesReason(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="toolbar" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="primary-button"
                disabled={seedIndicesMutation.isPending || !seedIndicesReason.trim()}
                onClick={() => {
                  seedIndicesMutation.mutate();
                  setShowSeedIndicesModal(false);
                }}
              >
                {seedIndicesMutation.isPending ? 'Đang khởi tạo…' : 'Xác nhận khởi tạo'}
              </button>
              <button className="light-button" onClick={() => setShowSeedIndicesModal(false)}>
                Hủy
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Modal Seed Macro Jobs */}
      {showSeedMacroModal && (
        <Drawer
          title="Khởi tạo Macro Ingestion Jobs"
          subtitle="Tạo hoặc cập nhật các job thu thập dữ liệu vĩ mô (GDP, CPI, Lãi suất)"
          onClose={() => setShowSeedMacroModal(false)}
        >
          <div className="detail-section">
            <p>
              Thao tác này sẽ đồng bộ cấu hình macro series vào bảng quản trị và kích hoạt pipeline vĩ mô.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 3 }}>Lý do thực hiện (Audit reason)</label>
              <input
                type="text"
                value={seedMacroReason}
                onChange={e => setSeedMacroReason(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="toolbar" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="primary-button"
                disabled={seedMacroMutation.isPending || !seedMacroReason.trim()}
                onClick={() => {
                  seedMacroMutation.mutate();
                  setShowSeedMacroModal(false);
                }}
              >
                {seedMacroMutation.isPending ? 'Đang khởi tạo…' : 'Xác nhận khởi tạo'}
              </button>
              <button className="light-button" onClick={() => setShowSeedMacroModal(false)}>
                Hủy
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
