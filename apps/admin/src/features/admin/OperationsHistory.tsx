import { Pagination, usePagination } from '../../shared/components/Pagination';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { API_BASE, getJson, requestJson } from '../../shared/api/client';
import { Drawer, Panel, QueryState } from '../../shared/components/Ui';
import { ApiResult, Records, type Row } from './Records';
import { CommandTracker } from './CommandTracker';
import type { RunLink } from './AiRunHistory';
import { statusLabels, tableStatuses, useAdminRows, versionOutput, type DataSelection } from './dataViews';
import type { WorkflowSelection } from './WorkflowPage';

export function OperationsHistory({ kind, onRun, onRaw, onWorkflow, onOutput, onAiRun }: {
  kind: 'commands' | 'quality'; onRun: (id: string) => void; onRaw: (id: string) => void;
  onWorkflow: (selection: WorkflowSelection) => void; onOutput: (selection: DataSelection) => void;
  onAiRun: (run: RunLink) => void;
}) {
  const initial = kind === 'commands' ? 'admin_commands' : 'validation_results';
  const [table, setTable] = useState(initial); const { page, size, setPage, changeSize } = usePagination(); const [status, setStatus] = useState(''); const [query, setQuery] = useState(''); const [filter, setFilter] = useState(''); const [target, setTarget] = useState('');
  const [version, setVersion] = useState<Row | null>(null);
  const [command, setCommand] = useState<string | null>(null); const [issue, setIssue] = useState<Row | null>(null);
  const data = useAdminRows(table, page, size, filter, { refetchInterval: kind === 'commands' ? 5000 : undefined });
  const statuses = tableStatuses[table];
  return <div className="admin-stack"><Panel title={kind === 'commands' ? 'Tác vụ nền' : 'Lịch sử xử lý'}>
    {kind === 'quality' && <label className="ledger-field">Bước xử lý<select aria-label="Danh mục chất lượng" value={table} onChange={e => { setTable(e.target.value); setFilter(''); setPage(0); setQuery(''); setStatus(''); setTarget(''); }}><option value="validation_results">Kiểm tra dữ liệu</option><option value="data_versions">Phiên bản và kết quả ghi</option></select></label>}
    <form className="ledger-filters" onSubmit={e => { e.preventDefault(); setPage(0); setFilter(`search=${encodeURIComponent(query)}${status ? `&status=${encodeURIComponent(status)}` : ''}${table === 'validation_results' && target ? `&validation_target=${target}` : ''}`); }}>
      <label>Tìm mã / ID / nội dung<input value={query} onChange={e => setQuery(e.target.value)} maxLength={100}/></label>
      {statuses && <label>Trạng thái<select aria-label="Trạng thái" value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">Tất cả</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value] ?? value}</option>)}
      </select></label>}
      {table === 'validation_results' && <label>Đối tượng validation<select aria-label="Đối tượng validation" value={target} onChange={e => setTarget(e.target.value)}><option value="">Tất cả</option><option value="RAW_PAYLOAD">Dữ liệu nguồn</option><option value="LLM_OUTPUT">Đầu ra AI</option></select></label>}
      <div className="ledger-actions"><button className="primary-button">Lọc lịch sử</button></div>
    </form><QueryState query={data}><Records serverPaged rows={Array.isArray(data.data?.rows) ? data.data.rows : []} onRun={onRun} onRaw={onRaw} actions={row => {
      const output = table === 'data_versions' && versionOutput(String(row.id), String(row.data_domain), String(row.status));
      return <>
      {table === 'admin_commands' && <button className="text-button" onClick={() => setCommand(String(row.id))}>Theo dõi / xử lý</button>}
      {table === 'data_versions' && row.status === 'PENDING_REVIEW' && <button className="text-button" onClick={() => setVersion(row)}>Duyệt lệch nguồn</button>}
      {table === 'data_versions' && row.status === 'ACTIVE' && <button className="text-button" onClick={() => onWorkflow({ mode: 'BUILD_VERSION', versionId: String(row.id) })}>Ghi vào bảng đích</button>}
      {table === 'validation_results' && row.result_status === 'FAIL' && <button className="text-button" onClick={() => setIssue(row)}>Ghi nhận xử lý lỗi</button>}
      {output && <button className="text-button" onClick={() => onOutput(output)}>Xem dữ liệu đã ghi</button>}
    </>; }}/><Pagination page={page} size={size} total={data.data?.total ?? 0} onPage={setPage} onSize={changeSize} busy={data.isFetching}/></QueryState>
  </Panel>{command && <CommandTracker key={command} id={command} onRun={onRun} onCommand={setCommand} onAiRun={onAiRun}/>} {version && <SourceReview key={String(version.id)} version={version} close={() => setVersion(null)}
    onDecided={accept => {
      setVersion(null);
      void data.refetch();
      if (accept) onWorkflow({ mode: 'BUILD_VERSION', versionId: String(version.id) });
    }}/>} {issue && <IssueReview key={String(issue.id)} issue={issue} close={() => setIssue(null)} onRun={onRun}/>}</div>;
}
function IssueReview({ issue, close, onRun }: { issue: Row; close: () => void; onRun: (id: string) => void }) {
  const [note, setNote] = useState('');
  const path = `/api/admin/console/issues/${issue.id}/reviews`;
  const reviews = useQuery({ queryKey: ['issue-reviews', issue.id], queryFn: () => getJson<Row[]>(API_BASE, path) });
  const save = useMutation({ mutationFn: () => requestJson(API_BASE, path, 'POST', { reason: note }), retry: false, onSuccess: () => { setNote(''); void reviews.refetch(); } });
  return <Drawer title="Điều tra và ghi chú lỗi" subtitle={String(issue.rule_code)} onClose={close}><ApiResult value={issue}/>{typeof issue.ingestion_run_id === 'string' && <button className="light-button" onClick={() => onRun(issue.ingestion_run_id as string)}>Mở nguồn gây lỗi</button>}
    <label>Ghi chú xử lý<textarea aria-label="Ghi chú xử lý" value={note} maxLength={2000} onChange={e => setNote(e.target.value)}/></label><button className="primary-button" disabled={!note.trim() || save.isPending} onClick={() => save.mutate()}>Lưu ghi chú</button>{save.error && <p role="alert">{save.error.message}</p>}<QueryState query={reviews}><Records rows={reviews.data ?? []}/></QueryState></Drawer>;
}

function SourceReview({ version, close, onDecided }: {
  version: Row; close: () => void; onDecided: (accept: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const review = useMutation({
    mutationFn: (accept: boolean) => requestJson(API_BASE,
      `/api/admin/validation/data-versions/${version.id}/review`, 'POST', { accept, reason: reason.trim() }),
    onSuccess: (_result, accept) => onDecided(accept),
    retry: false,
  });
  return <Drawer title="Duyệt lệch nguồn" subtitle={String(version.version_code ?? version.id)} onClose={close}>
    <ApiResult value={version}/>
    <label>Lý do duyệt<textarea maxLength={2000} value={reason} onChange={event => setReason(event.target.value)}/></label>
    <div className="toolbar">
      <button className="primary-button" disabled={!reason.trim() || review.isPending}
        onClick={() => review.mutate(true)}>Chấp nhận nguồn mới</button>
      <button className="light-button" disabled={!reason.trim() || review.isPending}
        onClick={() => review.mutate(false)}>Giữ dữ liệu hiện tại</button>
    </div>
    {review.error && <p role="alert">{review.error.message}</p>}
  </Drawer>;
}
