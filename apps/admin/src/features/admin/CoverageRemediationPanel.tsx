import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Database, Filter, PlayCircle, RefreshCw, Search } from 'lucide-react';
import { API_BASE, getJson } from '../../shared/api/client';
import { Badge, Drawer, Panel, QueryState } from '../../shared/components/Ui';
import { dateTime, safeText } from '../../shared/utils/format';
import type { WorkflowSelection } from './WorkflowPage';
import {
  buildPriceRemediation,
  buildStatementRemediation,
  computeRowStatus,
  getLatestTradingWeekday,
} from './coverage';

interface PriceCoverageRow {
  symbol: string;
  daily_prices: number | string;
  first_price: string | null;
  last_price: string | null;
  missing_adjusted_close: number | string;
  unknown_price_basis: number | string;
  foreign_source_days: number | string;
}

interface StatementCoverageRow {
  symbol: string;
  canonical_statements: number | string;
  missing_publication: number | string;
  missing_scope: number | string;
}

interface MacroCoverageRow {
  code: string;
  name: string;
  country_code: string;
  frequency: string;
  unit: string;
  observation_count: number | string;
  first_period_end: string | null;
  last_period_end: string | null;
}

interface FinancialQualityCoverage {
  observedAt: string;
  securities: PriceCoverageRow[];
  statements: Array<{
    statement_type: string;
    report_scope: string;
    period_basis: string;
    count: number | string;
    missing_published_at: number | string;
    missing_units: number | string;
  }>;
  strictPointInTimeEligibleItems?: number;
  limitation?: string;
}

interface ExternalCapability {
  operation: string;
  provider: string;
  native_adapter?: boolean;
  maximum_calendar_days?: number;
  symbols?: string[];
}

interface GapResponse {
  symbol: string;
  type: string;
  from: string;
  to: string;
  totalCalendarDays?: number;
  presentDays?: number;
  missingCount: number;
  missingDates?: string[];
  gaps?: Array<{ date?: string; reason: string }>;
}

