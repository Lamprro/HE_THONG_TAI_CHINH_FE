import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Bot, CheckCircle2, ChevronRight, Database, ExternalLink, RefreshCw, ShieldAlert, Zap } from 'lucide-react';
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

const UNIVERSE_100 = [
  'AAA', 'AAM', 'AAT', 'ABS', 'ABT', 'ACB', 'ACC', 'ACL', 'ADG', 'AGD',
  'ADS', 'ANV', 'APC', 'ASM', 'AST', 'BAF', 'BAX', 'BBD', 'BKG', 'BMC',
  'BMI', 'BMP', 'BRC', 'BSI', 'BTP', 'BTT', 'BVH', 'BWE', 'C32', 'C47',
  'CAV', 'CCL', 'CDC', 'CHP', 'CLL', 'CLW', 'CMG', 'CMX', 'CNG', 'COM',
  'CRC', 'CSV', 'CTD', 'CTF', 'CTG', 'CTI', 'CTR', 'CTS', 'D2D', 'DAG',
  'DAH', 'DAT', 'DBC', 'DBD', 'DBN', 'DC4', 'DCL', 'DCM', 'DGC', 'DGW',
  'DHA', 'DHC', 'DHG', 'DIG', 'DLG', 'DMC', 'DNP', 'DPM', 'DPR', 'DQC',
  'DRC', 'DSE', 'DSN', 'DTA', 'DTL', 'DTT', 'DVP', 'DXG', 'DXS', 'EIB',
  'ELC', 'EMC', 'EVE', 'EVG', 'FCM', 'FCN', 'FDC', 'FIR', 'FIT', 'FLC',
  'FMC', 'FPT', 'FRT', 'FTS', 'GAS', 'GDT', 'GEG', 'GEX', 'GIL', 'GMC'
];

const CONTRACTS_INFO = [
  { type: 'FACTOR_COMPOSITE', name: 'Điểm tổng hợp đa yếu tố', unit: 'COMPOSITE_SCORE', target: 'MOM120_RANK + LOW_VOLATILITY', note: 'Điểm tổng hợp không fit, dấu cố định: ít biến động, ít sụt giảm, động lượng 2Q/120D/MA200.' },
  { type: 'DIRECTION (H3)', name: 'Hướng giá tương đối theo quý', unit: 'UNCALIBRATED_SCORE_0_1', target: 'UP / NOT_UP', note: 'Điểm uncalibrated 0–1, không phải xác suất đã kiểm chứng. Đọc horizonQuarters.' },
  { type: 'RETURN_QUANTILES', name: 'Phân vị lợi suất', unit: 'FRACTION', target: 'P10, P50, P90', note: 'Phân vị lịch sử gộp, không đảm bảo khoảng tin cậy hiệu chỉnh riêng từng mã.' },
  { type: 'NET_PROFIT_AFTER_TAX', name: 'Lợi nhuận sau thuế (NPAT)', unit: 'VND', target: 'prediction_vnd', note: 'Báo cáo hợp nhất (CONSOLIDATED), cơ sở riêng quý (STANDALONE_QUARTER).' },
  { type: 'ADJUSTED_PRICE_RETURN', name: 'Lợi suất giá điều chỉnh', unit: 'RETURN_FRACTION', target: 'prediction', note: 'Dự báo tỷ lệ thay đổi giá đã điều chỉnh cổ tức/thưởng.' },
  { type: 'VOLATILITY', name: 'Biến động giá năm hóa', unit: 'ANNUALIZED_VOLATILITY', target: 'prediction', note: 'Độ biến động log return đóng cửa tính theo năm.' },
  { type: 'DRAWDOWN', name: 'Mức sụt giảm tối đa', unit: 'MAX_DRAWDOWN_FRACTION', target: 'prediction', note: 'Mức sụt giảm cực đại dự kiến từ đỉnh giá đóng cửa trong kỳ.' },
];

