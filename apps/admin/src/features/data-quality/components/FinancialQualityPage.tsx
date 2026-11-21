import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Database, ExternalLink, FileText, GitCompare, RefreshCw, RotateCcw, Search, ShieldAlert, Wrench } from 'lucide-react';
import { API_BASE, getJson, postJson } from '../../../shared/api/client';
import { Badge, Drawer, Panel, QueryState } from '../../../shared/components/Ui';
import { dateTime, safeText } from '../../../shared/utils/format';

interface FinancialStatus {
  symbol: string;
  canonical: {
    canonical_statements: number | string;
    missing_publication: number | string;
    missing_scope: number | string;
    missing_revision: number | string;
    missing_unit: number | string;
  };
  officialDocuments: number | string;
  trainingReadiness: string;
  supportedOfficialIssuers: string[];
  serverTime: string;
}

interface DisclosureDocument {
  id: string;
  document_id: string;
  symbol: string;
  title?: string;
  document_title?: string;
  published_on?: string;
  period_end?: string;
  report_scope?: string;
  document_url?: string;
  source_code?: string;
  observed_at?: string;
  [key: string]: unknown;
}

interface BindingRow {
  id: string;
  item_code: string;
  period_end: string;
  canonical_value: string | number | null;
  document_value: string | number | null;
  comparison: string;
  report_scope: string;
  period_basis: string;
  source_page?: number | string;
  usable_from: string;
  stale_binding: boolean;
  observed_value_available: boolean;
  [key: string]: unknown;
}

