import { useRef, useState } from 'react';
import type { DataSource, IngestionJob } from '../dashboard/types/dto';
import { Drawer } from '../../shared/components/Ui';
import { mutationBlock } from '../../shared/api/access';
import { ApiError } from '../../shared/api/client';
import { ApiResult, type Row } from '../admin/Records';
import { submitCommand, useCommand } from '../admin/CommandTracker';
import { safeObject } from '../../shared/utils/format';
import { adminApi, useAdminMutation } from './api';
import { datasetTypes, sourceTypes, licenseStatuses, operations, type CreateIngestionJobRequest, type DataSourceRequest } from './contracts';
import { buildRequest, type FormValues } from './forms';

export type Operation = { kind: 'create-job' | 'manual-ingestion' | 'validate-pending' } | { kind: 'upsert-source'; source?: DataSource } | { kind: 'edit-job' | 'run-job' | 'activation'; job: IngestionJob } | { kind: 'validate-raw'; rawId: string };
const titles: Record<Operation['kind'], string> = { 'edit-job': 'Sửa job lấy dữ liệu', 'create-job': 'Tạo job lấy dữ liệu', 'manual-ingestion': 'Lấy dữ liệu thủ công', 'upsert-source': 'Lưu nguồn dữ liệu', 'run-job': 'Chạy job ngay', activation: 'Bật/tắt job', 'validate-raw': 'Chạy validation', 'validate-pending': 'Validate dữ liệu chờ' };
const commandActions = { 'run-job': 'RUN_JOB', 'manual-ingestion': 'MANUAL_INGESTION', 'validate-raw': 'VALIDATE_RAW', 'validate-pending': 'VALIDATE_PENDING' } as const;
interface Field { key: string; label: string; options?: readonly string[]; type?: string; required?: boolean; readOnly?: boolean; hint?: string }

