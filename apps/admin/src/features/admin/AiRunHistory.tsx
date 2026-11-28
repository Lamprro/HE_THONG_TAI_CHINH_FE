import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { API_BASE, getJson } from '../../shared/api/client';
import { PaginatedTable, Pagination, usePagination } from '../../shared/components/Pagination';
import { Badge, Drawer, Panel, QueryState } from '../../shared/components/Ui';
import { dateTime } from '../../shared/utils/format';
import { CommandTracker, submitCommand, useCommand } from './CommandTracker';
import { ApiResult, type Row } from './Records';

export const forecastTask = 'FINANCIAL_SCENARIOS';
export const recoveryTask = 'NEWS_CONTENT_RECOVERY';
const tasks: Record<string, string> = {
  [forecastTask]: 'Dự báo', NEWS_SUMMARY: 'Tóm tắt tin', NEWS_DETAIL: 'Phân tích tin',
  NEWS_FINANCIAL_FACTS: 'Trích xuất số liệu', [recoveryTask]: 'Khôi phục nội dung',
};
const statuses: Record<string, string> = {
  PENDING: 'Chờ chạy', RUNNING: 'Đang chạy', PENDING_VALIDATION: 'Chờ kiểm tra',
  SUCCESS: 'Thành công', FAILED: 'Thất bại', REJECTED: 'Bị từ chối',
};
const outcomes: Record<string, string> = {
  READY_FOR_EXECUTION: 'Đầu vào sẵn sàng', INPUT_NOT_ELIGIBLE: 'Đầu vào chưa đủ',
  CONFIGURATION_REQUIRED: 'Thiếu cấu hình LLM', CACHED: 'Dùng kết quả đã lưu', SKIPPED: 'Đã bỏ qua',
};
const actions: Record<string, string> = {
  FORECAST_PREVIEW: 'Kiểm tra đầu vào', FORECAST_EXECUTE: 'Chạy dự báo', FORECAST_RETRY: 'Chạy lại dự báo',
  FORECAST_METRICS: 'Tính chỉ số', NEWS_EXECUTE: 'Phân tích tin', RECOVERY_EXECUTE: 'Khôi phục nội dung',
  FORECAST_REVALIDATE: 'Kiểm tra lại dự báo', NEWS_REVALIDATE: 'Kiểm tra lại phân tích tin',
  FORECAST_VALIDATE_PENDING: 'Kiểm tra dự báo đang chờ', NEWS_VALIDATE_PENDING: 'Kiểm tra tin đang chờ',
  RECOVERY_APPROVE: 'Duyệt nội dung khôi phục', RECOVERY_REJECT: 'Từ chối nội dung khôi phục',
  RECOVERY_ANALYZE: 'Phân tích tin đã duyệt', HISTORICAL_METRICS: 'Tính chỉ số lịch sử',
};
type Page<T> = { content: T[]; totalElements: number };
type Run = { id: string; taskCode: string; status: string; symbol?: string; articleTitle?: string; newsArticleId?: string;
  provider?: string; modelName?: string; promptVersion?: string; httpStatus?: number; attemptCount: number;
  retryable: boolean; errorMessage?: string; createdAt: string; finishedAt?: string };
type Command = { id: string; action: string; resourceKey: string; status: string; outcome?: string; createdAt: string; errorMessage?: string };
export type RunLink = { id: string; task?: string };

