import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Bot, CheckCircle2, Database, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react';
import { API_BASE, getJson } from '../../shared/api/client';
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
  const [activeTab, setActiveTab] = useState<'packages' | 'universe' | 'lookup' | 'contracts' | 'forward'>('packages');
  const [selectedTicker, setSelectedTicker] = useState('FPT');
  const [selectedModelDetail, setSelectedModelDetail] = useState<LocalModel | null>(null);

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

      {activeTab === 'packages' && (
        <div className="admin-stack">
          {/* Staging package status note */}
          <div className="mini-record" style={{ borderLeft: '4px solid var(--warning, #f59e0b)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem' }}>Gói Xếp hạng 100 mã (Rank 100 V1 Backfill Release)</h3>
                <span className="subtle">Trạng thái: <strong>Mới nghiệm thu trong schema cô lập (TEST workspace)</strong></span>
              </div>
              <Badge tone="amber">Chưa nạp vào Production DB</Badge>
            </div>
            <p style={{ margin: '0.5rem 0' }}>
              Code chạy suite (`LocalAiSuiteService`) và dữ liệu backfill hiện chỉ có trong workspace <code>HE_THONG_DATA_TAI_CHINH_TEST</code>, chưa commit vào repo <code>HE_THONG_DATA_TAI_CHINH_BACKEND_JAVA</code> main.
              Cần thực hiện <strong>Phase 4.0</strong> (chuyển code từ TEST sang backend main) và có xác nhận kiểm duyệt hash từ đội train trước khi đăng ký chính thức lên production.
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
