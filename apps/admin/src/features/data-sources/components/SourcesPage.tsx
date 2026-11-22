import type { Operation } from '../../operations/OperationDrawer';
import { useMemo, useState } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DataSource, IngestionJob, IngestionRun } from '../../dashboard/types/dto';
import { Badge, Drawer, Panel, QueryState } from '../../../shared/components/Ui';
import { dateTime, safeUrl } from '../../../shared/utils/format';

export function SourcesPage({ sources, jobs, runs, onRun, onOperation, linkedId, onJob }: { sources: UseQueryResult<DataSource[]>; jobs?: IngestionJob[]; runs?: IngestionRun[]; onRun: (id: string) => void; onOperation?: (operation: Operation) => void; linkedId?: number | null; onJob?: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [provider, setProvider] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [active, setActive] = useState('ALL');
  const [sort, setSort] = useState('priority');
  const [snapshot, setSelected] = useState<DataSource | null>(null);
  const selected = sources.data?.find(source => source.id === snapshot?.id) || snapshot;
  const linked = linkedId != null ? sources.data?.find(source => source.id === linkedId) : undefined;
  const providers = useMemo(() => [...new Set(sources.data?.map(source => source.provider) || [])].sort(), [sources.data]);
  const types = useMemo(() => [...new Set(sources.data?.map(source => source.sourceType) || [])].sort(), [sources.data]);
  const rows = useMemo(() => [...(sources.data || [])].filter(source => `${source.name} ${source.code} ${source.provider}`.toLowerCase().includes(search.toLowerCase()) && (provider === 'ALL' || source.provider === provider) && (type === 'ALL' || source.sourceType === type) && (active === 'ALL' || String(source.active) === active)).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.priority - a.priority || a.name.localeCompare(b.name)), [sources.data, search, provider, type, active, sort]);
  const relatedJobs = selected && jobs?.filter(job => job.dataSourceId === selected.id);
  const activeJobs = relatedJobs?.filter(job => job.active).length ?? 0;
  const relatedRuns = selected && runs?.filter(run => run.dataSourceId === selected.id);
  return <>
    {linkedId != null && <div className="connection-strip">Nguồn liên quan: #{linkedId} {linked ? <button className="text-button" onClick={() => setSelected(linked)}>Xem chi tiết nguồn</button> : <span>Nguồn không có trong danh sách đã tải.</span>}</div>}
    <Panel title="Nguồn dữ liệu" action={<button className="text-button" disabled={sources.isFetching} onClick={() => sources.refetch()}><RefreshCw size={14}/>{sources.isFetching ? 'Đang tải…' : 'Tải lại'}</button>}>
      <div className="toolbar filters"><label>Tìm kiếm <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên, mã, nhà cung cấp"/></label><label>Nhà cung cấp <select value={provider} onChange={event => setProvider(event.target.value)}><option value="ALL">Tất cả</option>{providers.map(value => <option key={value}>{value}</option>)}</select></label><label>Loại nguồn <select value={type} onChange={event => setType(event.target.value)}><option value="ALL">Tất cả</option>{types.map(value => <option key={value}>{value}</option>)}</select></label><label>Trạng thái <select value={active} onChange={event => setActive(event.target.value)}><option value="ALL">Tất cả</option><option value="true">Đang bật</option><option value="false">Đang tắt</option></select></label><label>Sắp xếp <select value={sort} onChange={event => setSort(event.target.value)}><option value="priority">Ưu tiên cao trước</option><option value="name">Tên A–Z</option></select></label><span className="subtle">{sources.data ? `${rows.length} / ${sources.data.length} nguồn` : '—'}</span></div>
      <QueryState query={sources} empty="Chưa có nguồn dữ liệu."><div className="table-scroll"><table><thead><tr><th>Tên / Mã</th><th>Nhà cung cấp</th><th>Loại nguồn</th><th>Ưu tiên</th><th>Chính thức</th><th>Giấy phép</th><th>Trạng thái</th><th></th></tr></thead><tbody>{rows.map(source => <tr key={source.id} tabIndex={0} onClick={() => setSelected(source)} onKeyDown={event => event.key === 'Enter' && setSelected(source)}><td><strong>{source.name}</strong><small>{source.code}</small></td><td>{source.provider}</td><td>{source.sourceType}</td><td>{source.priority}</td><td>{source.official ? 'Có' : 'Không'}</td><td>{source.licenseStatus || '—'}</td><td><Badge tone={source.active ? 'green' : 'neutral'}>{source.active ? 'Đang bật' : 'Đang tắt'}</Badge></td><td><ChevronRight size={16}/></td></tr>)}</tbody></table></div>{rows.length === 0 && <div className="state-empty">Không có nguồn khớp bộ lọc.</div>}</QueryState>
    </Panel>
    {selected && <Drawer title={selected.name} subtitle={selected.code} onClose={() => setSelected(null)}>{onOperation && <button className="primary-button" onClick={() => { setSelected(null); onOperation({ kind: 'upsert-source', source: selected }); }}>Sửa nguồn dữ liệu</button>}
      <div className="detail-grid"><div><span>Nguồn ID</span><b>{selected.id}</b></div><div><span>Nhà cung cấp</span><b>{selected.provider}</b></div><div><span>Loại nguồn</span><b>{selected.sourceType}</b></div><div><span>Ưu tiên</span><b>{selected.priority}</b></div><div><span>Chính thức</span><b>{selected.official ? 'Có' : 'Không'}</b></div><div><span>Cấu hình</span><Badge tone={selected.active ? 'green' : 'neutral'}>{selected.active ? 'Đang bật' : 'Đang tắt'}</Badge></div></div>
      <div className="detail-section"><div className="eyebrow">GIẤY PHÉP & NGUỒN</div><p>Giấy phép: {selected.licenseStatus || '—'}</p><p>Base URL: {safeUrl(selected.baseUrl)}</p></div>
      <div className="detail-section"><div className="eyebrow">JOB DÙNG NGUỒN NÀY · {relatedJobs?.length ?? 0} JOB, {activeJobs} ĐANG BẬT</div>{relatedJobs?.length ? relatedJobs.slice(0, 12).map(job => <button className="mini-record mini-action" key={job.id} onClick={() => { setSelected(null); onJob?.(job.id); }}><b>{job.name}</b><span>{job.code} · {job.active ? 'đang bật' : 'đang tắt'}</span></button>) : <p>Không có job nào dùng nguồn này.</p>}{(relatedJobs?.length || 0) > 12 && <p>Hiển thị 12 / {relatedJobs?.length} job; lọc theo mã nguồn ở danh sách job để xem hết.</p>}</div>
      <div className="detail-section"><div className="eyebrow">LƯỢT CHẠY LIÊN QUAN · TRONG 20 LƯỢT MỚI NHẤT</div>{relatedRuns?.length ? relatedRuns.map(run => <button className="mini-record mini-action" key={run.id} onClick={() => { setSelected(null); onRun(run.id); }}><b>{run.status} · {run.id}</b><span>{dateTime(run.startedAt)}</span></button>) : <p>Không có trong 20 lượt mới nhất.</p>}</div>
    </Drawer>}
  </>;
}
