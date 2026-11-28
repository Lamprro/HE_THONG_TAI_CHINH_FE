import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Wrench } from 'lucide-react';
import { API_BASE, getJson, postJson } from '../../../shared/api/client';
import { Badge, Drawer, Panel, QueryState } from '../../../shared/components/Ui';

interface FinancialStatus {
  symbol: string;
  canonical: {
    canonical_statements: number | string;
    missing_publication: number | string;
    missing_scope: number | string;
    missing_revision: number | string;
    missing_unit: number | string;
  };
  trainingReadiness: string;
  serverTime: string;
}

export function FinancialQualityPage() {
  const [symbol, setSymbol] = useState('FPT');
  const [activeTab, setActiveTab] = useState<'status' | 'recalculate'>('status');

  // Recalculate metrics modal state
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

  const recalculateMetricsMutation = useMutation({
    mutationFn: () => postJson(API_BASE, '/api/admin/financial-data/metrics/recalculate', {
      symbol,
      startDate: recalcFrom,
      endDate: recalcTo,
    }),
    onSuccess: (res: any) => {
      setActionMessage(`Tính lại chỉ số thành công. Báo cáo nguồn: ${res?.sourceStatements ?? 0}, chèn mới: ${res?.inserted ?? 0}, giữ nguyên: ${res?.unchanged ?? 0}.`);
    },
    onError: (err: Error) => {
      setActionMessage(`Lỗi tính lại chỉ số: ${err.message}`);
    },
  });

  const reviewLegacyMutation = useMutation({
    mutationFn: () => postJson(API_BASE, `/api/admin/financial-data/quality/review-legacy/${encodeURIComponent(symbol)}`, {
      reason: legacyReason,
    }),
    onSuccess: (res: any) => {
      setActionMessage(`Rà soát dữ liệu cũ thành công. Phiên giá xác thực: ${res?.priceRowsVerified ?? 0}, metadata BCTC: ${res?.statementMetadataReviewed ?? 0}.`);
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
        title="Chất lượng báo cáo tài chính"
        action={
          <button
            className="text-button"
            onClick={() => void statusQuery.refetch()}
          >
            <RefreshCw size={14} /> Tải lại
          </button>
        }
      >
        {/* Symbol Selector Bar */}
        <div className="toolbar filters">
          <label className="compact-filter">
            Mã chứng khoán:
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="VD: FPT"
            />
          </label>
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
                    <strong>{Number(status.canonical?.missing_unit || 0).toLocaleString('vi-VN')}</strong>
                    <span>Thiếu đơn vị hoặc loại tiền</span>
                  </div>
                </div>

                <div className="detail-section" style={{ marginTop: '1rem' }}>
                  <div className="eyebrow">ĐÁNH GIÁ READINESS DỮ LIỆU HUẤN LUYỆN AI</div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                    <Badge tone="amber">{status.trainingReadiness || 'REQUIRES_VALUE_VINTAGE_REVIEW'}</Badge>
                    <span>
                      Dữ liệu báo cáo của {symbol} yêu cầu rà soát kỳ báo cáo, nguồn và thời điểm công bố trước khi đưa vào huấn luyện mô hình.
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
                </div>
              </div>
            )}
          </QueryState>
        )}

        {activeTab === 'recalculate' && (
          <div className="admin-stack">
            <h3>Tính toán lại Chỉ số Tài chính (Financial Metrics Engine)</h3>
            <p className="subtle">
              Kích hoạt động cơ Java tính lại toàn bộ các chỉ số phái sinh (P/E, P/B, ROE, ROA, biên lợi nhuận, đòn bẩy nợ) cho mã {symbol} theo dải thời gian.
            </p>

            <div style={{ maxWidth: '480px', marginTop: '1rem', background: 'var(--panel-alt, #f8fafc)', padding: '1rem', borderRadius: 4, border: '1px solid var(--border, #e2e8f0)' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label>Mã chứng khoán<input type="text" value={symbol} disabled /></label>
              </div>
              <div className="admin-form-grid" style={{ marginBottom: '0.75rem' }}>
                <label>Từ ngày<input type="date" value={recalcFrom} onChange={e => setRecalcFrom(e.target.value)} /></label>
                <label>Đến ngày<input type="date" value={recalcTo} onChange={e => setRecalcTo(e.target.value)} /></label>
              </div>
              <label className="ledger-field">Lý do tính lại
                <input
                  type="text"
                  value={recalcReason}
                  onChange={e => setRecalcReason(e.target.value)}
                  placeholder="Nhập lý do thực hiện tính lại chỉ số..."
                />
              </label>

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