export function LocalAiOperationsPanel({ onRun }: { onRun?: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState<'packages' | 'universe' | 'lookup' | 'contracts' | 'forward'>('packages');
  const [selectedTicker, setSelectedTicker] = useState('FPT');
  const [selectedModelDetail, setSelectedModelDetail] = useState<LocalModel | null>(null);

  // Read registry 11 models
  const modelsQuery = useQuery({
    queryKey: ['admin-local-ai-models'],
    queryFn: () => getJson<ModelsPageResponse>(API_BASE, '/api/v1/local-ai/models?size=100'),
    staleTime: 60000,
  });

  // Read single ticker progress
  const tickerQuery = useQuery({
    queryKey: ['admin-local-ai-ticker', selectedTicker],
    queryFn: () => getJson<{ data: { state: string; publicResultsAvailable: boolean; executionAvailable: boolean; models: LocalModel[] } }>(
      API_BASE,
      `/api/v1/securities/${selectedTicker}/local-ai?exchange=HOSE`
    ),
    enabled: !!selectedTicker && activeTab === 'lookup',
    staleTime: 60000,
  });

  const models = modelsQuery.data?.items || [];

  return (
    <Panel
      title="Vận hành Local AI & Gói xếp hạng 100 mã"
      eyebrow="LOCAL AI GOVERNANCE & EXECUTION"
      note="Quản trị độc lập các mô hình định lượng nội bộ: gói registry 11 tác vụ và gói xếp hạng 100 mã (V1 FACTOR_COMPOSITE). Tách biệt với luồng LLM/Gemini."
      action={
        <button className="text-button" onClick={() => { void modelsQuery.refetch(); void tickerQuery.refetch(); }}>
          <RefreshCw size={14} /> Tải lại
        </button>
      }
    >
      <div className="ai-guard" style={{ marginBottom: '1rem' }}>
        <ShieldAlert size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>RANH GIỚI NGHIÊN CỨU (RESEARCH_ONLY) ĐƯỢC BẢO TOÀN NGHIÊM NGẶT</strong>
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
          Gói mô hình &amp; Registry
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'universe'}
          className={activeTab === 'universe' ? 'active' : ''}
          onClick={() => setActiveTab('universe')}
        >
          Rổ 100 mã &amp; Readiness
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
          Hợp đồng &amp; Đầu ra
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'forward'}
          className={activeTab === 'forward' ? 'active' : ''}
          onClick={() => setActiveTab('forward')}
        >
          Đánh giá Forward &amp; Lộ trình
        </button>
      </div>

      {activeTab === 'packages' && (
        <div className="admin-stack">
          <div className="mini-record" style={{ borderLeft: '4px solid var(--accent, #3b82f6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem' }}>Gói Xếp hạng 100 mã (Rank 100 V1 Backfill Release)</h3>
                <span className="subtle">Package ID: <code>939969a8-441c-4e8b-9a91-f1f25836736a</code></span>
              </div>
              <Badge tone="green">Đã nghiệm thu Schema cô lập (PASS)</Badge>
            </div>
            <p style={{ margin: '0.5rem 0' }}>
              Huấn luyện trên 260.855 phiên canonical (79 mã từ 01/2016, 71 mã backfill thành công với sai lệch điểm nối 0.0%).
              Đã kiểm định tự động qua Spring HTTP: <strong>99/99 dự đoán khớp 100% với issued.json</strong> tại origin 30/09/2026.
            </p>
            <div className="count-grid" style={{ marginTop: '0.5rem' }}>
              <div>
                <strong>FACTOR_COMPOSITE</strong>
                <span>Thuật toán chọn</span>
              </div>
              <div>
                <strong>100 mã HOSE</strong>
                <span>Rổ Universe đã khóa</span>
              </div>
              <div>
                <strong>99 / 99</strong>
                <span>Dự đoán khớp biên nhận</span>
              </div>
              <div>
                <strong>PARTIAL_HORIZON</strong>
                <span>Kỳ Q4/2026</span>
              </div>
            </div>
          </div>

          <div className="mini-record" style={{ borderLeft: '4px solid #64748b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 0.25rem' }}>Gói 11 Mô hình nghiên cứu cũ (Registry Snapshot)</h3>
                <span className="subtle">Package ID: <code>1d5b62a8-6eaf-417a-adbe-fa899f76a429</code> · Đăng ký: 22/10/2026 UTC</span>
              </div>
              <Badge tone="neutral">RESEARCH_ONLY</Badge>
            </div>
            <p style={{ margin: '0.5rem 0' }}>
              Gói tác vụ đơn vị: hướng giá (direction), sụt giảm (drawdown), phân vị (quantile), lợi nhuận (npat), biến động (volatility).
            </p>

            <QueryState query={modelsQuery} empty="Không tải được danh mục mô hình.">
              <div className="table-scroll" style={{ marginTop: '0.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Model ID</th>
                      <th>Kỳ mục tiêu</th>
                      <th>Thuật toán được chọn</th>
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
                        <td className="number">{Number(m.registeredInputs).toLocaleString('vi-VN')}</td>
                        <td className="number">{Number(m.storedSelectedResearchResults).toLocaleString('vi-VN')}</td>
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
          <h3>Tiêu chuẩn sàng lọc Readiness &amp; Khóa dữ liệu (Cửa sổ 2016–2026)</h3>
          <div className="count-grid">
            <div>
              <strong>100 / 100</strong>
              <span>Mã HOSE qua cổng</span>
            </div>
            <div>
              <strong>260.855</strong>
              <span>Phiên giá canonical</span>
            </div>
            <div>
              <strong>2.716</strong>
              <span>Phiên VNINDEX/VN30</span>
            </div>
            <div>
              <strong>0,0%</strong>
              <span>Sai lệch điểm nối</span>
            </div>
          </div>

          <div className="detail-section">
            <div className="eyebrow">CÁC PHÉP KIỂM ĐỊNH TOÀN VẸN ĐÃ VƯỢT QUA</div>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.6' }}>
              <li><strong>Kiểm tra trùng lặp:</strong> 0 phiên trùng (symbol, trading_date), 0 lỗi OHLC (High &lt; Low hoặc Close ngoài biên độ).</li>
              <li><strong>Lineage &amp; Version:</strong> 100% phiên giá gắn liền với raw payload ID và data version ở trạng thái <code>ACTIVATED</code>.</li>
              <li><strong>Kiểm tra điểm nối (Seam Verification):</strong> Cửa sổ 45 ngày nối giữa dữ liệu cũ và dữ liệu backfill 2016–2020 đạt sai lệch <code>adjusted_close</code> tối đa <strong>0,0%</strong> trên cả 71 mã.</li>
              <li><strong>Biên độ giá qua điểm nối:</strong> Lợi suất từ 31/12/2020 sang 04/01/2021 của toàn bộ 71 mã đều nằm gọn trong biên độ giới hạn ±7%.</li>
            </ul>
          </div>

          <details open>
            <summary><strong>Danh sách Rổ 100 mã cổ phiếu HOSE (Universe đã khóa)</strong></summary>
            <div className="chips" style={{ marginTop: '0.5rem', maxHeight: 200, overflowY: 'auto' }}>
              {UNIVERSE_100.map(ticker => (
                <span
                  key={ticker}
                  className="chip"
                  style={{ cursor: 'pointer', background: selectedTicker === ticker ? 'var(--accent, #3b82f6)' : undefined, color: selectedTicker === ticker ? '#fff' : undefined }}
                  onClick={() => {
                    setSelectedTicker(ticker);
                    setActiveTab('lookup');
                  }}
                  title="Bấm để tra cứu snapshot và kết quả mã này"
                >
                  {ticker}
                </span>
              ))}
            </div>
          </details>
        </div>
      )}

      {activeTab === 'lookup' && (
        <div className="admin-stack">
          <div className="toolbar filters">
            <label>
              Chọn mã chứng khoán trong rổ
              <select value={selectedTicker} onChange={e => setSelectedTicker(e.target.value)}>
                {UNIVERSE_100.map(t => (
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
                      {tickerQuery.data.data.models.map(m => (
                        <tr key={m.modelId}>
                          <td><strong>{m.modelId}</strong></td>
                          <td>H{m.horizonQuarters} · {m.targetPeriod}</td>
                          <td>{m.selectedAlgorithm}</td>
                          <td>{m.outputContract?.type || m.kind}</td>
                          <td>{m.developmentGatePassed ? <Badge tone="green">Đạt</Badge> : <Badge tone="neutral">Chưa</Badge>}</td>
                          <td className="number">{m.registeredInputs}</td>
                          <td className="number">{m.storedSelectedResearchResults}</td>
                          <td><small>{m.lastInputAsOf || '—'}</small></td>
                          <td><Badge tone="neutral">Chưa công bố</Badge></td>
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
          <h3>Hợp đồng đầu ra của các dòng mô hình (Registered Output Contracts v1)</h3>
          <p className="subtle">
            Các trường đầu ra được chuẩn hóa theo schema bất biến. Giá trị dự đoán trả về ở dạng chuỗi số thập phân để bảo toàn độ chính xác.
          </p>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Loại hợp đồng</th>
                  <th>Tên mô tả</th>
                  <th>Đơn vị (Unit)</th>
                  <th>Trường đầu ra mục tiêu</th>
                  <th>Ghi chú kỹ thuật &amp; Pháp lý</th>
                </tr>
              </thead>
              <tbody>
                {CONTRACTS_INFO.map(c => (
                  <tr key={c.type}>
                    <td><strong>{c.type}</strong></td>
                    <td>{c.name}</td>
                    <td><code>{c.unit}</code></td>
                    <td><b>{c.target}</b></td>
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
          <h3>Đánh giá Hiệu quả Tương lai (Forward Evaluation) &amp; Lộ trình Nghiệm thu</h3>
          <div className="mini-record" style={{ background: 'var(--panel-alt, #f8fafc)', border: '1px solid var(--border, #e2e8f0)' }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>Origin 30/09/2026 (Hiện tại): PARTIAL_HORIZON_RESEARCH</h4>
            <p>
              Dự báo phát hành tại ngày chốt 30/09/2026 nằm ở giữa quý Q4/2026. Do nhãn kết quả thực tế chưa trưởng thành (mature) đầy đủ 63 phiên,
              đợt đánh giá này được phân loại là <code>PARTIAL_HORIZON_RESEARCH</code>.
            </p>
          </div>

          <div className="mini-record" style={{ background: 'var(--panel-alt, #f8fafc)', border: '1px solid var(--border, #e2e8f0)' }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>Origin 31/12/2026 (Kế hoạch chính thức)</h4>
            <p>
              Đợt đánh giá forward đủ horizon chính thức sẽ thực hiện vào đầu tháng 01/2027 (origin 31/12/2026, chấm sau ngày 31/03/2027
              bằng runner <code>evaluate_rank_forward.py</code>).
            </p>
          </div>

          <div className="detail-section">
            <div className="eyebrow">ĐIỀU KIỆN TIÊN QUYẾT ĐỂ XÉT DUYỆT CÔNG BỐ (PUBLICATION GATE)</div>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: '1.6' }}>
              <li>Phải khóa prediction trước khi biết actual (không rò rỉ dữ liệu tương lai).</li>
              <li>Chỉ số Rank IC phải duy trì dương ổn định trên tập kiểm thử độc lập (t-stat &ge; 2.0).</li>
              <li>Được phê duyệt bằng văn bản của Hội đồng Đầu tư / Ban Quản trị hệ thống trước khi gỡ cờ <code>RESEARCH_ONLY</code>.</li>
            </ul>
          </div>
        </div>
      )}

      {selectedModelDetail && (
        <Drawer
          title={selectedModelDetail.modelId}
          subtitle={`Hợp đồng đầu ra của mô hình ${selectedModelDetail.modelId}`}
          onClose={() => setSelectedModelDetail(null)}
        >
          <div className="detail-section">
            <div className="eyebrow">THÔNG SỐ MÔ HÌNH</div>
            <div className="detail-grid">
              <div>
                <span>Kỳ mục tiêu</span>
                <b>H{selectedModelDetail.horizonQuarters} ({selectedModelDetail.targetPeriod})</b>
              </div>
              <div>
                <span>Thuật toán chọn</span>
                <b>{selectedModelDetail.selectedAlgorithm}</b>
              </div>
              <div>
                <span>Cổng phát triển</span>
                <Badge tone={selectedModelDetail.developmentGatePassed ? 'green' : 'neutral'}>
                  {selectedModelDetail.developmentGatePassed ? 'Đã đạt' : 'Chưa đạt'}
                </Badge>
              </div>
              <div>
                <span>Trạng thái sẵn sàng</span>
                <b>{selectedModelDetail.readiness}</b>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="eyebrow">HỢP ĐỒNG ĐẦU RA</div>
            <p><strong>Loại:</strong> {selectedModelDetail.outputContract?.type || selectedModelDetail.kind}</p>
            <p><strong>Đơn vị:</strong> <code>{selectedModelDetail.outputContract?.unit || '—'}</code></p>
            <p><strong>Các trường đầu ra:</strong> {selectedModelDetail.outputContract?.fields?.join(', ') || '—'}</p>
            {selectedModelDetail.outputContract?.note && (
              <p className="subtle" style={{ marginTop: '0.5rem' }}>
                {selectedModelDetail.outputContract.note}
              </p>
            )}
          </div>
        </Drawer>
      )}
    </Panel>
  );
}
