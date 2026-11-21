import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ChevronRight, Database, FileText, Filter, Layers, RefreshCw, Search, ShieldAlert, XCircle } from 'lucide-react';
import { API_BASE, getJson } from '../../shared/api/client';
import { Badge, Panel, QueryState } from '../../shared/components/Ui';
import { dateTime, safeText } from '../../shared/utils/format';

const toStr = (val: unknown): string => (val != null ? safeText(String(val)) : '—');
const toDateStr = (val: unknown): string => (typeof val === 'string' ? dateTime(val) : '—');

interface Row {
  id?: string;
  [key: string]: unknown;
}

interface PageResponse {
  rows: Row[];
  total: number;
  page: number;
  size: number;
}

export function LineageTracerPage({
  onRun,
  onRaw,
}: {
  onRun?: (id: string) => void;
  onRaw?: (id: string) => void;
}) {
  const [symbol, setSymbol] = useState('FPT');
  const [selectedDataset, setSelectedDataset] = useState<'PRICE' | 'STATEMENT'>('PRICE');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRawId, setSelectedRawId] = useState<string | null>(null);

  // 1. Fetch Securities to get security ID
  const securitiesQuery = useQuery({
    queryKey: ['admin-securities-lookup'],
    queryFn: () => getJson<{ items: Array<{ id: string; symbol: string; exchange: string }> }>(API_BASE, '/api/v1/securities?size=200'),
    staleTime: 300000,
  });

  const securities = securitiesQuery.data?.items || [];
  const currentSecurity = securities.find(s => s.symbol.toUpperCase() === symbol.trim().toUpperCase());

  // 2. Step 1: Recent Ingestion Runs for symbol/operation
  const runsQuery = useQuery({
    queryKey: ['lineage-runs', symbol, selectedDataset],
    queryFn: () => {
      const opFilter = selectedDataset === 'PRICE' ? 'PRICE' : 'FINANCIAL';
      return getJson<PageResponse>(
        API_BASE,
        `/api/admin/console/data/ingestion_runs?search=${encodeURIComponent(symbol)}&size=10`
      ).catch(() => ({ rows: [], total: 0, page: 0, size: 10 }));
    },
    staleTime: 30000,
  });

  const runs = runsQuery.data?.rows || [];
  const activeRunId = selectedRunId || (runs.length > 0 ? String(runs[0].id) : null);

  // 3. Step 2: Raw Payloads for the active run
  const rawQuery = useQuery({
    queryKey: ['lineage-raws', activeRunId],
    queryFn: () => {
      if (!activeRunId) return Promise.resolve({ rows: [], total: 0, page: 0, size: 10 });
      return getJson<PageResponse>(
        API_BASE,
        `/api/admin/console/data/raw_payloads?runId=${encodeURIComponent(activeRunId)}&size=10`
      ).catch(() => ({ rows: [], total: 0, page: 0, size: 10 }));
    },
    enabled: !!activeRunId,
    staleTime: 30000,
  });

  const raws = rawQuery.data?.rows || [];
  const activeRawId = selectedRawId || (raws.length > 0 ? String(raws[0].id) : null);

  // 4. Step 3: Validation results for active raw payload
  const validationQuery = useQuery({
    queryKey: ['lineage-validations', activeRawId],
    queryFn: () => {
      if (!activeRawId) return Promise.resolve({ rows: [], total: 0, page: 0, size: 10 });
      return getJson<PageResponse>(
        API_BASE,
        `/api/admin/console/data/validation_results?raw_payload_id=${encodeURIComponent(activeRawId)}&size=20`
      ).catch(() => ({ rows: [], total: 0, page: 0, size: 20 }));
    },
    enabled: !!activeRawId,
    staleTime: 30000,
  });

  // 5. Step 4: Data Versions for active raw payload
  const versionsQuery = useQuery({
    queryKey: ['lineage-versions', activeRawId],
    queryFn: () => {
      if (!activeRawId) return Promise.resolve({ rows: [], total: 0, page: 0, size: 10 });
      return getJson<PageResponse>(
        API_BASE,
        `/api/admin/console/data/data_versions?raw_payload_id=${encodeURIComponent(activeRawId)}&size=10`
      ).catch(() => ({ rows: [], total: 0, page: 0, size: 10 }));
    },
    enabled: !!activeRawId,
    staleTime: 30000,
  });

  // 6. Step 5: Canonical Output Rows
  const canonicalQuery = useQuery({
    queryKey: ['lineage-canonical', currentSecurity?.id, selectedDataset],
    queryFn: () => {
      if (!currentSecurity?.id) return Promise.resolve({ rows: [], total: 0, page: 0, size: 10 });
      const table = selectedDataset === 'PRICE' ? 'market_prices' : 'financial_statements';
      return getJson<PageResponse>(
        API_BASE,
        `/api/admin/console/data/${table}?security_id=${encodeURIComponent(currentSecurity.id)}&is_canonical=true&size=10`
      ).catch(() => ({ rows: [], total: 0, page: 0, size: 10 }));
    },
    enabled: !!currentSecurity?.id,
    staleTime: 30000,
  });

  return (
    <Panel
      title="Truy vết nguồn dữ liệu toàn trình (Data Lineage Tracer)"
      eyebrow="PHASE 1.4 · AUDIT & LINEAGE"
      note="Truy vết luồng dữ liệu từng bước theo mã: Ingestion Run ➔ Raw Payload ➔ Validation ➔ Data Version ➔ Canonical Rows. Đảm bảo tính minh bạch từ nguồn thô đến bảng cuối."
      action={
        <button
          className="text-button"
          onClick={() => {
            void runsQuery.refetch();
            void rawQuery.refetch();
            void validationQuery.refetch();
            void versionsQuery.refetch();
            void canonicalQuery.refetch();
          }}
        >
          <RefreshCw size={14} /> Tải lại
        </button>
      }
    >
      <div className="toolbar filters" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Mã cổ phiếu</label>
          <input
            value={symbol}
            onChange={e => {
              setSymbol(e.target.value.toUpperCase());
              setSelectedRunId(null);
              setSelectedRawId(null);
            }}
            placeholder="Ví dụ: FPT, HPG..."
            style={{ textTransform: 'uppercase', width: 140 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: 4 }}>Loại tập dữ liệu</label>
          <select
            value={selectedDataset}
            onChange={e => {
              setSelectedDataset(e.target.value as 'PRICE' | 'STATEMENT');
              setSelectedRunId(null);
              setSelectedRawId(null);
            }}
          >
            <option value="PRICE">Giá thị trường (Market Prices)</option>
            <option value="STATEMENT">Báo cáo tài chính (Statements)</option>
          </select>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <span>Mã bảo chứng:</span>
          {currentSecurity ? (
            <Badge tone="green">{currentSecurity.symbol} ({currentSecurity.exchange})</Badge>
          ) : (
            <Badge tone="amber">Chưa tìm thấy ID chứng khoán</Badge>
          )}
        </div>
      </div>

      {/* Visual Pipeline Flowchart Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 0', borderBottom: '1px solid var(--border, #334155)', marginBottom: '1rem' }}>
        <div className={`mini-card ${activeRunId ? 'active-step' : ''}`} style={{ padding: '0.5rem 0.75rem', borderRadius: 4, background: activeRunId ? 'var(--card-active, #1e293b)' : 'transparent', border: '1px solid var(--border, #334155)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--subtle, #94a3b8)' }}>BƯỚC 1</div>
          <strong>1. Lượt chạy (Run)</strong>
          <div style={{ fontSize: '0.75rem' }}>{runs.length} lượt gần đây</div>
        </div>
        <ChevronRight size={16} color="#64748b" />
        <div className={`mini-card ${activeRawId ? 'active-step' : ''}`} style={{ padding: '0.5rem 0.75rem', borderRadius: 4, background: activeRawId ? 'var(--card-active, #1e293b)' : 'transparent', border: '1px solid var(--border, #334155)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--subtle, #94a3b8)' }}>BƯỚC 2</div>
          <strong>2. Dữ liệu thô (Raw)</strong>
          <div style={{ fontSize: '0.75rem' }}>{raws.length} payloads</div>
        </div>
        <ChevronRight size={16} color="#64748b" />
        <div className="mini-card" style={{ padding: '0.5rem 0.75rem', borderRadius: 4, border: '1px solid var(--border, #334155)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--subtle, #94a3b8)' }}>BƯỚC 3</div>
          <strong>3. Kiểm định (Validation)</strong>
          <div style={{ fontSize: '0.75rem' }}>{validationQuery.data?.rows.length || 0} quy tắc kiểm tra</div>
        </div>
        <ChevronRight size={16} color="#64748b" />
        <div className="mini-card" style={{ padding: '0.5rem 0.75rem', borderRadius: 4, border: '1px solid var(--border, #334155)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--subtle, #94a3b8)' }}>BƯỚC 4</div>
          <strong>4. Phiên bản (Version)</strong>
          <div style={{ fontSize: '0.75rem' }}>{versionsQuery.data?.rows.length || 0} phiên bản</div>
        </div>
        <ChevronRight size={16} color="#64748b" />
        <div className="mini-card" style={{ padding: '0.5rem 0.75rem', borderRadius: 4, border: '1px solid var(--border, #334155)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--subtle, #94a3b8)' }}>BƯỚC 5</div>
          <strong>5. Bảng cuối (Canonical)</strong>
          <div style={{ fontSize: '0.75rem' }}>{canonicalQuery.data?.rows.length || 0} dòng chuẩn</div>
        </div>
      </div>

      {/* Grid of Stages */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Step 1 & 2 Left Column */}
        <div className="admin-stack">
          {/* Step 1: Ingestion Runs */}
          <div className="mini-record" style={{ borderLeft: '4px solid #3b82f6' }}>
            <h4 style={{ margin: '0 0 0.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>1. Lượt chạy lấy dữ liệu ({runs.length})</span>
              <span className="subtle" style={{ fontSize: '0.75rem' }}>Chọn 1 lượt để xem dữ liệu thô</span>
            </h4>
            {runs.length === 0 ? (
              <p className="subtle">Không tìm thấy lượt chạy gần đây cho mã {symbol}.</p>
            ) : (
              <div className="table-scroll" style={{ maxHeight: 220 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Run ID</th>
                      <th>Trạng thái</th>
                      <th>Bắt đầu</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map(r => {
                      const idStr = String(r.id);
                      const isSelected = idStr === activeRunId;
                      return (
                        <tr
                          key={idStr}
                          style={{ background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent', cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedRunId(idStr);
                            setSelectedRawId(null);
                          }}
                        >
                          <td><code>{idStr.slice(0, 8)}…</code></td>
                          <td>
                            <Badge tone={r.status === 'COMPLETED' ? 'green' : r.status === 'RUNNING' ? 'amber' : 'red'}>
                              {toStr(r.status)}
                            </Badge>
                          </td>
                          <td style={{ fontSize: '0.75rem' }}>{toDateStr(r.started_at)}</td>
                          <td>
                            <button
                              className="text-button"
                              onClick={e => {
                                e.stopPropagation();
                                onRun?.(idStr);
                              }}
                            >
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Step 2: Raw Payloads */}
          <div className="mini-record" style={{ borderLeft: '4px solid #8b5cf6' }}>
            <h4 style={{ margin: '0 0 0.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>2. Payload thô từ Run đang chọn ({raws.length})</span>
              <span className="subtle" style={{ fontSize: '0.75rem' }}>Chọn raw payload để xem validation &amp; version</span>
            </h4>
            {raws.length === 0 ? (
              <p className="subtle">Không có raw payload nào trong lượt chạy này.</p>
            ) : (
              <div className="table-scroll" style={{ maxHeight: 220 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Raw ID</th>
                      <th>Loại</th>
                      <th>Dung lượng</th>
                      <th>Thời gian nhận</th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raws.map(rw => {
                      const idStr = String(rw.id);
                      const isSelected = idStr === activeRawId;
                      return (
                        <tr
                          key={idStr}
                          style={{ background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'transparent', cursor: 'pointer' }}
                          onClick={() => setSelectedRawId(idStr)}
                        >
                          <td><code>{idStr.slice(0, 8)}…</code></td>
                          <td>{toStr(rw.entity_type || rw.operation)}</td>
                          <td style={{ fontSize: '0.75rem' }}>{toStr(rw.payload_size)} bytes</td>
                          <td style={{ fontSize: '0.75rem' }}>{toDateStr(rw.fetched_at)}</td>
                          <td>
                            <button
                              className="text-button"
                              onClick={e => {
                                e.stopPropagation();
                                onRaw?.(idStr);
                              }}
                            >
                              Xem thô
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Step 3, 4, 5 Right Column */}
        <div className="admin-stack">
          {/* Step 3: Validation */}
          <div className="mini-record" style={{ borderLeft: '4px solid #10b981' }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>3. Kết quả kiểm định (Validation Results)</h4>
            <QueryState query={validationQuery}>
              {validationQuery.data?.rows.length === 0 ? (
                <p className="subtle">Chưa có bản ghi validation cho raw payload này.</p>
              ) : (
                <div className="table-scroll" style={{ maxHeight: 180 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Quy tắc</th>
                        <th>Trạng thái</th>
                        <th>Vi phạm</th>
                        <th>Thời điểm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validationQuery.data?.rows.map((v, i) => (
                        <tr key={String(v.id || i)}>
                          <td><code>{toStr(v.rule_code || v.rule_id || 'RULE')}</code></td>
                          <td>
                            <Badge tone={v.status === 'PASS' || v.result_status === 'PASS' ? 'green' : 'red'}>
                              {toStr(v.status || v.result_status || 'UNKNOWN')}
                            </Badge>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: v.violation_count ? 'var(--negative, #ef4444)' : 'inherit' }}>
                            {toStr(v.violation_count || 0)}
                          </td>
                          <td style={{ fontSize: '0.75rem' }}>{toDateStr(v.validated_at || v.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </QueryState>
          </div>

          {/* Step 4 & 5: Version & Canonical Output */}
          <div className="mini-record" style={{ borderLeft: '4px solid #f59e0b' }}>
            <h4 style={{ margin: '0 0 0.5rem' }}>4. Phiên bản dữ liệu (Data Version) &amp; Bảng Canonical</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <span className="subtle" style={{ fontSize: '0.75rem' }}>Phiên bản sinh ra:</span>
                <div>
                  <strong>{versionsQuery.data?.rows.length || 0} phiên bản</strong>
                  {versionsQuery.data?.rows[0] && (
                    <div style={{ fontSize: '0.75rem', marginTop: 2 }}>
                      Trạng thái: <Badge tone="blue">{toStr(versionsQuery.data.rows[0].status)}</Badge>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <span className="subtle" style={{ fontSize: '0.75rem' }}>Dòng canonical trong DB:</span>
                <div>
                  <strong>{canonicalQuery.data?.rows.length || 0} dòng</strong>
                  <div style={{ fontSize: '0.75rem', marginTop: 2, color: 'var(--positive, #10b981)' }}>
                    Đã đưa vào phục vụ User
                  </div>
                </div>
              </div>
            </div>

            {canonicalQuery.data?.rows && canonicalQuery.data.rows.length > 0 && (
              <div className="table-scroll" style={{ maxHeight: 160 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{selectedDataset === 'PRICE' ? 'Ngày giá' : 'Kỳ BCTC'}</th>
                      <th>{selectedDataset === 'PRICE' ? 'Giá đóng cửa' : 'Loại BCTC'}</th>
                      <th>Nguồn</th>
                      <th>Canonical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {canonicalQuery.data.rows.slice(0, 5).map((row, i) => (
                      <tr key={String(row.id || i)}>
                        <td style={{ fontSize: '0.75rem' }}>{toStr(row.price_timestamp || row.period_end || row.date)}</td>
                        <td>
                          {selectedDataset === 'PRICE'
                            ? toStr(row.close_price || row.adjusted_close)
                            : toStr(row.statement_type || row.report_scope)}
                        </td>
                        <td style={{ fontSize: '0.75rem' }}>{toStr(row.data_source_id || row.source_code || 'Official')}</td>
                        <td><Badge tone="green">CANONICAL</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
