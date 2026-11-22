import type { Operation } from '../../operations/OperationDrawer';
import { useMemo, useState } from 'react';
import { ArrowDownUp, ArrowUpRight, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DataSource, IngestionJob, IngestionRun, ValidationResult } from '../../dashboard/types/dto';
import { LINKED_LIMIT, useLinkedValidation, useLinkedVersions, useRunDetail } from '../../dashboard/api/queries';
import { Badge, Drawer, Panel, QueryState } from '../../../shared/components/Ui';
import { useQuery } from '@tanstack/react-query';
import { API_BASE, getJson } from '../../../shared/api/client';
import { jobStage, runStatuses, statusLabels, useAdminRows, versionOutput, type DataSelection } from '../../admin/dataViews';
import { dateTime, duration, safeObject, safeText, safeUrl } from '../../../shared/utils/format';

const statuses = ['ALL', 'PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'];
export const statusTone = (status: string) => status === 'SUCCESS' ? 'green' : status === 'PARTIAL_SUCCESS' ? 'amber' : status === 'FAILED' ? 'red' : status === 'RUNNING' ? 'blue' : 'neutral';

export function RunDrawer({ id, onClose, onOperation, onJob, onSource, onQuality, onRaw, onIssue, onOutput, onProcess, onLinkedRun }: { id: string | null; onClose: () => void; onOperation?: (operation: Operation) => void; onJob: (id: string) => void; onSource: (id: number) => void; onQuality: (id: string) => void; onRaw: (id: string) => void; onIssue: (issue: ValidationResult) => void; onOutput: (selection: DataSelection) => void; onProcess: (id: string) => void; onLinkedRun: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const { run, payloads } = useRunDetail(id);
  const validation = useLinkedValidation(id);
  const versions = useLinkedVersions(id);
  const source = run.data?.metadata as { sourceVersionId?: string } | undefined;
  const buildVersionId = typeof source?.sourceVersionId === 'string' ? source.sourceVersionId : undefined;
  const runParams = run.data?.requestQueryParams as { operation?: string } | undefined;
  const operation = payloads.data?.[0]?.entityType ?? runParams?.operation;
  const buildVersion = useQuery({
    queryKey: ['run-build-version', buildVersionId], enabled: !!buildVersionId,
    queryFn: () => getJson<{ rows: { id: string; data_domain: string; status: string; version_code: string; ingestion_run_id: string }[] }>(
      API_BASE, `/api/admin/console/data/data_versions?id=${encodeURIComponent(buildVersionId!)}&size=1`),
  });
  if (!id) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(id); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); } };
  return <Drawer title={buildVersionId ? "Lượt ghi dữ liệu" : "Lượt chạy job"} subtitle={id} onClose={onClose}><button className="light-button" onClick={copy}><Copy size={14}/>{copied ? 'Đã sao chép ID' : 'Sao chép ID lượt chạy'}</button><QueryState query={run}>{run.data && <>
    <div className="detail-section"><div className="eyebrow">TỔNG QUAN</div><div className="detail-grid"><div><span>Trạng thái</span><Badge tone={statusTone(run.data.status)}>{run.data.status}</Badge></div><div><span>Kích hoạt</span><b>{run.data.triggerType}</b></div><div><span>Job ID</span><b className="break">{run.data.ingestionJobId || '—'}</b></div><div><span>Nguồn dữ liệu ID</span><b>{run.data.dataSourceId}</b></div></div></div>
    <div className="operation-actions">{run.data.ingestionJobId && <button className="light-button" onClick={() => onJob(run.data!.ingestionJobId!)}>Xem job</button>}<button className="light-button" onClick={() => onSource(run.data!.dataSourceId)}>Xem nguồn dữ liệu</button><button className="light-button" onClick={() => onQuality(id)}>Xem validation của lượt chạy</button></div>
    <div className="detail-section"><div className="eyebrow">THỰC THI</div><p>Bắt đầu: {dateTime(run.data.startedAt)}</p><p>Kết thúc: {dateTime(run.data.finishedAt)}</p><p>Thời lượng: {duration(run.data.startedAt, run.data.finishedAt)}</p></div>
    <div className="detail-section"><div className="eyebrow">SỐ BẢN GHI</div><div className="count-grid">{[['Đã lấy', run.data.fetchedCount], ['Thêm mới', run.data.insertedCount], ['Cập nhật', run.data.updatedCount], ['Từ chối', run.data.rejectedCount], ['Lỗi', run.data.errorCount]].map(([label, value]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></div>
    <section className="detail-section run-stages">
      <h3>Luồng của lượt chạy</h3>
      <div className="run-stage"><strong>1. Lấy dữ liệu</strong>
        <span>{payloads.data ? `${payloads.data.length} raw` : '—'}</span></div>
      <div className="run-stage"><strong>2. Kiểm tra</strong>
        <span>{validation.data ? `${validation.data.length}${validation.data.length >= LINKED_LIMIT ? '+' : ''} kết quả` : '—'}</span>
        <button className="text-button" onClick={() => onQuality(id)}>Mở kết quả kiểm tra</button></div>
      <div className="run-stage"><strong>3. Ghi dữ liệu</strong>
        {!!payloads.data?.length && <button className="text-button" onClick={() => { onClose(); onProcess(id); }}>Tiếp tục xử lý</button>}
      </div>
      <QueryState query={buildVersionId ? buildVersion : versions}>
        {(() => {
          const rows = buildVersionId ? (buildVersion.data?.rows ?? []).map(item => ({
            id: item.id, dataDomain: item.data_domain, status: item.status, versionCode: item.version_code, ingestionRunId: item.ingestion_run_id,
          })) : (versions.data ?? []);
          if (!rows.length) return <p className="subtle">Chưa có phiên bản liên kết.</p>;
          return rows.map(version => {
            const output = versionOutput(version.id, version.dataDomain, version.status, operation ?? undefined);
            return <div key={version.id} className="run-version">
              <div><strong>{version.versionCode ?? version.id}</strong><small>{version.dataDomain ?? '—'}</small></div>
              <Badge tone={output ? 'green' : 'neutral'}>{statusLabels[version.status ?? ''] ?? version.status}</Badge>
              {buildVersionId && version.ingestionRunId && version.ingestionRunId !== id &&
                <button className="text-button" onClick={() => onLinkedRun(version.ingestionRunId!)}>Mở lượt lấy nguồn</button>}
              {output && <button className="light-button" onClick={() => onOutput(output)}>
                {output.exact ? 'Xem dữ liệu đã ghi' : 'Xem thành phần rổ chỉ số'}</button>}
            </div>;
          });
        })()}
      </QueryState>
    </section>
    <div className="detail-section"><div className="eyebrow">YÊU CẦU / PHẢN HỒI</div><p>Phương thức: {run.data.requestMethod || '—'}</p><p>URL: {safeUrl(run.data.requestUrl)}</p><p>HTTP status: {run.data.responseHttpStatus ?? '—'}</p><p>Content type: {run.data.responseContentType || '—'}</p><pre>{safeObject(run.data.requestQueryParams)}</pre></div>
    <div className="detail-section"><div className="eyebrow">CHẨN ĐOÁN</div><p>{run.data.errorMessage ? safeText(run.data.errorMessage) : 'Không có thông báo lỗi.'}</p><pre>{safeObject(run.data.metadata)}</pre></div>
    <div className="detail-section"><div className="eyebrow">DỮ LIỆU NGUỒN (RAW)</div><QueryState query={payloads} empty="Lượt này không có raw riêng.">{payloads.data?.map(payload => <div className="mini-record" key={payload.id}><b>{payload.externalKey || payload.id}</b><span>{payload.entityType || '—'} · {payload.sourceSymbol || '—'} · {payload.contentType || '—'}</span><span>Payload ID: {payload.id}</span><button className="light-button" onClick={() => onRaw(payload.id)}>Xem raw payload</button><span>Checksum: {payload.checksumSha256 || '—'}</span><span>Lấy lúc: {dateTime(payload.fetchedAt)} · Tạo lúc: {dateTime(payload.createdAt)}</span>{onOperation && <button className="light-button" onClick={() => { onClose(); onOperation({ kind: 'validate-raw', rawId: payload.id }); }}>Chạy validation</button>}</div>)}</QueryState></div>
    <div className="detail-section"><div className="eyebrow">KẾT QUẢ KIỂM TRA</div><QueryState query={validation} empty="Chưa có kết quả validation cho lượt chạy này.">{validation.data?.map(item => <button className="mini-record mini-action" key={item.id} onClick={() => onIssue(item)}><b>{item.ruleCode} · {item.status}</b><span>{item.severity} · {item.handlingStatus} · {dateTime(item.checkedAt)}</span><span>{safeText(item.message)}</span></button>)}</QueryState></div>
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

export function JobRunHistory({ jobs, sources, initialJobId, onRun }: {
  jobs: UseQueryResult<IngestionJob[]>; sources?: DataSource[];
  initialJobId?: string; onRun: (id: string) => void;
}) {
  const [jobId, setJobId] = useState(initialJobId ?? '');
  const [scope, setScope] = useState<'all' | 'source' | 'processing'>('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const jobsById = useMemo(() => new Map(jobs.data?.map(job => [job.id, job])), [jobs.data]);
  const sourcesById = useMemo(() => new Map(sources?.map(source => [String(source.id), source.name])), [sources]);
  const term = search.trim().toLowerCase();
  const choices = [...(jobs.data ?? [])].filter(job => {
    if (job.id === jobId) return true;
    return (scope === 'all' || jobStage(job) === scope) && `${job.name} ${job.code}`.toLowerCase().includes(term);
  }).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const ready = scope === 'all' || !!jobId;
  const params = new URLSearchParams();
  if (jobId) params.set('ingestion_job_id', jobId);
  if (status) params.set('status', status);
  const history = useAdminRows('ingestion_runs', page, params.toString(), { enabled: ready });
  const total = history.data?.total ?? 0;

  return <Panel title="Lịch sử job" action={<button className="text-button" disabled={!ready || history.isFetching} onClick={() => history.refetch()}>
    <RefreshCw size={14}/> Tải lại</button>}>
    <div className="ledger-filters">
      <label>Nhóm job<select aria-label="Nhóm job" value={scope} onChange={event => {
        setScope(event.target.value as typeof scope); setJobId(''); setSearch(''); setPage(0);
      }}>
        <option value="all">Tất cả lượt chạy</option>
        <option value="source">Lấy dữ liệu</option>
        <option value="processing">Xử lý & ghi dữ liệu</option>
      </select></label>
      <label>Tìm job<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc mã job"/></label>
      <label>Job<select aria-label="Job" value={jobId} disabled={jobs.isPending} onChange={event => { setJobId(event.target.value); setPage(0); }}>
        <option value="">{jobs.isPending ? 'Đang tải job…' : scope === 'all' ? 'Tất cả job' : 'Chọn job để xem lịch sử'}</option>
        {jobId && !jobsById.has(jobId) && <option value={jobId}>{jobId}</option>}
        {choices.map(job => <option key={job.id} value={job.id}>{job.name} · {job.code}</option>)}
      </select></label>
      <label>Trạng thái<select aria-label="Trạng thái" value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}>
        <option value="">Tất cả</option>{runStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}
      </select></label>
    </div>
    {jobs.isError && <p role="alert">Không tải được danh sách job. <button className="text-button" onClick={() => jobs.refetch()}>Thử lại</button></p>}
    {term && !choices.some(job => `${job.name} ${job.code}`.toLowerCase().includes(term)) && <p className="state-empty">Không có job khớp tên hoặc mã.</p>}
    {!ready ? <p className="state-empty">Chọn một job để xem các lần chạy.</p> : <QueryState query={history}>
      {history.data?.rows?.length ? <div className="table-scroll"><table className="ledger-table">
        <thead><tr><th>Job / Nguồn</th><th>Trạng thái</th><th>Bắt đầu</th><th>Đã lấy</th><th>Đã lưu</th><th>Lỗi</th><th>Chi tiết</th></tr></thead>
        <tbody>{history.data.rows.map(row => {
          const job = jobsById.get(String(row.ingestion_job_id));
          const sourceName = sourcesById.get(String(row.data_source_id)) ?? safeText(String(row.source_code ?? row.data_source_id ?? ''));
          const rowStatus = String(row.status ?? '');
          return <tr key={String(row.id)}>
            <td><button className="text-button ledger-job" onClick={() => onRun(String(row.id))}>{job?.name ?? 'Lượt chạy trực tiếp'}</button>
              <small>{job ? `${jobStage(job) === 'source' ? 'Lấy nguồn' : 'Xử lý'} · ${job.code} · ${sourceName}` : sourceName}</small></td>
            <td><Badge tone={statusTone(rowStatus)}>{statusLabels[rowStatus] ?? rowStatus}</Badge></td>
            <td>{dateTime(String(row.started_at ?? ''))}</td><td>{String(row.fetched_count ?? '—')}</td>
            <td>{String(row.inserted_count ?? '—')}</td><td>{String(row.error_count ?? '—')}</td>
            <td><button className="light-button" onClick={() => onRun(String(row.id))}>Mở lượt chạy</button></td>
          </tr>;
        })}</tbody>
      </table></div> : <p className="state-empty">Không có lượt chạy phù hợp.</p>}
      <div className="toolbar ledger-pager"><span>{total.toLocaleString('vi-VN')} lượt · Trang {page + 1}</span>
        <button className="light-button" disabled={!page || history.isFetching} onClick={() => setPage(value => value - 1)}>Trang trước</button>
        <button className="light-button" disabled={(page + 1) * 25 >= total || history.isFetching} onClick={() => setPage(value => value + 1)}>Trang sau</button>
      </div>
    </QueryState>}
  </Panel>;
}
