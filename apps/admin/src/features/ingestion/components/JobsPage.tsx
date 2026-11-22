import type { Operation } from '../../operations/OperationDrawer';
import { useMemo, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DataSource, IngestionJob, IngestionRun } from '../../dashboard/types/dto';
import { Badge, Drawer, Panel, QueryState } from '../../../shared/components/Ui';
import { dateTime, safeObject } from '../../../shared/utils/format';

export function JobsPage({ jobs, sources, runs, onRun, onOperation, linkedId, onSource, onHistory }: { jobs: UseQueryResult<IngestionJob[]>; sources?: DataSource[]; runs?: IngestionRun[]; onRun: (id: string) => void; onOperation?: (operation: Operation) => void; linkedId?: string | null; onSource?: (id: number) => void; onHistory?: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [dataset, setDataset] = useState('ALL');
  const [active, setActive] = useState('ALL');
  const [sort, setSort] = useState('name');
  const [snapshot, setSelected] = useState<IngestionJob | null>(null);
  const selected = jobs.data?.find(job => job.id === snapshot?.id) || snapshot;
  const linked = linkedId ? jobs.data?.find(job => job.id === linkedId) : undefined;
  const sourceName = (job: IngestionJob) => sources?.find(source => source.id === job.dataSourceId)?.name || job.dataSourceCode || `Nguồn #${job.dataSourceId}`;
  const datasets = useMemo(() => [...new Set(jobs.data?.map(job => job.datasetType) || [])].sort(), [jobs.data]);
  const rows = useMemo(() => [...(jobs.data || [])].filter(job => `${job.name} ${job.code} ${job.dataSourceCode}`.toLowerCase().includes(search.toLowerCase()) && (dataset === 'ALL' || job.datasetType === dataset) && (active === 'ALL' || String(job.active) === active)).sort((a, b) => sort === 'created' ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : (sort === 'code' ? a.code.localeCompare(b.code) : a.name.localeCompare(b.name))), [jobs.data, search, dataset, active, sort]);
  const related = selected && runs?.filter(run => run.ingestionJobId === selected.id);
  const act = (operation: Operation) => { setSelected(null); onOperation?.(operation); };
  return <>
    {linkedId && <div className="connection-strip">Job liên quan: {linkedId} {linked ? <button className="text-button" onClick={() => setSelected(linked)}>Xem chi tiết job</button> : <span>Job không có trong danh sách đã tải.</span>}</div>}
    <Panel eyebrow="CẤU HÌNH JOB" title="Job lấy dữ liệu" action={<button className="text-button" disabled={jobs.isFetching} onClick={() => jobs.refetch()}><RefreshCw size={14}/>{jobs.isFetching ? 'Đang tải…' : 'Tải lại'}</button>}>
      <div className="toolbar filters"><label>Tìm kiếm <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên, mã job hoặc mã nguồn"/></label><label>Loại dữ liệu <select value={dataset} onChange={event => setDataset(event.target.value)}><option value="ALL">Tất cả loại dữ liệu</option>{datasets.map(type => <option key={type}>{type}</option>)}</select></label><label>Trạng thái <select value={active} onChange={event => setActive(event.target.value)}><option value="ALL">Tất cả</option><option value="true">Đang bật</option><option value="false">Đang tắt</option></select></label><label>Sắp xếp <select value={sort} onChange={event => setSort(event.target.value)}><option value="name">Tên A–Z</option><option value="code">Mã A–Z</option><option value="created">Mới tạo trước</option></select></label><span className="subtle">{jobs.data ? `${rows.length} / ${jobs.data.length} job` : '—'}</span></div>
      <QueryState query={jobs} empty="Chưa có job lấy dữ liệu."><div className="table-scroll"><table><thead><tr><th>Job</th><th>Nguồn dữ liệu</th><th>Loại dữ liệu</th><th>Cron</th><th>Retry</th><th>Timeout</th><th>Trạng thái</th><th>Tạo lúc</th><th>Thao tác</th></tr></thead><tbody>{rows.map(job => <tr key={job.id} tabIndex={0} onClick={() => setSelected(job)} onKeyDown={event => event.key === 'Enter' && setSelected(job)}><td><strong>{job.name}</strong><small>{job.code}</small></td><td>{sourceName(job)}</td><td>{job.datasetType}</td><td className="mono">{job.cronExpression || 'Không lịch'}</td><td>{job.maxRetries}</td><td>{job.timeoutSeconds}s</td><td><Badge tone={job.active ? 'green' : 'neutral'}>{job.active ? 'Đang bật' : 'Đang tắt'}</Badge></td><td>{dateTime(job.createdAt)}</td><td>{onHistory ? <button className="text-button" onClick={event => { event.stopPropagation(); onHistory(job.id); }}>Lịch sử</button> : <ChevronRight size={16}/>}</td></tr>)}</tbody></table></div>{rows.length === 0 && <div className="state-empty">Không có job khớp bộ lọc.</div>}</QueryState>
    </Panel>
    {selected && <Drawer title={selected.name} subtitle={selected.code} onClose={() => setSelected(null)}>{onOperation && <div className="operation-actions"><button className="light-button" onClick={() => act({ kind: 'edit-job', job: selected })}>Sửa job</button><button className="primary-button" onClick={() => act({ kind: 'run-job', job: selected })}>Chạy ngay</button><button className="light-button" onClick={() => act({ kind: 'activation', job: selected })}>{selected.active ? 'Tắt job' : 'Bật job'}</button></div>}<div className="toolbar"><button className="light-button" onClick={() => { setSelected(null); onSource?.(selected.dataSourceId); }}>Xem nguồn dữ liệu</button>
      {onHistory && <button className="light-button" onClick={() => { setSelected(null); onHistory(selected.id); }}>Xem toàn bộ lịch sử job</button>}</div>
      <div className="detail-grid"><div><span>Job ID</span><b className="break">{selected.id}</b></div><div><span>Loại dữ liệu</span><b>{selected.datasetType}</b></div><div><span>Nguồn dữ liệu</span><b>{sourceName(selected)}</b></div><div><span>Cấu hình</span><Badge tone={selected.active ? 'green' : 'neutral'}>{selected.active ? 'Đang bật' : 'Đang tắt'}</Badge></div><div><span>Retry tối đa</span><b>{selected.maxRetries}</b></div><div><span>Timeout</span><b>{selected.timeoutSeconds} giây</b></div></div>
      <div className="detail-section"><div className="eyebrow">LỊCH CHẠY</div><p>{selected.cronExpression || 'Chưa cấu hình cron'}</p></div>
      <div className="detail-section"><div className="eyebrow">THAM SỐ · ĐÃ ẨN GIÁ TRỊ NHẠY CẢM</div><pre>{safeObject(selected.parameters)}</pre></div>
      <div className="detail-section"><div className="eyebrow">TẠO LÚC</div><p>{dateTime(selected.createdAt)}</p></div>
      <div className="detail-section"><div className="eyebrow">LƯỢT CHẠY GẦN ĐÂY</div>{runs === undefined ? <p>Đang tải các lượt chạy gần đây…</p> : related?.length ? related.map(run => <button className="mini-record mini-action" key={run.id} onClick={() => { setSelected(null); onRun(run.id); }}><b>{run.status} · {run.id}</b><span>{dateTime(run.startedAt)}</span></button>) : <p>Không có lượt chạy trong danh sách gần đây.</p>}</div>
    </Drawer>}
  </>;
}