export function FinancialQualityPage() {
  const [symbol, setSymbol] = useState('FPT');
  const [activeTab, setActiveTab] = useState<'status' | 'disclosures' | 'bindings' | 'recalculate'>('status');
  
  // Refresh disclosures modal state
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [refreshYear, setRefreshYear] = useState<number>(new Date().getFullYear());
  const [refreshPage, setRefreshPage] = useState<number>(1);

  // Recalculate metrics modal state
  const [showRecalcModal, setShowRecalcModal] = useState(false);
  const [recalcFrom, setRecalcFrom] = useState('2024-01-01');
  const [recalcTo, setRecalcTo] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [recalcReason, setRecalcReason] = useState('Tính toán lại chỉ số sau khi chuẩn hóa BCTC');

  // Review legacy state
  const [showLegacyModal, setShowLegacyModal] = useState(false);
  const [legacyReason, setLegacyReason] = useState('Rà soát nguồn gốc giá và BCTC cũ');

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['financial-data-status', symbol],
    queryFn: () => getJson<FinancialStatus>(API_BASE, `/api/admin/financial-data/status?symbol=${encodeURIComponent(symbol)}`),
    staleTime: 60000,
  });

  const disclosuresQuery = useQuery({
    queryKey: ['financial-data-disclosures', symbol],
    queryFn: () => getJson<DisclosureDocument[]>(API_BASE, `/api/admin/financial-data/disclosures?symbol=${encodeURIComponent(symbol)}&limit=100`),
    staleTime: 60000,
    enabled: activeTab === 'disclosures',
  });

  const reconciliationQuery = useQuery({
    queryKey: ['financial-data-reconciliation', symbol],
    queryFn: () => getJson<unknown[]>(API_BASE, `/api/admin/financial-data/reconciliation?symbol=${encodeURIComponent(symbol)}`),
    staleTime: 60000,
    enabled: activeTab === 'bindings',
  });

  const bindingsQuery = useQuery({
    queryKey: ['financial-data-bindings', symbol],
    queryFn: () => {
      const asOf = new Date().toISOString();
      return getJson<BindingRow[]>(API_BASE, `/api/admin/financial-data/bindings?symbol=${encodeURIComponent(symbol)}&asOf=${encodeURIComponent(asOf)}&limit=100`);
    },
    staleTime: 60000,
    enabled: activeTab === 'bindings',
  });

  // Mutations
  const refreshDisclosuresMutation = useMutation({
    mutationFn: () => postJson(API_BASE, '/api/admin/financial-data/disclosures/refresh', {
      symbol,
      year: refreshYear,
      page: refreshPage,
    }),
    onSuccess: (res: any) => {
      setActionMessage(`Đã tải lại công bố thành công. Lưu ${res?.insertedDocuments || res?.savedDocuments || '0'} tài liệu (Run ID: ${res?.ingestionRunId || '—'}).`);
      setShowRefreshModal(false);
      void queryClient.invalidateQueries({ queryKey: ['financial-data-disclosures', symbol] });
      void queryClient.invalidateQueries({ queryKey: ['financial-data-status', symbol] });
    },
    onError: (err: Error) => {
      setActionMessage(`Lỗi tải lại công bố: ${err.message}`);
    },
  });

  const reconcileBindingsMutation = useMutation({
    mutationFn: () => postJson(API_BASE, '/api/admin/financial-data/bindings/reconcile', { symbol }),
    onSuccess: (res: any) => {
      setActionMessage(`Đã đối chiếu liên kết thành công. Bổ sung ${res?.insertedBindings || 0} bản ghi binding.`);
      void queryClient.invalidateQueries({ queryKey: ['financial-data-bindings', symbol] });
      void queryClient.invalidateQueries({ queryKey: ['financial-data-reconciliation', symbol] });
    },
    onError: (err: Error) => {
      setActionMessage(`Lỗi đối chiếu liên kết: ${err.message}`);
    },
  });

  const recalculateMetricsMutation = useMutation({
    mutationFn: () => postJson(API_BASE, '/api/admin/financial-data/metrics/recalculate', {
      symbol,
      from: recalcFrom,
      to: recalcTo,
      reason: recalcReason,
    }),
    onSuccess: (res: any) => {
      setActionMessage(`Tính lại chỉ số thành công. Số bản ghi cập nhật: ${res?.calculatedCount || res?.count || 0}.`);
      setShowRecalcModal(false);
    },
    onError: (err: Error) => {
      setActionMessage(`Lỗi tính lại chỉ số: ${err.message}`);
    },
  });

  const reviewLegacyMutation = useMutation({
    mutationFn: () => postJson(API_BASE, `/api/admin/financial-data/quality/review-legacy/${encodeURIComponent(symbol)}`, {}),
    onSuccess: (res: any) => {
      setActionMessage(`Rà soát dữ liệu cũ thành công. Phiên giá gán nhãn: ${res?.annotatedPrices || 0}.`);
      setShowLegacyModal(false);
      void queryClient.invalidateQueries({ queryKey: ['financial-data-status', symbol] });
    },
    onError: (err: Error) => {
      setActionMessage(`Lỗi rà soát dữ liệu cũ: ${err.message}`);
    },
  });

  const status = statusQuery.data;

  return (
    <div className="admin-stack">
      <Panel
        title="Quản trị Chất lượng Báo cáo Tài chính & Tài liệu Công bố"
        eyebrow="FINANCIAL STATEMENT QUALITY & DISCLOSURES"
        note="Độ phủ BCTC, đối chiếu tài liệu chính thức của doanh nghiệp, kiểm định bindings và tính toán lại chỉ số tài chính."
        action={
          <button
            className="text-button"
            onClick={() => {
              void statusQuery.refetch();
              if (activeTab === 'disclosures') void disclosuresQuery.refetch();
              if (activeTab === 'bindings') {
                void reconciliationQuery.refetch();
                void bindingsQuery.refetch();
              }
            }}
          >
            <RefreshCw size={14} /> Tải lại
          </button>
        }
      >
        {/* Symbol Selector Bar */}
        <div className="toolbar filters" style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            Mã chứng khoán:
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              style={{ width: '120px', padding: '0.35rem 0.6rem', fontWeight: 700 }}
              placeholder="VD: FPT"
            />
          </label>

          <span className="subtle">
            Tổ chức phát hành hỗ trợ công bố chính thức: {status?.supportedOfficialIssuers?.join(', ') || 'HPG, HSG, VNM, ACB, EIB'}
          </span>
        </div>

        {actionMessage && (
          <div className="mini-record" style={{ marginBottom: '1rem', background: 'var(--panel-alt, #f8fafc)', borderLeft: '4px solid var(--accent, #3b82f6)' }}>
            <strong>Thông báo thao tác:</strong> {actionMessage}
            <button className="text-button" style={{ marginLeft: 8 }} onClick={() => setActionMessage(null)}>Đóng</button>
          </div>
        )}

        {/* Tab navigation */}
        <div className="tabs" role="tablist" style={{ marginBottom: '1rem' }}>
          <button
            role="tab"
            aria-selected={activeTab === 'status'}
            className={activeTab === 'status' ? 'active' : ''}
            onClick={() => setActiveTab('status')}
          >
            Độ phủ &amp; Tình trạng BCTC
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'disclosures'}
            className={activeTab === 'disclosures' ? 'active' : ''}
            onClick={() => setActiveTab('disclosures')}
          >
            Tài liệu công bố chính thức ({status?.officialDocuments ?? '—'})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'bindings'}
            className={activeTab === 'bindings' ? 'active' : ''}
            onClick={() => setActiveTab('bindings')}
          >
            Đối chiếu &amp; Bindings
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'recalculate'}
            className={activeTab === 'recalculate' ? 'active' : ''}
            onClick={() => setActiveTab('recalculate')}
          >
            Tính lại chỉ số tài chính
          </button>
        </div>

        {/* Tab 1: Status & Coverage */}
        {activeTab === 'status' && (
          <QueryState query={statusQuery} empty={`Chưa có dữ liệu độ phủ BCTC cho mã ${symbol}.`}>
            {status && (
              <div className="admin-stack">
                <div className="count-grid">
                  <div>
                    <strong>{Number(status.canonical?.canonical_statements || 0).toLocaleString('vi-VN')}</strong>
                    <span>Báo cáo canonical</span>
                  </div>
                  <div>
                    <strong style={{ color: Number(status.canonical?.missing_publication || 0) > 0 ? 'var(--warning, #f59e0b)' : 'inherit' }}>
                      {status.canonical?.missing_publication || 0}
                    </strong>
                    <span>Thiếu ngày công bố</span>
                  </div>
                  <div>
                    <strong style={{ color: Number(status.canonical?.missing_scope || 0) > 0 ? 'var(--warning, #f59e0b)' : 'inherit' }}>
                      {status.canonical?.missing_scope || 0}
                    </strong>
                    <span>Chưa rõ phạm vi (hợp nhất/riêng)</span>
                  </div>
                  <div>
                    <strong>{Number(status.officialDocuments || 0).toLocaleString('vi-VN')}</strong>
                    <span>Tài liệu công bố chính thức</span>
                  </div>
                </div>

                <div className="detail-section" style={{ marginTop: '1rem' }}>
                  <div className="eyebrow">ĐÁNH GIÁ READINESS DỮ LIỆU HUẤN LUYỆN AI</div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                    <Badge tone="amber">{status.trainingReadiness || 'REQUIRES_VALUE_VINTAGE_REVIEW'}</Badge>
                    <span>
                      Dữ liệu báo cáo của {symbol} yêu cầu rà soát nhãn kỳ và đối chiếu tài liệu trước khi đưa vào huấn luyện mô hình.
                    </span>
                  </div>
                </div>

                <div className="toolbar" style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="primary-button"
                    onClick={() => setShowLegacyModal(true)}
                  >
                    <Wrench size={14} style={{ marginRight: 4 }} />
                    Rà soát dữ liệu cũ (Review Legacy)
                  </button>
                  <button
                    className="light-button"
                    onClick={() => setShowRefreshModal(true)}
                  >
                    <DownloadIcon size={14} style={{ marginRight: 4 }} />
                    Tải lại tài liệu công bố chính thức
                  </button>
                </div>
              </div>
            )}
          </QueryState>
        )}

        {/* Tab 2: Disclosures */}
        {activeTab === 'disclosures' && (
          <div className="admin-stack">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Tài liệu công bố chính thức từ doanh nghiệp ({symbol})</h3>
                <span className="subtle">Lấy trực tiếp từ cổng thông tin quan hệ nhà đầu tư (IR)</span>
              </div>
              <button
                className="primary-button"
                onClick={() => setShowRefreshModal(true)}
              >
                <RefreshCw size={14} style={{ marginRight: 4 }} />
                Tải lại công bố
              </button>
            </div>

            <QueryState query={disclosuresQuery} empty={`Chưa có tài liệu công bố nào được thu thập cho mã ${symbol}.`}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Document ID</th>
                      <th>Tiêu đề tài liệu</th>
                      <th>Ngày công bố</th>
                      <th>Kỳ kết thúc</th>
                      <th>Phạm vi</th>
                      <th>Nguồn</th>
                      <th>Liên kết gốc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(disclosuresQuery.data || []).map((doc, idx) => (
                      <tr key={doc.id || doc.document_id || idx}>
                        <td><code>{String(doc.document_id || doc.id).slice(0, 16)}</code></td>
                        <td><strong>{safeText(doc.title || doc.document_title || 'Tài liệu công bố')}</strong></td>
                        <td>{safeText(doc.published_on)}</td>
                        <td>{safeText(doc.period_end)}</td>
                        <td><Badge tone="neutral">{safeText(doc.report_scope || 'CONSOLIDATED')}</Badge></td>
                        <td>{safeText(doc.source_code)}</td>
                        <td>
                          {doc.document_url ? (
                            <a href={doc.document_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              Tải về <ExternalLink size={12} />
                            </a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </div>
        )}

        {/* Tab 3: Bindings */}
        {activeTab === 'bindings' && (
          <div className="admin-stack">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Bảng đối chiếu chỉ tiêu BCTC vs Tài liệu công bố ({symbol})</h3>
                <span className="subtle">Xác nhận tính chính xác của từng dòng số liệu BCTC đã chuẩn hóa</span>
              </div>
              <button
                className="primary-button"
                disabled={reconcileBindingsMutation.isPending}
                onClick={() => reconcileBindingsMutation.mutate()}
              >
                <GitCompare size={14} style={{ marginRight: 4 }} />
                {reconcileBindingsMutation.isPending ? 'Đang đối chiếu…' : 'Đối chiếu liên kết (Reconcile Bindings)'}
              </button>
            </div>

            <QueryState query={bindingsQuery} empty={`Chưa có bản ghi binding được đối chiếu cho mã ${symbol}. Bấm "Đối chiếu liên kết" để kích hoạt.`}>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Chỉ tiêu (Item Code)</th>
                      <th>Kỳ kết thúc</th>
                      <th className="number">Giá trị Canonical</th>
                      <th className="number">Giá trị trong tài liệu</th>
                      <th>Kết quả so khớp</th>
                      <th>Phạm vi / Cơ sở</th>
                      <th>Hiệu lực từ</th>
                      <th>Trạng thái sử dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bindingsQuery.data || []).map((row, idx) => (
                      <tr key={row.id || idx}>
                        <td><strong>{row.item_code}</strong></td>
                        <td>{safeText(row.period_end)}</td>
                        <td className="number">{Number(row.canonical_value).toLocaleString('vi-VN')}</td>
                        <td className="number">{Number(row.document_value).toLocaleString('vi-VN')}</td>
                        <td>
                          <Badge tone={row.comparison === 'EXACT_VALUE_MATCH' ? 'green' : 'red'}>
                            {row.comparison === 'EXACT_VALUE_MATCH' ? 'Khớp chính xác' : 'Lệch số liệu'}
                          </Badge>
                        </td>
                        <td>{row.report_scope} · {row.period_basis}</td>
                        <td><small>{dateTime(row.usable_from)}</small></td>
                        <td>
                          <Badge tone={row.observed_value_available ? 'green' : 'neutral'}>
                            {row.observed_value_available ? 'Sẵn sàng dùng' : 'Chưa khả dụng'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </div>
        )}

        {/* Tab 4: Recalculate Metrics */}
        {activeTab === 'recalculate' && (
          <div className="admin-stack">
            <h3>Tính toán lại Chỉ số Tài chính (Financial Metrics Engine)</h3>
            <p className="subtle">
              Kích hoạt động cơ Java tính lại toàn bộ các chỉ số phái sinh (P/E, P/B, ROE, ROA, biên lợi nhuận, đòn bẩy nợ) cho mã {symbol} theo dải thời gian.
            </p>

            <div style={{ maxWidth: '480px', marginTop: '1rem', background: 'var(--panel-alt, #f8fafc)', padding: '1rem', borderRadius: 4, border: '1px solid var(--border, #e2e8f0)' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 3 }}>Mã chứng khoán</label>
                <input type="text" value={symbol} disabled style={{ width: '100%', fontWeight: 700 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 3 }}>Từ ngày</label>
                  <input type="date" value={recalcFrom} onChange={e => setRecalcFrom(e.target.value)} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 3 }}>Đến ngày</label>
                  <input type="date" value={recalcTo} onChange={e => setRecalcTo(e.target.value)} style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 3 }}>Lý do tính lại (Audit reason)</label>
                <input
                  type="text"
                  value={recalcReason}
                  onChange={e => setRecalcReason(e.target.value)}
                  placeholder="Nhập lý do thực hiện tính lại chỉ số..."
                  style={{ width: '100%' }}
                />
              </div>

              <button
                className="primary-button"
                disabled={recalculateMetricsMutation.isPending || !recalcReason.trim()}
                onClick={() => recalculateMetricsMutation.mutate()}
                style={{ width: '100%' }}
              >
                <Wrench size={14} style={{ marginRight: 4 }} />
                {recalculateMetricsMutation.isPending ? 'Đang tính toán…' : 'Bắt đầu tính toán lại chỉ số'}
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* Modal Refresh Disclosures */}
      {showRefreshModal && (
        <Drawer
          title={`Tải lại công bố chính thức cho mã ${symbol}`}
          subtitle="Gửi yêu cầu crawler thu thập tài liệu BCTC gốc"
          onClose={() => setShowRefreshModal(false)}
        >
          <div className="detail-section">
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 3 }}>Năm tài chính</label>
              <input
                type="number"
                value={refreshYear}
                onChange={e => setRefreshYear(Number(e.target.value))}
                min={2000}
                max={2099}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 3 }}>Trang kết quả</label>
              <input
                type="number"
                value={refreshPage}
                onChange={e => setRefreshPage(Number(e.target.value))}
                min={1}
                max={100}
                style={{ width: '100%' }}
              />
            </div>

            <div className="toolbar" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="primary-button"
                disabled={refreshDisclosuresMutation.isPending}
                onClick={() => refreshDisclosuresMutation.mutate()}
              >
                {refreshDisclosuresMutation.isPending ? 'Đang gửi…' : 'Xác nhận tải lại'}
              </button>
              <button className="light-button" onClick={() => setShowRefreshModal(false)}>
                Hủy
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Modal Review Legacy */}
      {showLegacyModal && (
        <Drawer
          title={`Rà soát dữ liệu lịch sử cho mã ${symbol}`}
          subtitle="Đồng bộ lại nhãn UNADJUSTED và chuẩn hóa canonical version"
          onClose={() => setShowLegacyModal(false)}
        >
          <div className="detail-section">
            <p>
              Quy trình này sẽ rà soát lại toàn bộ raw payloads của mã <strong>{symbol}</strong>, cập nhật metadata giá về chuẩn <code>UNADJUSTED</code> và đồng bộ hóa phiên bản canonical ACTIVATED.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: 3 }}>Lý do rà soát</label>
              <input
                type="text"
                value={legacyReason}
                onChange={e => setLegacyReason(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div className="toolbar" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="primary-button"
                disabled={reviewLegacyMutation.isPending || !legacyReason.trim()}
                onClick={() => reviewLegacyMutation.mutate()}
              >
                {reviewLegacyMutation.isPending ? 'Đang thực hiện…' : 'Xác nhận rà soát'}
              </button>
              <button className="light-button" onClick={() => setShowLegacyModal(false)}>
                Hủy
              </button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

function DownloadIcon({ size = 14, style }: { size?: number; style?: React.CSSProperties }) {
  return <Database size={size} style={style} />;
}
