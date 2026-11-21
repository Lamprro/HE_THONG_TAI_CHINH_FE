import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Bot, CheckCircle2, Database, ExternalLink, Play, RefreshCw, RotateCcw, ShieldAlert, Sparkles, Upload } from 'lucide-react';
import { API_BASE, getJson, postJson } from '../../shared/api/client';
import { Badge, Drawer, Panel, QueryState } from '../../shared/components/Ui';
import { dateTime, safeText } from '../../shared/utils/format';

interface LocalModel {
  packageId: string;
  registeredAt: string;
  modelId: string;
  kind: string;
  horizonQuarters: number;
  targetPeriod: string;
  selectedAlgorithm: string;
  developmentGatePassed: boolean;
  registeredInputs: string;
  storedSelectedResearchResults: string;
  firstInputAsOf: string | null;
  lastInputAsOf: string | null;
  readiness: string;
  publicResultsAvailable: boolean;
  outputContract?: {
    type: string;
    fields: string[];
    unit?: string;
    note?: string;
  };
}

interface ModelsPageResponse {
  items: LocalModel[];
  total: number;
  page: number;
  size: number;
  hasNext: boolean;
  meta: {
    notes?: string[];
    timezone?: string;
  };
}

interface PackageRecord {
  id: string;
  package_name?: string;
  name?: string;
  version?: string;
  created_at?: string;
  registered_at?: string;
  status?: string;
  description?: string;
  [key: string]: unknown;
}

interface SecurityItem {
  symbol: string;
  exchange: string;
  companyName?: string;
}

interface SuitePackage {
  id: string;
  manifest_sha256: string;
  status: string;
  registered_at: string;
  models?: Array<{ id: string; target_period?: string; role?: string }>;
}

interface SuiteRun {
  id: string;
  request_id: string;
  model_id: string;
  ticker: string;
  role: string;
  status: string;
  error_code?: string;
  http_status?: number;
  latency_ms?: number;
  started_at: string;
  completed_at?: string;
}

interface TrainingRun {
  id: string;
  trigger: 'MANUAL' | 'AUTO';
  reason?: string;
  requested_by?: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED';
  selected_model?: string;
  readiness_sha256?: string;
  snapshot_sha256?: string;
  protocol_version?: string;
  output_path?: string;
  summary?: {
    protocol_version?: string;
    selected_variant?: string;
    selected_model?: string;
    variants?: Record<string, {
      status: string;
      frequency: string;
      target: string;
      selected_model: string;
      auc_dev?: number;
      auc_retro?: number;
      ic_dev?: number;
      ic_retro?: number;
      ic_t_stat?: number;
      win_fraction?: number;
      recall?: number;
      top_minus_bottom_spread?: number;
    }>;
    gate_evaluation?: {
      auc_gain_passed?: boolean;
      auc_gain_value?: number;
      min_ic_t_passed?: boolean;
      min_ic_t_value?: number;
      win_fraction_passed?: boolean;
      win_fraction_value?: number;
      recall_passed?: boolean;
      recall_value?: number;
      all_gates_passed?: boolean;
    };
    research_note?: string;
    disclaimer?: string;
  };
  gate?: {
    all_gates_passed?: boolean;
    auc_gain_passed?: boolean;
    min_ic_t_passed?: boolean;
    win_fraction_passed?: boolean;
    recall_passed?: boolean;
  };
  started_at: string;
  finished_at?: string;
  error?: string;
}

interface ReadinessReport {
  ready_to_train: boolean;
  eligible_stocks: number;
  stock_target: number;
  stocks_with_prices: number;
  total_active_securities: number;
  stock_ohlc_failures: number;
  latest_market_date: string;
  latest_statement_date: string;
  indexes: {
    VNINDEX?: { ready: boolean; valid_days: number; coverage: number };
    VN30?: { ready: boolean; valid_days: number; coverage: number };
  };
  protocol_version: string;
  readiness_sha256: string;
  disclaimer: string;
}

const CONTRACTS_INFO = [
  {
    type: 'FACTOR_COMPOSITE',
    name: 'Điểm tổng hợp đa yếu tố',
    unit: 'COMPOSITE_SCORE',
    target: 'MOM120_RANK + LOW_VOLATILITY',
    note: 'Điểm tổng hợp không fit, dấu cố định: ít biến động, ít sụt giảm, động lượng 2Q/120D/MA200. Dùng cho bài toán xếp hạng (Rank-100).',
  },
  {
    type: 'DIRECTION',
    name: 'Hướng giá tương đối theo quý (H3)',
    unit: 'UNCALIBRATED_SCORE_0_1',
    target: 'UP / NOT_UP',
    note: 'Điểm uncalibrated 0–1, không phải xác suất đã kiểm chứng. Đọc horizonQuarters.',
  },
  {
    type: 'RETURN_QUANTILES',
    name: 'Phân vị lợi suất',
    unit: 'FRACTION',
    target: 'P10, P50, P90',
    note: 'Phân vị lịch sử gộp, không đảm bảo khoảng tin cậy hiệu chỉnh riêng từng mã.',
  },
  {
    type: 'NET_PROFIT_AFTER_TAX',
    name: 'Lợi nhuận sau thuế (NPAT)',
    unit: 'VND',
    target: 'prediction_vnd',
    note: 'Báo cáo hợp nhất (CONSOLIDATED), cơ sở riêng quý (STANDALONE_QUARTER).',
  },
  {
    type: 'ADJUSTED_PRICE_RETURN',
    name: 'Lợi suất giá điều chỉnh',
    unit: 'RETURN_FRACTION',
    target: 'prediction',
    note: 'Dự báo tỷ lệ thay đổi giá đã điều chỉnh cổ tức/thưởng.',
  },
  {
    type: 'ANNUALIZED_LOG_RETURN_VOLATILITY',
    name: 'Biến động giá năm hóa',
    unit: 'VOLATILITY_ANNUALIZED',
    target: 'prediction',
    note: 'Độ biến động log return đóng cửa tính theo năm (chuẩn tên hợp đồng backend).',
  },
  {
    type: 'DRAWDOWN',
    name: 'Mức sụt giảm tối đa',
    unit: 'MAX_DRAWDOWN_FRACTION',
    target: 'prediction',
    note: 'Mức sụt giảm cực đại dự kiến từ đỉnh giá đóng cửa trong kỳ.',
  },
];

