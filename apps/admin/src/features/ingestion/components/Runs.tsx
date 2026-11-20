import type { Operation } from '../../operations/OperationDrawer';
import { useMemo, useState } from 'react';
import { ArrowDownUp, ArrowUpRight, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DataSource, IngestionJob, IngestionRun, ValidationResult } from '../../dashboard/types/dto';
import { LINKED_LIMIT, useLinkedValidation, useRunDetail } from '../../dashboard/api/queries';
import { Badge, Drawer, Panel, QueryState } from '../../../shared/components/Ui';
import { dateTime, duration, safeObject, safeText, safeUrl } from '../../../shared/utils/format';

const statuses = ['ALL', 'PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'];
export const statusTone = (status: string) => status === 'SUCCESS' ? 'green' : status === 'PARTIAL_SUCCESS' ? 'amber' : status === 'FAILED' ? 'red' : status === 'RUNNING' ? 'blue' : 'neutral';

export function RunDrawer({ id, onClose, onOperation, onJob, onSource, onQuality, onRaw, onIssue }: { id: string | null; onClose: () => void; onOperation?: (operation: Operation) => void; onJob: (id: string) => void; onSource: (id: number) => void; onQuality: (id: string) => void; onRaw: (id: string) => void; onIssue: (issue: ValidationResult) => void }) {
  const [copied, setCopied] = useState(false);
  const { run, payloads } = useRunDetail(id);
  const validation = useLinkedValidation(id);
  if (!id) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(id); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };
  return <Drawer title="Lượt chạy nguồn" subtitle={id} onClose={onClose}><button className="light-button" onClick={copy}><Copy size={14}/>{copied ? 'Đã sao chép ID' : 'Sao chép ID lượt chạy'}</button><QueryState query={run}>{run.data && <>
    <div className="detail-section"><div className="eyebrow">TỔNG QUAN</div><div className="detail-grid"><div><span>Trạng thái</span><Badge tone={statusTone(run.data.status)}>{run.data.status}</Badge></div><div><span>Kích hoạt</span><b>{run.data.triggerType}</b></div><div><span>Job ID</span><b className="break">{run.data.ingestionJobId || '—'}</b></div><div><span>Nguồn dữ liệu ID</span><b>{run.data.dataSourceId}</b></div></div></div>
    <div className="operation-actions">{run.data.ingestionJobId && <button className="light-button" onClick={() => onJob(run.data!.ingestionJobId!)}>Xem job</button>}<button className="light-button" onClick={() => onSource(run.data!.dataSourceId)}>Xem nguồn dữ liệu</button><button className="light-button" onClick={() => onQuality(id)}>Xem validation của lượt chạy</button></div>
    <div className="detail-section"><div className="eyebrow">THỰC THI</div><p>Bắt đầu: {dateTime(run.data.startedAt)}</p><p>Kết thúc: {dateTime(run.data.finishedAt)}</p><p>Thời lượng: {duration(run.data.startedAt, run.data.finishedAt)}</p></div>
    <div className="detail-section"><div className="eyebrow">SỐ BẢN GHI</div><div className="count-grid">{[['Đã lấy', run.data.fetchedCount], ['Thêm mới', run.data.insertedCount], ['Cập nhật', run.data.updatedCount], ['Từ chối', run.data.rejectedCount], ['Lỗi', run.data.errorCount]].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></div>
    <div className="detail-section"><div className="eyebrow">YÊU CẦU / PHẢN HỒI</div><p>Phương thức: {run.data.requestMethod || '—'}</p><p>URL: {safeUrl(run.data.requestUrl)}</p><p>HTTP status: {run.data.responseHttpStatus ?? '—'}</p><p>Content type: {run.data.responseContentType || '—'}</p><pre>{safeObject(run.data.requestQueryParams)}</pre></div>
    <div className="detail-section"><div className="eyebrow">CHẨN ĐOÁN</div><p>{run.data.errorMessage ? safeText(run.data.errorMessage) : 'Không có thông báo lỗi.'}</p><pre>{safeObject(run.data.metadata)}</pre></div>
    <div className="detail-section"><div className="eyebrow">RAW PAYLOAD · KHÔNG KÈM BODY</div><QueryState query={payloads} empty="Lượt chạy không có raw payload (ví dụ bước build nội bộ).">{payloads.data?.map(payload => <div className="mini-record" key={payload.id}><b>{payload.externalKey || payload.id}</b><span>{payload.entityType || '—'} · {payload.sourceSymbol || '—'} · {payload.contentType || '—'}</span><span>Payload ID: {payload.id}</span><button className="light-button" onClick={() => onRaw(payload.id)}>Xem raw payload</button><span>Checksum: {payload.checksumSha256 || '—'}</span><span>Lấy lúc: {dateTime(payload.fetchedAt)} · Tạo lúc: {dateTime(payload.createdAt)}</span>{onOperation && <button className="light-button" onClick={() => { onClose(); onOperation({ kind: 'validate-raw', rawId: payload.id }); }}>Chạy validation</button>}</div>)}</QueryState></div>
    <div className="detail-section"><div className="eyebrow">VALIDATION CỦA LƯỢT CHẠY · TỐI ĐA {LINKED_LIMIT}</div><QueryState query={validation} empty="Chưa có kết quả validation cho lượt chạy này.">{validation.data?.map(item => <button className="mini-record mini-action" key={item.id} onClick={() => onIssue(item)}><b>{item.ruleCode} · {item.status}</b><span>{item.severity} · {item.handlingStatus} · {dateTime(item.checkedAt)}</span><span>{safeText(item.message)}</span></button>)}</QueryState></div>
  </>}</QueryState></Drawer>;
}