export function CoverageRemediationPanel({ onWorkflow }: { onWorkflow?: (selection: WorkflowSelection) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'GAP_PRICE' | 'GAP_STATEMENTS' | 'HEALTHY'>('ALL');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Statement drawer config state
  const [selectedStatementType, setSelectedStatementType] = useState('balance_sheet');
  const [selectedPeriod, setSelectedPeriod] = useState('quarter');
  const [selectedSource, setSelectedSource] = useState('VNDIRECT');

  const latestTradingWeekday = useMemo(() => getLatestTradingWeekday(), []);

  const priceCoverage = useQuery({
    queryKey: ['admin-quality-coverage'],
    queryFn: () => getJson<FinancialQualityCoverage>(API_BASE, '/api/admin/financial-data/quality/coverage'),
    staleTime: 60000,
  });

  const statementCoverage = useQuery({
    queryKey: ['admin-statement-coverage'],
    queryFn: () => getJson<StatementCoverageRow[]>(API_BASE, '/api/admin/financial-data/coverage'),
    staleTime: 60000,
  });

  const macroCoverage = useQuery({
    queryKey: ['admin-macro-coverage'],
    queryFn: () => getJson<MacroCoverageRow[]>(API_BASE, '/api/admin/macro/coverage'),
    staleTime: 60000,
  });

  const capabilities = useQuery({
    queryKey: ['external-capabilities'],
    queryFn: () => getJson<{ capabilities?: ExternalCapability[] }>(API_BASE, '/api/external-financial-data/capabilities').catch(() => ({ capabilities: [] })),
    staleTime: 300000,
  });

  const gapsQuery = useQuery({
    queryKey: ['admin-symbol-gaps', selectedSymbol],
    queryFn: () => getJson<GapResponse>(API_BASE, `/api/admin/financial-data/gaps?symbol=${selectedSymbol}&type=PRICE`),
    enabled: !!selectedSymbol,
    staleTime: 30000,
  });

  const statementProviders = useMemo(() => {
    const list = capabilities.data?.capabilities?.filter(c => c.operation === 'FINANCIAL_STATEMENT' || c.operation === 'STATEMENTS') || [];
    const providers = list.map(c => c.provider.toUpperCase());
    return providers.length > 0 ? Array.from(new Set(providers)) : ['VNDIRECT', 'CAFEF'];
  }, [capabilities.data]);

  const statementMap = useMemo(() => {
    const map = new Map<string, StatementCoverageRow>();
    statementCoverage.data?.forEach(row => map.set(row.symbol, row));
    return map;
  }, [statementCoverage.data]);

  const combinedRows = useMemo(() => {
    const list = priceCoverage.data?.securities || [];
    return list.map(priceRow => {
      const stmtRow = statementMap.get(priceRow.symbol);
      const prices = Number(priceRow.daily_prices || 0);
      const stmts = Number(stmtRow?.canonical_statements || 0);
      const lastPrice = priceRow.last_price ? priceRow.last_price.slice(0, 10) : null;
      
      const status = computeRowStatus(prices, lastPrice, stmts, latestTradingWeekday);

      return {
        symbol: priceRow.symbol,
        dailyPrices: prices,
        firstPrice: priceRow.first_price ? priceRow.first_price.slice(0, 10) : '—',
        lastPrice: lastPrice || '—',
        missingAdjusted: Number(priceRow.missing_adjusted_close || 0),
        canonicalStatements: stmts,
        missingPub: Number(stmtRow?.missing_publication || 0),
        status,
      };
    });
  }, [priceCoverage.data, statementMap, latestTradingWeekday]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toUpperCase();
    return combinedRows.filter(row => {
      const matchSearch = !term || row.symbol.includes(term);
      const matchFilter = filter === 'ALL' || row.status === filter;
      return matchSearch && matchFilter;
    });
  }, [combinedRows, search, filter]);

  const selectedDetail = useMemo(
    () => combinedRows.find(r => r.symbol === selectedSymbol),
    [combinedRows, selectedSymbol]
  );

  const remediatePrice = (symbol: string, lastPrice: string | null) => {
    const selection = buildPriceRemediation(symbol, lastPrice, latestTradingWeekday);
    onWorkflow?.(selection);
  };

  const remediateStatement = (
    symbol: string,
    statement: string = selectedStatementType,
    period: string = selectedPeriod,
    source: string = selectedSource
  ) => {
    const selection = buildStatementRemediation(symbol, statement, period, source);
    onWorkflow?.(selection);
  };

  return (
    <Panel
      title="Ma trận độ phủ & Xử lý khoảng thiếu dữ liệu"
      eyebrow="GIÁM SÁT & BÙ ĐẮP DỮ LIỆU"
      note={`Kiểm tra độ phủ thực tế từ database tính đến phiên gần nhất (${latestTradingWeekday}): phát hiện khoảng thiếu theo mã/kỳ và 1-click kích hoạt workflow xử lý.`}
      action={
        <button
          className="text-button"
          onClick={() => {
            void priceCoverage.refetch();
            void statementCoverage.refetch();
            void macroCoverage.refetch();
          }}
        >
          <RefreshCw size={14} /> Tải lại
        </button>
      }
    >
      <div className="count-grid" style={{ marginBottom: '1rem' }}>
        <div>
          <strong>{combinedRows.length}</strong>
          <span>Tổng mã theo dõi</span>
        </div>
        <div>
          <strong style={{ color: 'var(--positive, #10b981)' }}>
            {combinedRows.filter(r => r.status === 'HEALTHY').length}
          </strong>
          <span>Đầy đủ giá & BCTC</span>
        </div>
        <div>
          <strong style={{ color: 'var(--warning, #f59e0b)' }}>
            {combinedRows.filter(r => r.status === 'GAP_PRICE').length}
          </strong>
          <span>Cần cập nhật giá</span>
        </div>
        <div>
          <strong style={{ color: 'var(--danger, #ef4444)' }}>
            {combinedRows.filter(r => r.status === 'GAP_STATEMENTS').length}
          </strong>
          <span>Thiếu BCTC</span>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--muted, #64748b)' }} />
          <input
            type="text"
            placeholder="Tìm theo mã (vd: FPT, HPG)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '2rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <Filter size={15} color="var(--muted, #64748b)" />
          <button
            className={filter === 'ALL' ? 'active-filter' : 'light-button'}
            onClick={() => setFilter('ALL')}
          >
            Tất cả ({combinedRows.length})
          </button>
          <button
            className={filter === 'GAP_PRICE' ? 'active-filter' : 'light-button'}
            onClick={() => setFilter('GAP_PRICE')}
          >
            Cần bù giá ({combinedRows.filter(r => r.status === 'GAP_PRICE').length})
          </button>
          <button
            className={filter === 'GAP_STATEMENTS' ? 'active-filter' : 'light-button'}
            onClick={() => setFilter('GAP_STATEMENTS')}
          >
            Thiếu BCTC ({combinedRows.filter(r => r.status === 'GAP_STATEMENTS').length})
          </button>
          <button
            className={filter === 'HEALTHY' ? 'active-filter' : 'light-button'}
            onClick={() => setFilter('HEALTHY')}
          >
            Đạt chuẩn ({combinedRows.filter(r => r.status === 'HEALTHY').length})
          </button>
        </div>
      </div>

      <QueryState query={priceCoverage} empty="Chưa có dữ liệu độ phủ từ hệ thống.">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th className="number">Phiên giá</th>
                <th>Dải ngày giá</th>
                <th className="number">Báo cáo (CĐKT)</th>
                <th className="number">Thiếu ngày CB</th>
                <th>Tình trạng</th>
                <th style={{ textAlign: 'right' }}>Hành động khắc phục</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => (
                <tr key={row.symbol}>
                  <td>
                    <button
                      className="text-button"
                      style={{ fontWeight: 600, cursor: 'pointer' }}
                      onClick={() => setSelectedSymbol(row.symbol)}
                      title="Bấm để xem chi tiết tình trạng và giải pháp khắc phục"
                    >
                      {row.symbol}
                    </button>
                  </td>
                  <td className="number">{row.dailyPrices.toLocaleString('vi-VN')}</td>
                  <td>
                    <small>
                      {row.firstPrice} → {row.lastPrice}
                    </small>
                  </td>
                  <td className="number">{row.canonicalStatements}</td>
                  <td className="number">{row.missingPub > 0 ? <span style={{ color: 'var(--warning, #f59e0b)' }}>{row.missingPub}</span> : '0'}</td>
                  <td>
                    {row.status === 'HEALTHY' ? (
                      <Badge tone="green">Đầy đủ</Badge>
                    ) : row.status === 'GAP_PRICE' ? (
                      <Badge tone="amber">Thiếu giá</Badge>
                    ) : (
                      <Badge tone="red">Thiếu BCTC</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {row.status === 'HEALTHY' ? (
                      <span className="subtle" style={{ fontSize: '0.8rem', marginRight: 6 }}>
                        <CheckCircle2 size={13} style={{ verticalAlign: 'middle', marginRight: 3, color: 'var(--positive, #10b981)' }} />
                        Đủ dữ liệu
                      </span>
                    ) : (
                      <button
                        className="light-button"
                        style={{ marginRight: 6 }}
                        title={`Bù đắp dữ liệu giá thiếu cho ${row.symbol} qua Workflow`}
                        onClick={() => remediatePrice(row.symbol, row.lastPrice)}
                      >
                        <PlayCircle size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                        Bù giá
                      </button>
                    )}
                    <button
                      className="light-button"
                      title={`Lấy báo cáo tài chính cho ${row.symbol} qua Workflow`}
                      onClick={() => {
                        setSelectedSymbol(row.symbol);
                      }}
                    >
                      <Database size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                      Lấy BCTC
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>

      {macroCoverage.data && macroCoverage.data.length > 0 && (
        <details style={{ marginTop: '1.5rem' }}>
          <summary>
            <strong>Độ phủ chỉ số kinh tế vĩ mô ({macroCoverage.data.length} chuỗi)</strong>
          </summary>
          <div className="table-scroll" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Mã chuỗi</th>
                  <th>Tên chỉ số</th>
                  <th>Tần suất</th>
                  <th>Đơn vị</th>
                  <th className="number">Số quan sát</th>
                  <th>Dải ngày</th>
                </tr>
              </thead>
              <tbody>
                {macroCoverage.data.map(m => (
                  <tr key={m.code}>
                    <td><strong>{m.code}</strong></td>
                    <td>{m.name}</td>
                    <td>{m.frequency}</td>
                    <td>{m.unit}</td>
                    <td className="number">{Number(m.observation_count).toLocaleString('vi-VN')}</td>
                    <td><small>{safeText(m.first_period_end)} → {safeText(m.last_period_end)}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {selectedDetail && (
        <Drawer
          title={`Chi tiết độ phủ mã ${selectedDetail.symbol}`}
          subtitle={`Phiên giao dịch gần nhất: ${latestTradingWeekday}`}
          onClose={() => setSelectedSymbol(null)}
        >
          <div className="detail-section">
            <div className="eyebrow">TÌNH TRẠNG HIỆN TẠI</div>
            <div className="detail-grid">
              <div>
                <span>Mã chứng khoán</span>
                <b>{selectedDetail.symbol}</b>
              </div>
              <div>
                <span>Trạng thái độ phủ</span>
                <Badge tone={selectedDetail.status === 'HEALTHY' ? 'green' : selectedDetail.status === 'GAP_PRICE' ? 'amber' : 'red'}>
                  {selectedDetail.status === 'HEALTHY' ? 'Đầy đủ' : selectedDetail.status === 'GAP_PRICE' ? 'Thiếu giá' : 'Thiếu BCTC'}
                </Badge>
              </div>
              <div>
                <span>Số phiên giá canonical</span>
                <b>{selectedDetail.dailyPrices.toLocaleString('vi-VN')}</b>
              </div>
              <div>
                <span>Dải ngày giá hiện có</span>
                <b>{selectedDetail.firstPrice} → {selectedDetail.lastPrice}</b>
              </div>
              <div>
                <span>Báo cáo tài chính</span>
                <b>{selectedDetail.canonicalStatements} báo cáo</b>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="eyebrow">PHÂN TÍCH KHOẢNG THIẾU TỪ BACKEND (LỊCH GIAO DỊCH CHUẨN)</div>
            {gapsQuery.isFetching ? (
              <p className="subtle">Đang đối chiếu lịch giao dịch sàn...</p>
            ) : gapsQuery.data ? (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <div>
                    <span className="subtle" style={{ fontSize: '0.75rem' }}>Tổng phiên sàn: </span>
                    <b>{gapsQuery.data.totalCalendarDays ?? '—'}</b>
                  </div>
                  <div>
                    <span className="subtle" style={{ fontSize: '0.75rem' }}>Đã có canonical: </span>
                    <b>{gapsQuery.data.presentDays ?? '—'}</b>
                  </div>
                  <div>
                    <span className="subtle" style={{ fontSize: '0.75rem' }}>Số phiên thiếu: </span>
                    <strong style={{ color: gapsQuery.data.missingCount > 0 ? 'var(--negative, #ef4444)' : 'var(--positive, #10b981)' }}>
                      {gapsQuery.data.missingCount} phiên
                    </strong>
                  </div>
                </div>
                {gapsQuery.data.missingDates && gapsQuery.data.missingDates.length > 0 ? (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--negative, #ef4444)' }}>Các phiên thiếu theo lịch:</span>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: 4 }}>
                      {gapsQuery.data.missingDates.map(d => (
                        <Badge key={d} tone="red">{d}</Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="subtle" style={{ color: 'var(--positive, #10b981)', margin: '0.25rem 0' }}>
                    ✓ Không phát hiện phiên giao dịch nào bị thiếu so với lịch sàn VNINDEX.
                  </p>
                )}
              </div>
            ) : (
              <p className="subtle">Chưa có dữ liệu phân tích khoảng thiếu.</p>
            )}
          </div>

          <div className="detail-section">
            <div className="eyebrow">CẤU HÌNH BÙ ĐẮP BÁO CÁO TÀI CHÍNH</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 2 }}>Loại BCTC</label>
                <select
                  value={selectedStatementType}
                  onChange={e => setSelectedStatementType(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="balance_sheet">Cân đối kế toán</option>
                  <option value="income_statement">Kết quả kinh doanh</option>
                  <option value="cash_flow">Lưu chuyển tiền tệ</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 2 }}>Kỳ báo cáo</label>
                <select
                  value={selectedPeriod}
                  onChange={e => setSelectedPeriod(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="quarter">Theo quý</option>
                  <option value="year">Theo năm</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: 2 }}>Nguồn cung cấp</label>
                <select
                  value={selectedSource}
                  onChange={e => setSelectedSource(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {statementProviders.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="eyebrow">HÀNH ĐỘNG KHẮC PHỤC QUA WORKFLOW</div>
            <p>
              Chọn hành động để chuyển thẳng sang màn hình <strong>Luồng dữ liệu</strong> kèm các tham số đã được điền sẵn:
            </p>
            <div className="toolbar" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button
                className="primary-button"
                disabled={selectedDetail.status === 'HEALTHY'}
                onClick={() => {
                  remediatePrice(selectedDetail.symbol, selectedDetail.lastPrice);
                }}
              >
                <PlayCircle size={15} style={{ marginRight: 4 }} />
                Mở luồng bù đắp giá ({selectedDetail.symbol})
              </button>
              <button
                className="light-button"
                onClick={() => {
                  remediateStatement(selectedDetail.symbol, selectedStatementType, selectedPeriod, selectedSource);
                }}
              >
                <Database size={15} style={{ marginRight: 4 }} />
                Mở luồng lấy BCTC ({selectedDetail.symbol})
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </Panel>
  );
}