export function AiRunHistory({ selection, onSelect, onResumeForecast, onRecovery }: {
  selection: RunLink | null;
  onSelect: (run: RunLink | null) => void;
  onResumeForecast: (request: Row, commandId: string) => void;
  onRecovery: (run: string, article: string) => void;
}) {
  const [view, setView] = useState<'runs' | 'commands'>('runs');
  const [task, setTask] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [commandId, setCommandId] = useState<string | null>(null);
  const [fromCommand, setFromCommand] = useState(false);
  const { page, size, setPage, changeSize } = usePagination();
  const params = new URLSearchParams({ page: String(page), size: String(size), task, status, search: search.trim() });
  const runs = useQuery({ queryKey: ['llm-history', params.toString()], enabled: view === 'runs',
    queryFn: () => getJson<Page<Run>>(API_BASE, '/api/admin/llm/runs?' + params),
    refetchInterval: q => q.state.data?.content.some(row => row.status === 'RUNNING') ? 4000 : false });
  const commands = useQuery({ queryKey: ['ai-command-history', page, size], enabled: view === 'commands',
    queryFn: () => getJson<Page<Command>>(API_BASE, '/api/admin/console/commands/ai?page=' + page + '&size=' + size),
    refetchInterval: q => q.state.data?.content.some(row => ['QUEUED', 'RUNNING'].includes(row.status)) ? 3000 : false });
  const list = view === 'runs' ? runs : commands;
  const selected = runs.data?.content.find(run => run.id === selection?.id);
  const command = useCommand(commandId);
  const request = command.data?.request_json as Row | undefined;
  const previewOutcome = command.data?.result_json as Row | undefined;
  const openRun = (link: RunLink) => { setFromCommand(true); onSelect(link); };

  return <>
    <Panel title="Lịch sử LLM" action={<button className="light-button" onClick={() => void list.refetch()}>Tải lại</button>}>
      <div className="toolbar">
        <button className={view === 'runs' ? 'primary-button' : 'light-button'} onClick={() => { setView('runs'); setPage(0); }}>Lượt chạy mô hình</button>
        <button className={view === 'commands' ? 'primary-button' : 'light-button'} onClick={() => { setView('commands'); setPage(0); }}>Lệnh quản trị AI</button>
      </div>
      {view === 'runs' && <div className="admin-form-grid">
        <label>Tác vụ<select aria-label="Tác vụ" value={task} onChange={event => { setTask(event.target.value); setPage(0); }}>
          <option value="">Tất cả</option>{Object.entries(tasks).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Trạng thái<select aria-label="Trạng thái" value={status} onChange={event => { setStatus(event.target.value); setPage(0); }}>
          <option value="">Tất cả</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>Tìm mã, tiêu đề hoặc ID<input value={search} maxLength={160} onChange={event => { setSearch(event.target.value); setPage(0); }}/></label>
      </div>}
      <QueryState query={list}>
        {view === 'runs' ? <div className="table-scroll"><table>
          <thead><tr><th>Tác vụ</th><th>Mã hoặc bài viết</th><th>Trạng thái</th><th>Mô hình</th><th>Lần gọi</th><th>Tạo lúc</th><th>Thao tác</th></tr></thead>
          <tbody>{runs.data?.content.map(run => <tr key={run.id}>
            <td>{tasks[run.taskCode] ?? run.taskCode}</td><td>{run.symbol ?? run.articleTitle ?? run.newsArticleId ?? '—'}</td>
            <td><Badge tone={runTone(run.status)}>{statuses[run.status] ?? run.status}</Badge>
              {run.errorMessage && <div className="subtle">{run.errorMessage}</div>}</td>
            <td>{run.modelName ?? '—'}</td><td>{run.attemptCount}</td><td>{dateTime(run.createdAt)}</td>
            <td><button className="text-button" onClick={() => { setFromCommand(false); onSelect({ id: run.id, task: run.taskCode }); }}>Chi tiết</button></td>
          </tr>)}</tbody>
        </table></div> : <div className="table-scroll"><table>
          <thead><tr><th>Lệnh</th><th>Trạng thái</th><th>Kết quả</th><th>Tạo lúc</th><th>Thao tác</th></tr></thead>
          <tbody>{commands.data?.content.map(row => <tr key={row.id}>
            <td>{actions[row.action] ?? row.action}</td><td><Badge tone={runTone(row.status)}>{row.status}</Badge></td>
            <td>{row.errorMessage ?? (row.outcome ? outcomes[row.outcome] ?? row.outcome : '—')}</td><td>{dateTime(row.createdAt)}</td>
            <td><button className="text-button" onClick={() => setCommandId(row.id)}>Chi tiết</button></td>
          </tr>)}</tbody>
        </table></div>}
        {list.data?.content.length === 0 && <p className="state-empty">Không có bản ghi.</p>}
        <Pagination page={page} size={size} total={list.data?.totalElements ?? 0} onPage={setPage} onSize={changeSize} busy={list.isFetching}/>
      </QueryState>
    </Panel>
    {commandId && (!selection || !fromCommand) && <Drawer title="Chi tiết lệnh AI" onClose={() => setCommandId(null)}>
      {command.data?.action === 'FORECAST_PREVIEW' && previewOutcome?.eligible === true && request &&
        <button className="primary-button" onClick={() => onResumeForecast(request, commandId)}>Tiếp tục sang dự báo</button>}
      <CommandTracker id={commandId} onRun={() => {}} onCommand={setCommandId} onAiRun={openRun}/>
    </Drawer>}
    {selection && <AiRunDetail key={selection.id} link={selection} summary={selected} onClose={() => onSelect(null)}
      onRecovery={onRecovery} onOpen={onSelect}/>}
  </>;
}

function runTone(status: string) {
  if (status === 'SUCCESS' || status === 'SUCCEEDED') return 'green';
  return ['FAILED', 'REJECTED', 'UNKNOWN'].includes(status) ? 'red' : 'neutral';
}

function AiRunDetail({ link, summary, onClose, onRecovery, onOpen }: {
  link: RunLink; summary?: Run; onClose: () => void; onRecovery: (run: string, article: string) => void;
  onOpen: (run: RunLink) => void;
}) {
  const [action, setAction] = useState<'retry' | 'validate' | null>(null);
  const [reason, setReason] = useState('');
  const [commandId, setCommandId] = useState<string | null>(null);
  const key = useRef('');
  const sending = useRef(false);
  const detail = useQuery({ queryKey: ['llm-history-detail', link.id], queryFn: () =>
    getJson<Row>(API_BASE, '/api/admin/llm/runs/' + encodeURIComponent(link.id)),
    refetchInterval: q => q.state.data?.status === 'RUNNING' ? 3000 : false });
  const row = detail.data;
  const task = String(row?.task_code ?? link.task ?? '');
  const status = String(row?.status ?? '');
  const article = String(row?.news_article_id ?? summary?.newsArticleId ?? '');
  const isNews = ['NEWS_SUMMARY', 'NEWS_DETAIL', 'NEWS_FINANCIAL_FACTS'].includes(task);
  const metadata = row?.request_metadata as Row | undefined;
  const retryable = ['FAILED', 'REJECTED'].includes(status) &&
    (task === forecastTask && !!metadata?.forecast_request || isNews && !!article);
  const currentCommand = useCommand(commandId);
  const busy = !!commandId && !currentCommand.isError &&
    ['QUEUED', 'RUNNING'].includes(String(currentCommand.data?.status ?? 'QUEUED'));
  const validations = Array.isArray(row?.validations) ? row.validations as Row[] : [];
  const attempts = Array.isArray(row?.attempts) ? row.attempts as Row[] : [];
  const mutation = useMutation({
    mutationFn: () => submitCommand(action === 'validate' ? task === forecastTask ? 'FORECAST_REVALIDATE' : 'NEWS_REVALIDATE'
      : task === forecastTask ? 'FORECAST_RETRY' : 'NEWS_EXECUTE',
    action === 'retry' && isNews ? { articleId: article, task } : { runId: link.id }, reason.trim(), key.current),
    onSuccess: result => { setCommandId(String(result.id)); setAction(null); setReason(''); },
  });
  const confirm = async () => {
    if (sending.current || !reason.trim()) return;
    sending.current = true;
    try { await mutation.mutateAsync(); } catch { /* Keep the command key for a transport retry. */ }
    finally { sending.current = false; }
  };
  return <Drawer title="Chi tiết lượt LLM" subtitle={link.id} onClose={onClose}>
    <QueryState query={detail}>
      <div className="toolbar"><Badge tone={runTone(status)}>{statuses[status] ?? status}</Badge><strong>{tasks[task] ?? task}</strong>
        <button className="light-button" onClick={() => void detail.refetch()}>Tải lại</button>
      </div>
      <dl className="record-detail">
        <div><dt>Nhà cung cấp / Mô hình</dt><dd>{String(row?.provider ?? '—')} / {String(row?.model_name ?? '—')}</dd></div>
        <div><dt>Phiên bản prompt</dt><dd>{String(row?.prompt_version ?? '—')}</dd></div>
        <div><dt>Thời gian</dt><dd>{dateTime(row?.created_at as string)} → {dateTime(row?.finished_at as string)}</dd></div>
        <div><dt>HTTP / Thời lượng</dt><dd>{String(row?.http_status ?? '—')} / {row?.latency_ms == null ? '—' : String(row.latency_ms) + ' ms'}</dd></div>
      </dl>
      {row?.error_message ? <p className="state-error" role="alert">{String(row.error_message)}</p> : null}
      <div className="toolbar">
        {retryable && <button className="primary-button" disabled={busy || !!action} onClick={() => { key.current = crypto.randomUUID(); setAction('retry'); mutation.reset(); }}>Chạy lại</button>}
        {(task === forecastTask || isNews) && ['PENDING_VALIDATION', 'SUCCESS', 'REJECTED'].includes(status) &&
          <button className="light-button" disabled={busy || !!action} onClick={() => { key.current = crypto.randomUUID(); setAction('validate'); mutation.reset(); }}>Kiểm tra lại phản hồi</button>}
        {task === recoveryTask && article && <button className="light-button" onClick={() => onRecovery(link.id, article)}>Mở xử lý khôi phục</button>}
      </div>
      {action && <div className="confirmation">
        <h3>{action === 'retry' ? 'Xác nhận chạy lại' : 'Xác nhận kiểm tra lại phản hồi đã lưu'}</h3>
        <label>Lý do<textarea value={reason} maxLength={2000} onChange={event => setReason(event.target.value)}/></label>
        <div className="toolbar">
          <button className="primary-button" disabled={!reason.trim() || mutation.isPending} onClick={() => void confirm()}>Xác nhận</button>
          <button className="light-button" disabled={mutation.isPending} onClick={() => setAction(null)}>Quay lại</button>
        </div>
        {mutation.error && <p role="alert">{mutation.error.message}</p>}
      </div>}
      {commandId && <CommandTracker id={commandId} onRun={() => {}} onCommand={setCommandId} onAiRun={onOpen}/>}
      <h3>Lần gọi nhà cung cấp ({attempts.length})</h3>
      {attempts.length > 0 ? <div className="table-scroll"><PaginatedTable>
        <thead><tr><th>Lần</th><th>Mô hình</th><th>HTTP</th><th>Thời lượng (ms)</th><th>Lỗi</th></tr></thead>
        <tbody>{attempts.map((attempt, index) => <tr key={String(attempt.id ?? index)}>
          {[attempt.attempt_no, attempt.model_name, attempt.http_status, attempt.latency_ms, attempt.error_category].map((value, cell) =>
            <td key={cell}>{String(value ?? '—')}</td>)}
        </tr>)}</tbody>
      </PaginatedTable></div> : <p className="subtle">Chưa có lần gọi nhà cung cấp.</p>}
      <h3>Kết quả kiểm tra ({validations.length})</h3>
      {validations.length > 0 ? <div className="table-scroll"><PaginatedTable>
        <thead><tr><th>Luật</th><th>Kết quả</th><th>Thông báo</th><th>Thời gian</th></tr></thead>
        <tbody>{validations.map((validation, index) => <tr key={String(validation.id ?? index)}>
          <td>{String(validation.rule_code ?? '—')}</td><td>{String(validation.result_status ?? validation.status ?? '—')}</td>
          <td>{String(validation.message ?? '—')}</td><td>{dateTime(validation.checked_at as string)}</td>
        </tr>)}</tbody>
      </PaginatedTable></div> : <p className="subtle">Chưa có kết quả kiểm tra.</p>}
      <details><summary>Dữ liệu và nhật ký đã lưu</summary><ApiResult value={row}/></details>
    </QueryState>
  </Drawer>;
}