export function OperationDrawer({ operation, sources = [], onClose, onRun }: { operation: Operation; sources?: DataSource[]; onClose: () => void; onRun: (id: string) => void }) {
  const job = operation.kind === 'edit-job' ? operation.job : undefined;
  const source = operation.kind === 'upsert-source' ? operation.source : undefined;
  const [values, setValues] = useState<FormValues>(() => ({ code: job?.code || source?.code || '', name: job?.name || source?.name || '', sourceType: source?.sourceType || 'API', baseUrl: source?.baseUrl || '', provider: source?.provider || '', official: String(source?.official ?? false), licenseStatus: source?.licenseStatus || 'UNKNOWN', active: String(job?.active ?? source?.active ?? true), dataSourceCode: job?.dataSourceCode || '', datasetType: job?.datasetType || '', cronExpression: job?.cronExpression || '', parameters: job ? JSON.stringify(job.parameters, null, 2) : '{}', maxRetries: '10', timeoutSeconds: job ? String(job.timeoutSeconds) : '', operation: '', symbol: '', startDate: '', endDate: '', interval: '', limit: '50' }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState(false);
  const [body, setBody] = useState<unknown>();
  const [result, setResult] = useState<unknown>();
  const submitting = useRef(false);
  const idempotency = useRef(crypto.randomUUID());
  const [reason, setReason] = useState('');
  // Long-running actions go through the durable command queue; only configuration writes call Java directly.
  const queuedAction = operation.kind in commandActions;
  const mutation = useAdminMutation(async (input: unknown): Promise<unknown> => {
    if (queuedAction) {
      const payload = operation.kind === 'run-job' ? { jobId: operation.job.id } : operation.kind === 'validate-raw' ? { rawPayloadId: operation.rawId } : input;
      return submitCommand(commandActions[operation.kind as keyof typeof commandActions], payload, reason, idempotency.current);
    }
    switch (operation.kind) {
      case 'create-job': return adminApi.createJob(input as CreateIngestionJobRequest);
      case 'edit-job': return adminApi.updateJob(operation.job.id, input as CreateIngestionJobRequest);
      case 'upsert-source': return adminApi.upsertSource(input as DataSourceRequest);
      case 'activation': return adminApi.activation({ jobId: operation.job.id, active: !operation.job.active });
    }
  });
  const deactivating = operation.kind === 'activation' && operation.job.active;
  const blocked = mutationBlock(operation.kind, deactivating);
  const title = source ? 'Sửa nguồn dữ liệu' : operation.kind === 'upsert-source' ? 'Thêm nguồn dữ liệu' : titles[operation.kind];
  const fields: Field[] = operation.kind === 'create-job' || operation.kind === 'edit-job' ? [
    { key: 'dataSourceCode', label: 'Nguồn dữ liệu', options: sources.map(s => s.code), required: true },
    { key: 'code', label: 'Mã job', required: true, readOnly: !!job }, { key: 'name', label: 'Tên job', required: true },
    { key: 'datasetType', label: 'Loại dữ liệu', options: datasetTypes, required: true },
    { key: 'cronExpression', label: 'Biểu thức cron', hint: 'Cron Spring 6 trường: giây phút giờ ngày tháng thứ, tính theo UTC. Java kiểm tra đầy đủ cú pháp.' },
    { key: 'parameters', label: 'Tham số (JSON object)', type: 'json', required: true },
    { key: 'maxRetries', label: 'Retry tối đa', type: 'number', readOnly: true, hint: 'Cố định 10 theo chính sách retry của Java.' },
    { key: 'timeoutSeconds', label: 'Timeout (giây)', type: 'number', hint: 'Để trống để dùng mặc định 120 giây của server.' },
    { key: 'active', label: 'Đang bật', options: ['true', 'false'], hint: 'Job tắt vẫn hiển thị và có thể bật lại.' },
  ] : operation.kind === 'upsert-source' ? [
    { key: 'code', label: 'Mã nguồn', required: true, readOnly: !!source }, { key: 'name', label: 'Tên nguồn', required: true },
    { key: 'sourceType', label: 'Loại nguồn', options: sourceTypes, required: true }, { key: 'baseUrl', label: 'Base URL', type: 'url' },
    { key: 'provider', label: 'Nhà cung cấp', hint: 'Dùng provider đã cấu hình trên Java. Không nhập thông tin đăng nhập.' },
    { key: 'official', label: 'Nguồn chính thức', options: ['true', 'false'] }, { key: 'licenseStatus', label: 'Giấy phép', options: licenseStatuses }, { key: 'active', label: 'Đang bật', options: ['true', 'false'] },
  ] : operation.kind === 'manual-ingestion' ? [
    { key: 'operation', label: 'Thao tác nguồn', options: operations, required: true },
    { key: 'dataSourceCode', label: 'Nguồn dữ liệu', options: sources.filter(s => s.active && s.sourceType === 'API').map(s => s.code), required: true, hint: 'Chỉ nguồn API đang bật. Provider lấy theo nguồn đã chọn.' },
    { key: 'symbol', label: 'Mã chứng khoán' }, { key: 'startDate', label: 'Từ ngày', type: 'date' }, { key: 'endDate', label: 'Đến ngày', type: 'date' },
    { key: 'interval', label: 'Chu kỳ (interval)' }, { key: 'parameters', label: 'Tham số bổ sung (JSON object, giá trị chuỗi)', type: 'json', hint: 'Báo cáo tài chính cần "statement"; raw proxy cần "upstream_path"; lấy URL cần "url".' },
  ] : operation.kind === 'validate-pending' ? [{ key: 'limit', label: 'Số payload tối đa', type: 'number', required: true, hint: 'Từ 1 đến 100. Một lô có thể thay đổi nhiều bản ghi.' }] : [];
  const prepare = () => {
    const nextErrors: Record<string, string> = {};
    let nextBody: unknown;
    if (operation.kind === 'create-job' || operation.kind === 'edit-job' || operation.kind === 'manual-ingestion' || operation.kind === 'upsert-source') {
      const checked = buildRequest(operation.kind === 'edit-job' ? 'create-job' : operation.kind, values, sources, source);
      Object.assign(nextErrors, checked.errors); nextBody = checked.body;
    } else if (operation.kind === 'validate-pending') {
      const limit = Number(values.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) nextErrors.limit = 'Nhập số nguyên từ 1 đến 100.';
      nextBody = { limit };
    } else if (operation.kind === 'activation') nextBody = { jobId: operation.job.id, active: !operation.job.active };
    else if (operation.kind === 'run-job') nextBody = { jobId: operation.job.id, jobCode: operation.job.code, jobName: operation.job.name, dataSourceCode: operation.job.dataSourceCode };
    else if (operation.kind === 'validate-raw') nextBody = { rawPayloadId: operation.rawId };
    if (queuedAction && !reason.trim()) nextErrors.reason = 'Ghi rõ lý do vận hành.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setBody(nextBody);
    idempotency.current = crypto.randomUUID();
    setReview(true);
  };
  const execute = async () => {
    if (blocked || submitting.current || mutation.isPending) return;
    submitting.current = true;
    try { setResult(await mutation.mutateAsync(body)); } catch { /* The form stays open and the mutation error is shown. */ }
    finally { submitting.current = false; }
  };
  const response = result && typeof result === 'object' ? result as Row : undefined;
  const commandId = queuedAction && typeof response?.id === 'string' ? response.id : undefined;
  const tracked = useCommand(commandId);
  const commandResult = tracked.data?.result_json as Row | undefined;
  const runId = response?.runId || response?.ingestionRunId || commandResult?.runId;
  const impact = operation.kind === 'run-job' || operation.kind === 'manual-ingestion' ? 'Thao tác có thể gọi dịch vụ bên ngoài, tốn tài nguyên và ghi dữ liệu. Mỗi lần xác nhận tạo một lượt chạy mới.'
    : operation.kind === 'validate-pending' ? `Lô này có thể xử lý tới ${values.limit} payload và cập nhật kết quả validation cùng version dữ liệu.`
    : operation.kind === 'activation' ? (deactivating ? 'Tắt job sẽ ngừng các lần chạy theo lịch. Job vẫn hiển thị và có thể bật lại.' : 'Bật job cho phép job được lên lịch và đặt lại ngân sách retry.')
    : operation.kind === 'upsert-source' && source && source.active !== (values.active === 'true') ? 'Trạng thái bật của nguồn sẽ thay đổi và có thể ảnh hưởng việc lấy dữ liệu.'
    : 'Yêu cầu này ghi cấu hình hoặc dữ liệu validation.';
  const change = (key: string, value: string) => setValues({ ...values, [key]: value });
  return <Drawer title={title} onClose={() => { if (!submitting.current) onClose(); }}>
    {result !== undefined ? <div role="status"><h3>Backend đã nhận yêu cầu</h3>{operation.kind === 'upsert-source' && <p>Đã lưu cấu hình nguồn (endpoint dùng cơ chế upsert).</p>}<pre>{safeObject(result)}</pre>{commandId && <><p>Tác vụ chạy trên server; có thể đóng cửa sổ và theo dõi tại “Tác vụ &amp; lịch sử” → “Tác vụ nền”.</p>{tracked.error && <p role="alert" className="state-error">{tracked.error.message}</p>}<ApiResult value={tracked.data}/></>}{typeof response?.duplicateChecksum === 'boolean' && <p>Java báo checksum trùng: {response.duplicateChecksum ? 'Có' : 'Không'}</p>}{typeof runId === 'string' && <button className="primary-button" onClick={() => { onClose(); onRun(runId); }}>Xem lượt chạy</button>}<button className="light-button" onClick={onClose}>Xong</button></div> : <>
      {blocked && <p className="operation-lock" role="status">{blocked}</p>}
      {!review ? <form className="admin-form" noValidate onSubmit={e => { e.preventDefault(); prepare(); }}>
        {fields.map(field => <div className="form-field" key={field.key}><label htmlFor={`op-${field.key}`}>{field.label}{field.required && ' *'}</label>
          {field.options ? <select id={`op-${field.key}`} value={values[field.key]} aria-invalid={!!errors[field.key]} aria-describedby={`hint-${field.key}`} onChange={e => change(field.key, e.target.value)}><option value="" disabled>Chọn…</option>{field.options.map(option => <option key={option}>{option}</option>)}</select> : field.type === 'json' ? <textarea id={`op-${field.key}`} rows={7} spellCheck={false} value={values[field.key]} aria-invalid={!!errors[field.key]} aria-describedby={`hint-${field.key}`} onChange={e => change(field.key, e.target.value)}/> : <input id={`op-${field.key}`} type={field.type || 'text'} readOnly={field.readOnly} value={values[field.key]} aria-invalid={!!errors[field.key]} aria-describedby={`hint-${field.key}`} onChange={e => change(field.key, e.target.value)}/>}
          <small id={`hint-${field.key}`} className={errors[field.key] ? 'field-error' : 'subtle'}>{errors[field.key] || field.hint}</small>
        </div>)}
        {queuedAction && <div className="form-field"><label htmlFor="op-reason">Lý do vận hành *</label><textarea id="op-reason" value={reason} maxLength={2000} aria-invalid={!!errors.reason} aria-describedby="hint-reason" onChange={e => setReason(e.target.value)}/><small id="hint-reason" className={errors.reason ? 'field-error' : 'subtle'}>{errors.reason || 'Được lưu vào sổ điều hành tác vụ.'}</small></div>}
        <div className="operation-actions"><button type="button" className="light-button" onClick={onClose}>Hủy</button><button className="primary-button" type="submit">Xem lại yêu cầu</button></div>
      </form> : <div className="confirmation"><h3>Xác nhận: {title}</h3>
        {'job' in operation && <p><strong>{operation.job.name}</strong> · {operation.job.code} · {operation.job.dataSourceCode}</p>}
        <p>{impact}</p>
        <pre>{safeObject(body)}</pre>
        {mutation.isError && <div className="field-error" role="alert"><p>{mutation.error.message}</p>{mutation.error instanceof ApiError && mutation.error.upstreamStatus != null && <p>HTTP status từ nguồn: {mutation.error.upstreamStatus}</p>}{mutation.error instanceof ApiError && mutation.error.runId && <button className="light-button" onClick={() => { onClose(); onRun((mutation.error as ApiError).runId!); }}>Xem lượt chạy lỗi</button>}</div>}
        <div className="operation-actions"><button className="light-button" disabled={mutation.isPending} onClick={() => { setReview(false); mutation.reset(); }}>Quay lại</button><button className="primary-button" disabled={!!blocked || mutation.isPending} onClick={execute}>{mutation.isPending ? 'Đang thực hiện…' : 'Xác nhận và thực hiện'}</button></div>
      </div>}
    </>}
  </Drawer>;
}