export function RunsPanel({ runs, jobs, sources, onSelect, compact = false, onViewAll }: { runs: UseQueryResult<IngestionRun[]>; jobs?: IngestionJob[]; sources?: DataSource[]; onSelect: (id: string) => void; compact?: boolean; onViewAll?: () => void }) {
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [descending, setDescending] = useState(true);
  const rows = useMemo(() => [...(runs.data || [])].filter(run => {
    const job = jobs?.find(item => item.id === run.ingestionJobId);
    const source = sources?.find(item => item.id === run.dataSourceId);
    return (status === 'ALL' || run.status === status) && `${run.id} ${job?.name || ''} ${job?.code || ''} ${run.ingestionJobId || ''} ${source?.name || ''}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => (new Date(a.startedAt || a.createdAt).getTime() - new Date(b.startedAt || b.createdAt).getTime()) * (descending ? -1 : 1)), [runs.data, jobs, sources, status, search, descending]);
  const visible = compact ? rows.slice(0, 6) : rows;
  return <Panel eyebrow="NHẬT KÝ CHẠY" title={compact ? 'Lượt chạy gần đây' : 'Lượt chạy nguồn'} note={compact ? '20 lượt mới nhất · hiển thị tối đa 6' : '20 lượt mới nhất · tìm kiếm, sắp xếp và lọc chỉ áp dụng trên 20 lượt này'} action={compact ? <button className="text-button" onClick={onViewAll}>Xem tất cả <ArrowUpRight size={14}/></button> : <button className="text-button" disabled={runs.isFetching} onClick={() => runs.refetch()}><RefreshCw size={14}/>{runs.isFetching ? 'Đang tải…' : 'Tải lại'}</button>}>
    {!compact && <div className="toolbar filters"><label>Tìm kiếm <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Job, nguồn hoặc run ID"/></label><label>Trạng thái <select value={status} onChange={event => setStatus(event.target.value)}>{statuses.map(value => <option key={value} value={value}>{value === 'ALL' ? 'Tất cả trạng thái' : value}</option>)}</select></label><button className="light-button" onClick={() => setDescending(!descending)}><ArrowDownUp size={14}/> {descending ? 'Mới nhất trước' : 'Cũ nhất trước'}</button><span className="subtle">{runs.data ? `${rows.length} / ${runs.data.length} lượt` : '—'}</span></div>}
    <QueryState query={runs} empty="Chưa có lượt chạy nào."><div className="table-scroll"><table><thead><tr><th>Job / Nguồn</th><th>Trạng thái</th>{!compact && <th>Kích hoạt</th>}<th>Bắt đầu</th><th>Thời lượng</th><th>Đã lấy</th>{!compact && <th>Thêm mới</th>}<th>Lỗi</th><th></th></tr></thead><tbody>{visible.map(run => { const job = jobs?.find(item => item.id === run.ingestionJobId); const source = sources?.find(item => item.id === run.dataSourceId); return <tr key={run.id} tabIndex={0} onClick={() => onSelect(run.id)} onKeyDown={event => event.key === 'Enter' && onSelect(run.id)}><td><strong>{job?.name || run.ingestionJobId || 'Không có job'}</strong><small>{source?.name || `Nguồn #${run.dataSourceId}`}</small></td><td><Badge tone={statusTone(run.status)}>{run.status}</Badge></td>{!compact && <td>{run.triggerType}</td>}<td>{dateTime(run.startedAt)}</td><td>{duration(run.startedAt, run.finishedAt)}</td><td>{run.fetchedCount}</td>{!compact && <td>{run.insertedCount}</td>}<td>{run.errorCount}</td><td><ChevronRight size={16}/></td></tr>; })}</tbody></table></div>{rows.length === 0 && <div className="state-empty">Không có lượt chạy khớp bộ lọc.</div>}</QueryState>
  </Panel>;
}