export function LocalAiOperationsPanel({ onRun }: { onRun?: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<'packages' | 'training' | 'universe' | 'lookup' | 'contracts' | 'forward'>('training');
  const [selectedTicker, setSelectedTicker] = useState('FPT');
  const [selectedModelDetail, setSelectedModelDetail] = useState<LocalModel | null>(null);
  const [selectedSuitePackageId, setSelectedSuitePackageId] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);

  // Read registered suite packages via backend API
  const suitePackagesQuery = useQuery({
    queryKey: ['admin-local-ai-suite-packages'],
    queryFn: () => getJson<SuitePackage[]>(API_BASE, '/api/admin/local-ai/suite/packages').catch(() => []),
    staleTime: 60000,
  });

  const activeSuitePackageId = selectedSuitePackageId || (suitePackagesQuery.data && suitePackagesQuery.data.length > 0 ? suitePackagesQuery.data[0].id : null);

  const suiteRunsQuery = useQuery({
    queryKey: ['admin-local-ai-suite-runs', activeSuitePackageId],
    queryFn: () => {
      if (!activeSuitePackageId) return Promise.resolve([]);
      return getJson<SuiteRun[]>(API_BASE, `/api/admin/local-ai/suite/packages/${activeSuitePackageId}/runs`).catch(() => []);
    },
    enabled: !!activeSuitePackageId,
    staleTime: 30000,
  });

  const handleRecoverStale = async (pkgId: string) => {
    try {
      setRecovering(true);
      setRecoverMsg(null);
      const res = await postJson<unknown[]>(API_BASE, `/api/admin/local-ai/suite/packages/${pkgId}/recover-stale`, {});
      setRecoverMsg(`Đã thu hồi ${Array.isArray(res) ? res.length : 0} lượt chạy treo.`);
      void suiteRunsQuery.refetch();
    } catch (e) {
      setRecoverMsg(`Không thể thu hồi: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRecovering(false);
    }
  };

  // Read active models from public/admin endpoint
  const modelsQuery = useQuery({
    queryKey: ['admin-local-ai-models'],
    queryFn: () => getJson<ModelsPageResponse>(API_BASE, '/api/v1/local-ai/models?size=100'),
    staleTime: 60000,
  });

  // Read packages from console dataset
  const packagesQuery = useQuery({
    queryKey: ['admin-console-packages'],
    queryFn: () => getJson<{ items: PackageRecord[] }>(API_BASE, '/api/admin/console/data/local_ai_packages').catch(() => ({ items: [] })),
    staleTime: 60000,
  });

  // Read actual HOSE securities for selection
  const securitiesQuery = useQuery({
    queryKey: ['admin-securities-hose'],
    queryFn: () => getJson<{ items: SecurityItem[] }>(API_BASE, '/api/v1/securities?exchange=HOSE&size=100').catch(() => ({ items: [] })),
    staleTime: 300000,
  });

  // Read single ticker progress
  const tickerQuery = useQuery({
    queryKey: ['admin-local-ai-ticker', selectedTicker],
    queryFn: () => getJson<{ data: { state: string; publicResultsAvailable: boolean; executionAvailable: boolean; models: LocalModel[] } }>(
      API_BASE,
      `/api/v1/securities/${selectedTicker}/local-ai?exchange=HOSE`
    ),
    enabled: !!selectedTicker && (activeTab === 'lookup' || activeTab === 'universe'),
    staleTime: 60000,
  });

  // Read readiness for rank training
  const readinessQuery = useQuery({
    queryKey: ['admin-local-ai-readiness'],
    queryFn: () => getJson<ReadinessReport>(API_BASE, '/api/admin/local-ai/readiness').catch(() => null),
    staleTime: 30000,
  });

  // Read training runs history
  const trainingRunsQuery = useQuery({
    queryKey: ['admin-local-ai-training-runs'],
    queryFn: () => getJson<TrainingRun[]>(API_BASE, '/api/admin/local-ai/training-runs').catch(() => []),
    staleTime: 15000,
    refetchInterval: 10000,
  });

  const [showRetrainModal, setShowRetrainModal] = useState(false);
  const [retrainReason, setRetrainReason] = useState('Huấn luyện lại rổ 100 mã và cập nhật kiểm định');
  const [retrainWorkers, setRetrainWorkers] = useState(2);
  const [submittingRetrain, setSubmittingRetrain] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState<string | null>(null);

  const [selectedRun, setSelectedRun] = useState<TrainingRun | null>(null);
  const [publishingRun, setPublishingRun] = useState(false);
  const [publishReason, setPublishReason] = useState('Phê duyệt gói tham khảo FACTOR_COMPOSITE quý tới');
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  const [rollingBack, setRollingBack] = useState(false);
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);

  const handleRetrain = async () => {
    if (!retrainReason.trim()) return;
    try {
      setSubmittingRetrain(true);
      setRetrainMsg(null);
      try {
        const cmdRes = await postJson<{ id: string }>(API_BASE, '/api/admin/console/commands', {
          action: 'LOCAL_AI_RETRAIN',
          reason: retrainReason.trim(),
          idempotencyKey: crypto.randomUUID(),
          input: {
            reason: retrainReason.trim(),
            workers: retrainWorkers,
            trigger: 'MANUAL',
            requestedBy: 'admin',
          },
        });
        if (cmdRes && cmdRes.id && onRun) {
          onRun(cmdRes.id);
        }
      } catch {
        await postJson(API_BASE, '/api/admin/local-ai/retrain', {
          reason: retrainReason.trim(),
          workers: retrainWorkers,
          trigger: 'MANUAL',
        });
      }
      setRetrainMsg('Đã khởi chạy đợt huấn luyện mới. Kiểm tra tiến độ bên dưới.');
      setShowRetrainModal(false);
      void trainingRunsQuery.refetch();
    } catch (e) {
      setRetrainMsg(`Không thể kích hoạt: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSubmittingRetrain(false);
    }
  };

  const handlePublish = async (runId: string) => {
    try {
      setPublishingRun(true);
      setPublishMsg(null);
      await postJson(API_BASE, `/api/admin/local-ai/training-runs/${runId}/publish`, {
        variant: 'V1',
        reason: publishReason.trim(),
      });
      setPublishMsg('Đã phát hành gói thành công với trạng thái ACTIVE trong cơ sở dữ liệu!');
      void packagesQuery.refetch();
      void suitePackagesQuery.refetch();
      void trainingRunsQuery.refetch();
    } catch (e) {
      setPublishMsg(`Không thể phát hành: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPublishingRun(false);
    }
  };

  const handleRollback = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi gói ACTIVE hiện tại và khôi phục gói SUPERSEDED liền trước?')) {
      return;
    }
    try {
      setRollingBack(true);
      setRollbackMsg(null);
      await postJson(API_BASE, '/api/admin/local-ai/rollback', {
        reason: 'Quản trị viên yêu cầu rollback về gói trước',
      });
      setRollbackMsg('Đã rollback thành công!');
      void packagesQuery.refetch();
      void suitePackagesQuery.refetch();
      void trainingRunsQuery.refetch();
    } catch (e) {
      setRollbackMsg(`Không thể rollback: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRollingBack(false);
    }
  };

  const models = modelsQuery.data?.items || [];
  const packages = packagesQuery.data?.items || [];
  const tickers = securitiesQuery.data?.items?.map(s => s.symbol) || ['FPT', 'HPG', 'VNM', 'ACB', 'TCB', 'MWG', 'MSN', 'MBB', 'SSI', 'VHM'];

  return (
    <Panel
      title="Vận hành Local AI & Quản trị mô hình"
      eyebrow="LOCAL AI GOVERNANCE"
      note="Quản trị các mô hình định lượng cục bộ nạp từ database. Tách biệt hoàn toàn với luồng LLM/Gemini."
      action={
        <button
          className="text-button"
          onClick={() => {
            void modelsQuery.refetch();
            void packagesQuery.refetch();
            void tickerQuery.refetch();
          }}
        >
          <RefreshCw size={14} /> Tải lại
        </button>
      }
    >
      <div className="ai-guard" style={{ marginBottom: '1rem' }}>
        <ShieldAlert size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>RANH GIỚI NGHIÊN CỨU (RESEARCH_ONLY) ĐƯỢC BẢO TOÀN</strong>
          <p style={{ margin: '0.25rem 0 0' }}>
            Mọi mô hình Local AI đang ở trạng thái <code>RESEARCH_ONLY</code> (<code>executionAvailable=false</code>, <code>publicResultsAvailable=false</code>).
            Điểm số uncalibrated score không phải là xác suất sinh lời hay khuyến nghị đầu tư. Hệ thống không tự ý promote lên production hoặc công bố ra User khi chưa có đánh giá forward.
          </p>
        </div>
      </div>

      <div className="tabs" role="tablist" style={{ marginBottom: '1rem' }}>
        <button
          role="tab"
          aria-selected={activeTab === 'training'}
          className={activeTab === 'training' ? 'active' : ''}
          onClick={() => setActiveTab('training')}
        >
          Huấn luyện &amp; Phát hành (Phase 4.2)
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'packages'}
          className={activeTab === 'packages' ? 'active' : ''}
          onClick={() => setActiveTab('packages')}
        >
          Gói mô hình trong DB
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'universe'}
          className={activeTab === 'universe' ? 'active' : ''}
          onClick={() => setActiveTab('universe')}
        >
          Rổ cổ phiếu &amp; Readiness
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'lookup'}
          className={activeTab === 'lookup' ? 'active' : ''}
          onClick={() => setActiveTab('lookup')}
        >
          Tra cứu mã &amp; Snapshot
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'contracts'}
          className={activeTab === 'contracts' ? 'active' : ''}
          onClick={() => setActiveTab('contracts')}
        >
          Hợp đồng đầu ra
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'forward'}
          className={activeTab === 'forward' ? 'active' : ''}
          onClick={() => setActiveTab('forward')}
        >
          Lộ trình triển khai (Phase 4)
        </button>
      </div>

      {activeTab === 'training' && (
        <div className="admin-stack">
          {/* Operation alerts */}
          {retrainMsg && (
            <div className="mini-record" style={{ borderLeft: '4px solid var(--positive, #10b981)' }}>
              <p style={{ margin: 0 }}>{retrainMsg}</p>
            </div>
          )}
          {publishMsg && (
            <div className="mini-record" style={{ borderLeft: '4px solid var(--positive, #10b981)' }}>
              <p style={{ margin: 0 }}>{publishMsg}</p>
            </div>
          )}
          {rollbackMsg && (
            <div className="mini-record" style={{ borderLeft: '4px solid var(--warning, #f59e0b)' }}>
              <p style={{ margin: 0 }}>{rollbackMsg}</p>
            </div>
          )}

          {/* Readiness Card */}
          <div className="mini-record" style={{ borderLeft: readinessQuery.data?.ready_to_train ? '4px solid var(--positive, #10b981)' : '4px solid var(--warning, #f59e0b)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem' }}>Kiểm tra Độ sẵn sàng Dữ liệu Huấn luyện (Readiness)</h3>
                <span className="subtle">Giao thức: <code>{readinessQuery.data?.protocol_version || 'rank-v3'}</code> · SHA: <code>{readinessQuery.data?.readiness_sha256 ? readinessQuery.data.readiness_sha256.slice(0, 16) + '…' : '—'}</code></span>
              </div>
              <Badge tone={readinessQuery.data?.ready_to_train ? 'green' : 'amber'}>
                {readinessQuery.data?.ready_to_train ? 'ĐỦ ĐIỀU KIỆN TRAIN' : 'CHƯA SẴN SÀNG'}
              </Badge>
            </div>

            <div className="detail-grid" style={{ marginTop: '0.75rem' }}>
              <div>
                <span>Số mã đủ điều kiện:</span>
                <b>{readinessQuery.data?.eligible_stocks ?? '—'} / {readinessQuery.data?.stock_target ?? 100}</b>
              </div>
              <div>
                <span>Lỗi OHLC giá:</span>
                <b>{readinessQuery.data?.stock_ohlc_failures ?? 0}</b>
              </div>
              <div>
                <span>Ngày giá gần nhất:</span>
                <b>{readinessQuery.data?.latest_market_date || '—'}</b>
              </div>
              <div>
                <span>Kỳ BCTC gần nhất:</span>
                <b>{readinessQuery.data?.latest_statement_date || '—'}</b>
              </div>
              <div>
                <span>Chỉ số VNINDEX:</span>
                <Badge tone={readinessQuery.data?.indexes?.VNINDEX?.ready ? 'green' : 'amber'}>
                  {readinessQuery.data?.indexes?.VNINDEX?.ready ? 'Sẵn sàng' : 'Chưa'}
                </Badge>
              </div>
              <div>
                <span>Chỉ số VN30:</span>
                <Badge tone={readinessQuery.data?.indexes?.VN30?.ready ? 'green' : 'amber'}>
                  {readinessQuery.data?.indexes?.VN30?.ready ? 'Sẵn sàng' : 'Chưa'}
                </Badge>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button
                className="light-button"
                onClick={() => void readinessQuery.refetch()}
                disabled={readinessQuery.isFetching}
              >
                <RefreshCw size={13} style={{ marginRight: 4 }} />
                Kiểm tra lại
              </button>
              <button
                className="action-button"
                onClick={() => setShowRetrainModal(true)}
                disabled={!readinessQuery.data?.ready_to_train || submittingRetrain}
              >
                <Play size={13} style={{ marginRight: 4 }} />
                Huấn luyện lại (Retrain)
              </button>
              <button
                className="light-button"
                onClick={handleRollback}
                disabled={rollingBack}
              >
                <RotateCcw size={13} style={{ marginRight: 4 }} />
                {rollingBack ? 'Đang rollback…' : 'Rollback gói trước'}
              </button>
            </div>
          </div>

          {/* Retrain Modal Form */}
          {showRetrainModal && (
            <div className="mini-record" style={{ borderLeft: '4px solid var(--accent, #3b82f6)', background: 'var(--card-subtle, rgba(255,255,255,0.04))' }}>
              <h4 style={{ margin: '0 0 0.5rem' }}>Khởi chạy Đợt huấn luyện mới qua Command Bus</h4>
              <p className="subtle" style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }}>
                Tiến trình sẽ chạy bất đồng bộ qua hệ thống Command Native: Kiểm tra readiness ➔ Tạo snapshot chỉ đọc ➔ Train mô hình rank-v3 ➔ Đánh giá các cổng kiểm định.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                    Lý do huấn luyện (Bắt buộc ghi nhận audit):
                  </label>
                  <input
                    type="text"
                    value={retrainReason}
                    onChange={e => setRetrainReason(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border, #475569)', background: 'var(--input-bg, rgba(0,0,0,0.2))', color: 'inherit' }}
                    placeholder="Nhập lý do huấn luyện..."
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem', fontWeight: 600 }}>
                    Số luồng song song (Workers):
                  </label>
                  <select
                    value={retrainWorkers}
                    onChange={e => setRetrainWorkers(Number(e.target.value))}
                    style={{ padding: '0.5rem', borderRadius: 4, border: '1px solid var(--border, #475569)', background: 'var(--input-bg, rgba(0,0,0,0.2))', color: 'inherit' }}
                  >
                    <option value={1}>1 Worker (Tiết kiệm tài nguyên)</option>
                    <option value={2}>2 Workers (Cân bằng)</option>
                    <option value={4}>4 Workers (Tối đa tốc độ)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button
                    className="action-button"
                    onClick={handleRetrain}
                    disabled={submittingRetrain || !retrainReason.trim()}
                  >
                    {submittingRetrain ? 'Đang gửi lệnh…' : 'Xác nhận chạy huấn luyện'}
                  </button>
                  <button
                    className="light-button"
                    onClick={() => setShowRetrainModal(false)}
                    disabled={submittingRetrain}
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Training Runs Table */}
          <div className="mini-record" style={{ borderLeft: '4px solid #64748b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem' }}>Lịch sử các đợt Huấn luyện (Training Runs)</h3>
                <span className="subtle">Đọc trực tiếp từ bảng <code>local_ai_training_runs</code></span>
              </div>
              <button
                className="text-button"
                onClick={() => void trainingRunsQuery.refetch()}
                disabled={trainingRunsQuery.isFetching}
              >
                <RefreshCw size={13} style={{ marginRight: 4 }} /> Làm mới
              </button>
            </div>

            {trainingRunsQuery.isFetching && !trainingRunsQuery.data ? (
              <p className="subtle" style={{ margin: '0.75rem 0' }}>Đang tải lịch sử huấn luyện…</p>
            ) : trainingRunsQuery.data && trainingRunsQuery.data.length > 0 ? (
              <div className="table-scroll" style={{ marginTop: '0.75rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Run ID</th>
                      <th>Kích hoạt</th>
                      <th>Lý do</th>
                      <th>Mô hình chọn</th>
                      <th>Trạng thái</th>
                      <th>Cổng Gate</th>
                      <th>Bắt đầu</th>
                      <th>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainingRunsQuery.data.map(r => (
                      <tr key={r.id}>
                        <td><code>{r.id.slice(0, 8)}…</code></td>
                        <td><Badge tone="neutral">{r.trigger}</Badge></td>
                        <td><small title={r.reason}>{r.reason ? (r.reason.length > 30 ? r.reason.slice(0, 30) + '…' : r.reason) : '—'}</small></td>
                        <td><code>{r.selected_model || 'FACTOR_COMPOSITE'}</code></td>
                        <td>
                          <Badge tone={r.status === 'SUCCEEDED' ? 'green' : r.status === 'RUNNING' ? 'amber' : r.status === 'BLOCKED' ? 'neutral' : 'red'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td>
                          {r.gate?.all_gates_passed ? (
                            <Badge tone="green">ĐẠT (PASS)</Badge>
                          ) : r.status === 'SUCCEEDED' ? (
                            <Badge tone="amber">MÔ HÌNH BASELINE</Badge>
                          ) : (
                            <span className="subtle">—</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.75rem' }}>{dateTime(r.started_at)}</td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => setSelectedRun(r)}
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="subtle" style={{ margin: '0.75rem 0' }}>Chưa có lượt huấn luyện nào được ghi nhận. Bấm "Huấn luyện lại (Retrain)" để bắt đầu.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'packages' && (
        <div className="admin-stack">
          {/* Phase 4.0 Status */}
          <div className="mini-record" style={{ borderLeft: '4px solid var(--positive, #10b981)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem' }}>Local AI Suite Controller &amp; Service (Phase 4.0)</h3>
                <span className="subtle">Trạng thái: <strong>Đã tích hợp vào backend main (`feature/local-ai-suite` ➔ `main`)</strong></span>
              </div>
              <Badge tone="green">Đã có trên Backend Main</Badge>
            </div>
            <p style={{ margin: '0.5rem 0' }}>
              Đã đưa <code>LocalAiSuiteAdminController</code>, <code>LocalAiSuiteService</code>, <code>LocalAiSuiteContract</code>, <code>QuarterlyMarketFeatures</code> và <code>RankMarketFeatures</code> vào Java backend main kèm 8/8 unit tests đạt chuẩn.
              Mọi lượt thực thi được bảo vệ bởi ranh giới loopback bắt buộc, xác thực Bearer token, tính toán idempotency key và kiểm định hợp đồng đầu ra.
            </p>
          </div>

          {/* Staging package status note */}
          <div className="mini-record" style={{ borderLeft: '4px solid var(--warning, #f59e0b)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem' }}>Gói Xếp hạng 100 mã (Rank 100 V1 Backfill Release)</h3>
                <span className="subtle">Trạng thái: <strong>Nghiệm thu trong schema cô lập (TEST workspace)</strong></span>
              </div>
              <Badge tone="amber">Chờ duyệt nạp Production</Badge>
            </div>
            <p style={{ margin: '0.5rem 0' }}>
              Gói rank-100 (manifest <code>5cf37d71…</code>) cần sự xác nhận hash/package từ đội train và phê duyệt của quản trị viên trước khi nạp chính thức vào bảng <code>local_ai_packages</code> production.
            </p>
          </div>

          {/* Active Database Packages */}
          <div className="mini-record" style={{ borderLeft: '4px solid #64748b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem' }}>Các gói mô hình đã đăng ký trong Database (`local_ai_packages`)</h3>
                <span className="subtle">Dữ liệu thực từ bảng hệ thống</span>
              </div>
              <Badge tone="neutral">RESEARCH_ONLY</Badge>
            </div>

            {packages.length > 0 ? (
              <div className="table-scroll" style={{ marginTop: '0.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Package ID</th>
                      <th>Tên gói</th>
                      <th>Phiên bản</th>
                      <th>Trạng thái</th>
                      <th>Thời điểm đăng ký</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map(p => (
                      <tr key={String(p.id)}>
                        <td><code>{String(p.id).slice(0, 16)}…</code></td>
                        <td>{safeText(String(p.package_name || p.name || 'Gói mô hình'))}</td>
                        <td>{safeText(String(p.version || '1.0'))}</td>
                        <td><Badge tone="neutral">{safeText(String(p.status || 'ACTIVE'))}</Badge></td>
                        <td>{dateTime(typeof p.registered_at === 'string' ? p.registered_at : typeof p.created_at === 'string' ? p.created_at : null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="subtle" style={{ margin: '0.5rem 0' }}>Bảng <code>local_ai_packages</code> chưa có bản ghi hoặc cần quyền truy cập console data.</p>
            )}

            {/* Suite Runtime History & Recovery */}
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--card-subtle, rgba(255,255,255,0.03))', borderRadius: 6, border: '1px solid var(--border, #334155)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem' }}>Lịch sử thực thi Suite &amp; Thu hồi tác vụ treo (Suite Runs)</h4>
                  <span className="subtle" style={{ fontSize: '0.75rem' }}>Đọc trực tiếp từ <code>/api/admin/local-ai/suite/packages/&#123;id&#125;/runs</code></span>
                </div>
                {activeSuitePackageId && (
                  <button
                    className="light-button"
                    disabled={recovering}
                    onClick={() => handleRecoverStale(activeSuitePackageId)}
                  >
                    <RefreshCw size={13} style={{ marginRight: 4 }} />
                    {recovering ? 'Đang thu hồi…' : 'Thu hồi lượt treo (> 5 phút)'}
                  </button>
                )}
              </div>

              {recoverMsg && (
                <p style={{ margin: '0.5rem 0', fontSize: '0.8rem', color: recoverMsg.includes('Không thể') ? 'var(--negative, #ef4444)' : 'var(--positive, #10b981)' }}>
                  {recoverMsg}
                </p>
              )}

              {suiteRunsQuery.isFetching ? (
                <p className="subtle" style={{ margin: '0.5rem 0' }}>Đang tải lịch sử lượt chạy suite...</p>
              ) : suiteRunsQuery.data && suiteRunsQuery.data.length > 0 ? (
                <div className="table-scroll" style={{ marginTop: '0.5rem', maxHeight: 200 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Run ID</th>
                        <th>Model ID</th>
                        <th>Mã CP</th>
                        <th>Vai trò</th>
                        <th>Trạng thái</th>
                        <th>Độ trễ</th>
                        <th>Bắt đầu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suiteRunsQuery.data.map(r => (
                        <tr key={r.id}>
                          <td><code>{r.id.slice(0, 8)}…</code></td>
                          <td><code>{r.model_id}</code></td>
                          <td><strong>{r.ticker}</strong></td>
                          <td><Badge tone="neutral">{r.role}</Badge></td>
                          <td>
                            <Badge tone={r.status === 'SUCCEEDED' ? 'green' : r.status === 'CACHED' ? 'blue' : r.status === 'RUNNING' ? 'amber' : 'red'}>
                              {r.status}
                            </Badge>
                          </td>
                          <td style={{ fontSize: '0.75rem' }}>{r.latency_ms != null ? `${r.latency_ms} ms` : '—'}</td>
                          <td style={{ fontSize: '0.75rem' }}>{dateTime(r.started_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="subtle" style={{ margin: '0.5rem 0' }}>Chưa có lượt chạy suite nào trong database hoặc Local AI Suite chưa được bật cờ runtime.</p>
              )}
            </div>

            <h4 style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>Danh mục 11 Mô hình nghiên cứu đang nạp trên server</h4>
            <QueryState query={modelsQuery} empty="Không tải được danh mục mô hình.">
              <div className="table-scroll" style={{ marginTop: '0.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Model ID</th>
                      <th>Kỳ mục tiêu</th>
                      <th>Thuật toán</th>
                      <th>Loại hợp đồng</th>
                      <th>Cổng Dev</th>
                      <th className="number">Inputs đã lưu</th>
                      <th className="number">Kết quả nghiên cứu</th>
                      <th>Dữ liệu đến</th>
                      <th>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map(m => (
                      <tr key={m.modelId}>
                        <td><strong>{m.modelId}</strong></td>
                        <td>H{m.horizonQuarters} · {m.targetPeriod}</td>
                        <td>{m.selectedAlgorithm}</td>
                        <td>{m.outputContract?.type || m.kind}</td>
                        <td>{m.developmentGatePassed ? <Badge tone="green">Đạt</Badge> : <Badge tone="neutral">Chưa đạt</Badge>}</td>
                        <td className="number">{Number(m.registeredInputs || 0).toLocaleString('vi-VN')}</td>
                        <td className="number">{Number(m.storedSelectedResearchResults || 0).toLocaleString('vi-VN')}</td>
                        <td><small>{m.lastInputAsOf || '—'}</small></td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => setSelectedModelDetail(m)}
                          >
                            Xem hợp đồng
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </QueryState>
          </div>
        </div>
      )}

      {activeTab === 'universe' && (
        <div className="admin-stack">
          <h3>Rổ cổ phiếu đang theo dõi trên sàn HOSE ({tickers.length} mã)</h3>
          <p className="subtle">Danh sách mã thực tế truy vấn từ Master Data hệ thống (`/api/v1/securities?exchange=HOSE`).</p>
          
          <div className="chips" style={{ marginTop: '0.5rem', maxHeight: 200, overflowY: 'auto' }}>
            {tickers.map(ticker => (
              <span
                key={ticker}
                className="chip"
                style={{
                  cursor: 'pointer',
                  background: selectedTicker === ticker ? 'var(--accent, #3b82f6)' : undefined,
                  color: selectedTicker === ticker ? '#fff' : undefined,
                }}
                onClick={() => {
                  setSelectedTicker(ticker);
                  setActiveTab('lookup');
                }}
                title={`Bấm để tra cứu snapshot của mã ${ticker}`}
              >
                {ticker}
              </span>
            ))}
          </div>

          <div className="detail-section" style={{ marginTop: '1rem' }}>
            <div className="eyebrow">TIÊU CHUẨN READINESS CỦA MÔ HÌNH NỘI BỘ</div>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.6' }}>
              <li><strong>Không có giá trị thiếu giả:</strong> Dữ liệu thiếu được giữ nguyên là <code>null</code>, tuyệt đối không điền 0.</li>
              <li><strong>Độ phủ tối thiểu:</strong> Cần đủ chuỗi nến ngày và tối thiểu 8 kỳ BCTC hợp nhất để tính các đặc trưng vĩ mô/cơ bản.</li>
              <li><strong>Cổng phát triển:</strong> Chỉ các thuật toán vượt qua kiểm định out-of-sample mới được đánh dấu <code>developmentGatePassed = true</code>.</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'lookup' && (
        <div className="admin-stack">
          <div className="toolbar filters">
            <label>
              Chọn mã chứng khoán
              <select value={selectedTicker} onChange={e => setSelectedTicker(e.target.value)}>
                {tickers.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <span className="subtle">Tra cứu input snapshot và kết quả nghiên cứu đã lưu</span>
          </div>

          <QueryState query={tickerQuery} empty={`Chưa có kết quả nghiên cứu lưu cho mã ${selectedTicker}.`}>
            {tickerQuery.data?.data && (
              <div className="detail-section">
                <div className="detail-grid">
                  <div>
                    <span>Mã chứng khoán</span>
                    <b>{selectedTicker} (HOSE)</b>
                  </div>
                  <div>
                    <span>Trạng thái mã</span>
                    <Badge tone="amber">{tickerQuery.data.data.state}</Badge>
                  </div>
                  <div>
                    <span>Cho phép chạy online</span>
                    <b>{String(tickerQuery.data.data.executionAvailable)}</b>
                  </div>
                  <div>
                    <span>Cho phép xuất bản</span>
                    <b>{String(tickerQuery.data.data.publicResultsAvailable)}</b>
                  </div>
                </div>

                <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>Các kết quả mô hình đã lưu cho mã {selectedTicker}</h4>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Model ID</th>
                        <th>Kỳ mục tiêu</th>
                        <th>Thuật toán</th>
                        <th>Loại đầu ra</th>
                        <th>Cổng Dev</th>
                        <th className="number">Inputs</th>
                        <th className="number">Kết quả</th>
                        <th>Dữ liệu đến</th>
                        <th>Quyền công bố</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tickerQuery.data.data.models || []).map(m => (
                        <tr key={m.modelId}>
                          <td><strong>{m.modelId}</strong></td>
                          <td>H{m.horizonQuarters} · {m.targetPeriod}</td>
                          <td>{m.selectedAlgorithm}</td>
                          <td>{m.outputContract?.type || m.kind}</td>
                          <td>{m.developmentGatePassed ? <Badge tone="green">Đạt</Badge> : <Badge tone="neutral">Chưa</Badge>}</td>
                          <td className="number">{Number(m.registeredInputs || 0).toLocaleString('vi-VN')}</td>
                          <td className="number">{Number(m.storedSelectedResearchResults || 0).toLocaleString('vi-VN')}</td>
                          <td><small>{m.lastInputAsOf || '—'}</small></td>
                          <td>
                            <Badge tone={m.publicResultsAvailable ? 'green' : 'neutral'}>
                              {m.publicResultsAvailable ? 'Cho phép' : 'Chặn công bố'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </QueryState>
        </div>
      )}

      {activeTab === 'contracts' && (
        <div className="admin-stack">
          <h3>Định nghĩa Hợp đồng đầu ra của các Mô hình Định lượng</h3>
          <p className="subtle">Các định nghĩa chuẩn hóa theo backend contract để đảm bảo không bị hiểu sai bản chất số liệu.</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Loại hợp đồng</th>
                  <th>Tên mô hình</th>
                  <th>Đơn vị chuẩn hóa</th>
                  <th>Trường mục tiêu</th>
                  <th>Ghi chú kiểm định</th>
                </tr>
              </thead>
              <tbody>
                {CONTRACTS_INFO.map(c => (
                  <tr key={c.type}>
                    <td><code>{c.type}</code></td>
                    <td><strong>{c.name}</strong></td>
                    <td><Badge tone="neutral">{c.unit}</Badge></td>
                    <td><code>{c.target}</code></td>
                    <td><small>{c.note}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'forward' && (
        <div className="admin-stack">
          <h3>Lộ trình triển khai &amp; Điều kiện đưa Local AI lên Production (Phase 4)</h3>
          <div className="detail-section">
            <div className="eyebrow">CÁC BƯỚC BẮT BUỘC THEO KẾ HOẠCH</div>
            <ol style={{ paddingLeft: '1.25rem', lineHeight: '1.8' }}>
              <li>
                <strong>Phase 4.0 – Đưa code từ TEST vào backend main:</strong> Chuyển <code>LocalAiSuiteService</code>, <code>LocalAiSuiteContract</code>, <code>RankMarketFeatures</code>, <code>LocalAiSuiteAdminController</code>, và logic backfill JDBC từ <code>HE_THONG_DATA_TAI_CHINH_TEST</code> vào branch <code>feature/local-ai-suite</code> của <code>HE_THONG_DATA_TAI_CHINH_BACKEND_JAVA</code>.
              </li>
              <li>
                <strong>Phase 4.1 – Chuẩn hóa API qua Command Bus:</strong> Lệnh chạy mô hình <code>execute</code> phải được đưa qua command bus (<code>POST /api/admin/console/commands</code>) kèm <code>reason</code> và <code>idempotencyKey</code>, không gọi REST đồng bộ trực tiếp.
              </li>
              <li>
                <strong>Phase 4.2 – Kiểm duyệt gói Rank-100:</strong> Đội huấn luyện xác nhận mã băm (hash) và manifest của gói <code>rank-100-v2-backfill</code> trước khi chốt đăng ký vào production.
              </li>
              <li>
                <strong>Phase 4.3 – Giữ ranh giới RESEARCH_ONLY:</strong> Điểm số composite rank chỉ dùng để phân tích nội bộ; không tự ý mở cờ <code>publicResultsAvailable=true</code> ra người dùng công khai.
              </li>
            </ol>
          </div>
        </div>
      )}

      {selectedRun && (
        <Drawer
          title={`Đợt huấn luyện: ${selectedRun.id.slice(0, 8)}…`}
          subtitle={`Trạng thái: ${selectedRun.status} · Giao thức: ${selectedRun.protocol_version || 'rank-v3'}`}
          onClose={() => setSelectedRun(null)}
        >
          <div className="detail-section">
            <div className="eyebrow">THÔNG TIN CHUNG</div>
            <div className="detail-grid">
              <div>
                <span>Run ID:</span>
                <code>{selectedRun.id}</code>
              </div>
              <div>
                <span>Trạng thái:</span>
                <Badge tone={selectedRun.status === 'SUCCEEDED' ? 'green' : selectedRun.status === 'RUNNING' ? 'amber' : 'red'}>
                  {selectedRun.status}
                </Badge>
              </div>
              <div>
                <span>Kích hoạt:</span>
                <b>{selectedRun.trigger}</b>
              </div>
              <div>
                <span>Mô hình chọn:</span>
                <b>{selectedRun.selected_model || 'FACTOR_COMPOSITE'}</b>
              </div>
              <div>
                <span>Bắt đầu:</span>
                <small>{dateTime(selectedRun.started_at)}</small>
              </div>
              <div>
                <span>Hoàn tất:</span>
                <small>{selectedRun.finished_at ? dateTime(selectedRun.finished_at) : '—'}</small>
              </div>
            </div>
            {selectedRun.reason && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <strong>Lý do:</strong> {selectedRun.reason}
              </p>
            )}
            {selectedRun.error && (
              <p style={{ marginTop: '0.5rem', color: 'var(--negative, #ef4444)', fontSize: '0.85rem' }}>
                <strong>Lỗi:</strong> {selectedRun.error}
              </p>
            )}
          </div>

          {/* Variants comparison table */}
          {selectedRun.summary?.variants && (
            <div className="detail-section">
              <div className="eyebrow">BẢNG ĐỐI CHIẾU 4 BIẾN THỂ (V0 – V3)</div>
              <div className="table-scroll" style={{ marginTop: '0.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Biến thể</th>
                      <th>Tần suất</th>
                      <th>Mục tiêu</th>
                      <th>Mô hình</th>
                      <th>AUC (Dev / Hồi cứu)</th>
                      <th>IC (Dev / Hồi cứu)</th>
                      <th>IC t-stat</th>
                      <th>Tỷ lệ thắng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedRun.summary.variants).map(([name, v]) => (
                      <tr key={name} style={{ background: name === 'V1' ? 'var(--highlight-bg, rgba(59,130,246,0.1))' : undefined }}>
                        <td><strong>{name}</strong> {name === 'V1' && <Badge tone="green">Đề xuất</Badge>}</td>
                        <td>{v.frequency}</td>
                        <td><code>{v.target}</code></td>
                        <td>{v.selected_model}</td>
                        <td>{v.auc_dev?.toFixed(3) ?? '—'} / {v.auc_retro?.toFixed(3) ?? '—'}</td>
                        <td>{v.ic_dev?.toFixed(3) ?? '—'} / {v.ic_retro?.toFixed(3) ?? '—'}</td>
                        <td>{v.ic_t_stat?.toFixed(2) ?? '—'}</td>
                        <td>{v.win_fraction ? (v.win_fraction * 100).toFixed(0) + '%' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Gates Checklist */}
          {selectedRun.gate && (
            <div className="detail-section">
              <div className="eyebrow">KIỂM ĐỊNH CÁC ĐIỀU KIỆN CỔNG (GATES)</div>
              <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.8', margin: '0.5rem 0' }}>
                <li>
                  Độ tăng AUC (Gain &ge; 0.02):{' '}
                  <Badge tone={selectedRun.gate.auc_gain_passed ? 'green' : 'amber'}>
                    {selectedRun.gate.auc_gain_passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                  </Badge>
                </li>
                <li>
                  Ý nghĩa thống kê IC (t-stat &ge; 2.0):{' '}
                  <Badge tone={selectedRun.gate.min_ic_t_passed ? 'green' : 'amber'}>
                    {selectedRun.gate.min_ic_t_passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                  </Badge>
                </li>
                <li>
                  Tỷ lệ thắng tối thiểu (&ge; 55%):{' '}
                  <Badge tone={selectedRun.gate.win_fraction_passed ? 'green' : 'amber'}>
                    {selectedRun.gate.win_fraction_passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                  </Badge>
                </li>
                <li>
                  Độ nhạy tối thiểu (&ge; 45%):{' '}
                  <Badge tone={selectedRun.gate.recall_passed ? 'green' : 'amber'}>
                    {selectedRun.gate.recall_passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                  </Badge>
                </li>
              </ul>
            </div>
          )}

          <div className="ai-guard" style={{ margin: '0.75rem 0' }}>
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '0.8rem' }}>
              <strong>Lưu ý:</strong> Các chỉ số hồi cứu (2025–2026) được ghi nhận nhằm theo dõi lịch sử và tính toàn vẹn, không dùng để khẳng định chất lượng ML. Mô hình phát hành là FACTOR_COMPOSITE (baseline dấu cố định).
            </p>
          </div>

          {/* Publish Action */}
          {selectedRun.status === 'SUCCEEDED' && (
            <div className="detail-section" style={{ borderTop: '1px solid var(--border, #334155)', paddingTop: '0.75rem' }}>
              <div className="eyebrow">PHÁT HÀNH GÓI SANG ACTIVE</div>
              <p className="subtle" style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.8rem' }}>
                Phát hành gói này vào bảng <code>local_ai_packages</code> với trạng thái <code>ACTIVE</code> (chỉ cho phép 1 gói ACTIVE duy nhất tại một thời điểm). Gói trước đó sẽ tự động chuyển thành <code>SUPERSEDED</code>.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={publishReason}
                  onChange={e => setPublishReason(e.target.value)}
                  placeholder="Lý do phát hành..."
                  style={{ padding: '0.4rem', borderRadius: 4, border: '1px solid var(--border, #475569)', background: 'var(--input-bg, rgba(0,0,0,0.2))', color: 'inherit' }}
                />
                <button
                  className="action-button"
                  onClick={() => handlePublish(selectedRun.id)}
                  disabled={publishingRun || !publishReason.trim()}
                >
                  <Upload size={13} style={{ marginRight: 4 }} />
                  {publishingRun ? 'Đang phát hành…' : 'Xác nhận phát hành gói V1 này'}
                </button>
              </div>
            </div>
          )}
        </Drawer>
      )}

      {selectedModelDetail && (
        <Drawer
          title={`Hợp đồng mô hình: ${selectedModelDetail.modelId}`}
          subtitle={`Package ID: ${selectedModelDetail.packageId || '—'}`}
          onClose={() => setSelectedModelDetail(null)}
        >
          <div className="detail-section">
            <div className="eyebrow">THÔNG TIN MÔ HÌNH</div>
            <div className="detail-grid">
              <div>
                <span>Thuật toán được chọn</span>
                <b>{selectedModelDetail.selectedAlgorithm}</b>
              </div>
              <div>
                <span>Kỳ dự báo</span>
                <b>H{selectedModelDetail.horizonQuarters} · {selectedModelDetail.targetPeriod}</b>
              </div>
              <div>
                <span>Trạng thái sẵn sàng</span>
                <Badge tone="neutral">{selectedModelDetail.readiness}</Badge>
              </div>
              <div>
                <span>Cổng phát triển</span>
                <b>{selectedModelDetail.developmentGatePassed ? 'ĐẠT' : 'CHƯA ĐẠT'}</b>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="eyebrow">HỢP ĐỒNG ĐẦU RA (OUTPUT CONTRACT)</div>
            <div className="detail-grid">
              <div>
                <span>Kiểu đầu ra</span>
                <code>{selectedModelDetail.outputContract?.type || selectedModelDetail.kind}</code>
              </div>
              <div>
                <span>Đơn vị</span>
                <code>{selectedModelDetail.outputContract?.unit || '—'}</code>
              </div>
            </div>
            <p style={{ marginTop: '0.5rem' }}>
              <strong>Ghi chú:</strong> {selectedModelDetail.outputContract?.note || 'Mô hình nghiên cứu nội bộ.'}
            </p>
          </div>
        </Drawer>
      )}
    </Panel>
  );
}
