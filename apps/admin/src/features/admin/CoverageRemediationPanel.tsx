import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Database, ExternalLink, Filter, PlayCircle, RefreshCw, Search } from 'lucide-react';
import { API_BASE, getJson } from '../../shared/api/client';
import { Badge, Drawer, Panel, QueryState } from '../../shared/components/Ui';
import { dateTime, safeText } from '../../shared/utils/format';
import type { WorkflowSelection } from './WorkflowPage';

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
  official_documents?: number | string;
  reviewed_facts?: number | string;
  officialAdapterSupported?: boolean;
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

export function CoverageRemediationPanel({ onWorkflow }: { onWorkflow?: (selection: WorkflowSelection) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'GAP_PRICE' | 'GAP_STATEMENTS' | 'HEALTHY'>('ALL');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

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
      const isPriceGap = prices === 0 || (lastPrice && lastPrice < '2026-11-19');
      const isStatementGap = stmts === 0;

      let status: 'HEALTHY' | 'GAP_PRICE' | 'GAP_STATEMENTS' = 'HEALTHY';
      if (isPriceGap) status = 'GAP_PRICE';
      else if (isStatementGap) status = 'GAP_STATEMENTS';

      return {
        symbol: priceRow.symbol,
        dailyPrices: prices,
        firstPrice: priceRow.first_price ? priceRow.first_price.slice(0, 10) : '—',
        lastPrice: lastPrice || '—',
        missingAdjusted: Number(priceRow.missing_adjusted_close || 0),
        canonicalStatements: stmts,
        missingPub: Number(stmtRow?.missing_publication || 0),
        officialDocs: Number(stmtRow?.official_documents || 0),
        status,
      };
    });
  }, [priceCoverage.data, statementMap]);

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

  const remediatePrice = (symbol: string, lastPrice: string) => {
    const nextDate = lastPrice && lastPrice !== '—'
      ? (() => {
          const d = new Date(lastPrice);
          d.setDate(d.getDate() + 1);
          return d.toISOString().slice(0, 10);
        })()
      : '2021-01-01';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    onWorkflow?.({
      mode: 'INGEST_VALIDATE_BUILD',
      operation: 'OHLCV',
      source: 'VNDIRECT',
      symbol,
      startDate: nextDate,
      endDate: today,
      reason: `Bổ sung khoảng thiếu giá lịch sử cho mã ${symbol} từ ${nextDate} đến ${today}`,
    });
  };

  const remediateStatement = (symbol: string) => {
    onWorkflow?.({
      mode: 'INGEST_VALIDATE_BUILD',
      operation: 'FINANCIAL_STATEMENT',
      source: 'VNDIRECT',
      symbol,
      statement: 'balance_sheet',
      period: 'quarter',
      reason: `Lấy và cập nhật báo cáo tài chính cho mã ${symbol}`,
    });
  };

  return (
    <Panel
      title="Ma trận độ phủ & Xử lý khoảng thiếu dữ liệu"
      eyebrow="GIÁM SÁT & BÙ ĐẮP DỮ LIỆU"
      note="Kiểm tra độ phủ thực tế từ database: phát hiện khoảng thiếu theo mã/kỳ và 1-click kích hoạt workflow xử lý."
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

      <div className="toolbar filters">
        <label>
          <Search size={14} style={{ display: 'inline', marginRight: 4 }} />
          Tìm mã
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="FPT, VNM, HPG…"
            style={{ textTransform: 'uppercase' }}
          />
        </label>

        <label>
          <Filter size={14} style={{ display: 'inline', marginRight: 4 }} />
          Trạng thái dữ liệu
          <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}>
            <option value="ALL">Tất cả ({combinedRows.length})</option>
            <option value="GAP_PRICE">Cần cập nhật giá ({combinedRows.filter(r => r.status === 'GAP_PRICE').length})</option>
            <option value="GAP_STATEMENTS">Thiếu BCTC ({combinedRows.filter(r => r.status === 'GAP_STATEMENTS').length})</option>
            <option value="HEALTHY">Đầy đủ ({combinedRows.filter(r => r.status === 'HEALTHY').length})</option>
          </select>
        </label>
        <span className="subtle">{filteredRows.length} mã hiển thị</span>
      </div>

      <QueryState
        query={priceCoverage}
        empty="Chưa có dữ liệu độ phủ giá."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã CK</th>
                <th>Số phiên giá</th>
                <th>Dải ngày giá</th>
                <th>BCTC canonical</th>
                <th>Thiếu ngày CB</th>
                <th>Tài liệu công bố</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Hành động xử lý</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => (
                <tr key={row.symbol}>
                  <td>
                    <button
                      className="text-button"
                      style={{ fontWeight: 'bold' }}
                      onClick={() => setSelectedSymbol(row.symbol)}
                    >
                      {row.symbol}
                    </button>
                  </td>
                  <td>{row.dailyPrices.toLocaleString('vi-VN')}</td>
                  <td>
                    <small>
                      {row.firstPrice} → {row.lastPrice}
                    </small>
                  </td>
                  <td>{row.canonicalStatements}</td>
                  <td>{row.missingPub > 0 ? <span style={{ color: 'var(--warning, #f59e0b)' }}>{row.missingPub}</span> : '0'}</td>
                  <td>{row.officialDocs}</td>
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
                    <button
                      className="light-button"
                      style={{ marginRight: 6 }}
                      title="Bù đắp dữ liệu giá thiếu qua Workflow"
                      onClick={() => remediatePrice(row.symbol, row.lastPrice)}
                    >
                      <PlayCircle size={13} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                      Bù giá
                    </button>
                    <button
                      className="light-button"
                      title="Lấy BCTC cập nhật qua Workflow"
                      onClick={() => remediateStatement(row.symbol)}
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
                  <th>Số quan sát</th>
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
                    <td>{Number(m.observation_count).toLocaleString('vi-VN')}</td>
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
          subtitle="Phân tích tình trạng dữ liệu và giải pháp khắc phục"
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
              <div>
                <span>Tài liệu công bố chính thức</span>
                <b>{selectedDetail.officialDocs} tài liệu</b>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="eyebrow">HÀNH ĐỘNG KHẮC PHỤC (REMEDIATION)</div>
            <p>
              Bấm vào hành động dưới đây để tự động mở màn hình <strong>Luồng dữ liệu</strong> kèm các tham số đã được điền sẵn theo khoảng thiếu.
            </p>
            <div className="toolbar" style={{ marginTop: '0.75rem' }}>
              <button
                className="primary-button"
                onClick={() => {
                  const sym = selectedDetail.symbol;
                  const lp = selectedDetail.lastPrice;
                  setSelectedSymbol(null);
                  remediatePrice(sym, lp);
                }}
              >
                <PlayCircle size={15} style={{ marginRight: 4 }} />
                Mở luồng bù đắp giá ({selectedDetail.symbol})
              </button>
              <button
                className="light-button"
                onClick={() => {
                  const sym = selectedDetail.symbol;
                  setSelectedSymbol(null);
                  remediateStatement(sym);
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
