import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiResult } from '../../admin/Records';
import { API_BASE, getJson } from '../../../shared/api/client';
import { Drawer, QueryState } from '../../../shared/components/Ui';
import { dateTime, safeText, safeUrl } from '../../../shared/utils/format';
import type { RawPayload, ValidationResult } from '../../dashboard/types/dto';
import { LINKED_LIMIT, useLinkedValidation, useLinkedVersions } from '../../dashboard/api/queries';
import type { DataSelection } from '../../admin/dataViews';
import type { Operation } from '../../operations/OperationDrawer';

export function RawPayloadDrawer({ id, onClose, onRun, onIssue, onOperation, onQuality, onVersions, onOutput }: { id: string | null; onClose: () => void; onRun: (id: string) => void; onIssue: (value: ValidationResult) => void; onOperation: (operation: Operation) => void; onQuality: (rawId: string, runId: string) => void; onVersions: (runId: string) => void; onOutput: (selection: DataSelection) => void }) {
  const [showBody, setBody] = useState(false);
  const payload = useQuery({ queryKey: ['payload', id], queryFn: () => getJson<RawPayload>(API_BASE, `/api/raw-payloads/${encodeURIComponent(id!)}?includeBody=false`), enabled: !!id });
  const body = useQuery({ queryKey: ['payload-body', id], queryFn: () => getJson<RawPayload>(API_BASE, `/api/raw-payloads/${encodeURIComponent(id!)}?includeBody=true`), enabled: !!id && showBody });
  const validation = useLinkedValidation(null, id);
  const versions = useLinkedVersions(payload.data?.ingestionRunId);
  if (!id) return null;
  const data = payload.data;
  return <Drawer title="Raw payload" subtitle={id} onClose={onClose}><QueryState query={payload}>{data && <>
    <div className="detail-grid"><div><span>Raw payload ID</span><b className="break">{data.id}</b></div><div><span>Lượt chạy ID</span><b className="break">{data.ingestionRunId}</b></div><div><span>Nguồn dữ liệu ID</span><b>{data.dataSourceId}</b></div><div><span>External key</span><b>{safeText(data.externalKey)}</b></div><div><span>Loại thực thể</span><b>{data.entityType || '—'}</b></div><div><span>Mã nguồn</span><b>{data.sourceSymbol || '—'}</b></div><div><span>Lấy lúc</span><b>{dateTime(data.fetchedAt)}</b></div><div><span>Tạo lúc</span><b>{dateTime(data.createdAt)}</b></div></div>
    <div className="detail-section"><p>Source URL: {safeUrl(data.sourceUrl)}</p><p>Content type: {data.contentType || '—'}</p><p className="break">SHA-256: {data.checksumSha256 || '—'}</p><button className="light-button" onClick={() => setBody(v => !v)}>{showBody ? 'Ẩn dữ liệu nguồn' : 'Đọc dữ liệu nguồn'}</button>{showBody && <QueryState query={body}>{body.data?.body == null ? <p>Không có nội dung nguồn.</p> : <ApiResult value={body.data.body}/>}</QueryState>}</div>
    <div className="operation-actions">{data.entityType === 'NEWS_DATA' &&
      <button className="light-button" onClick={() => onOutput({ table: 'news_articles', exact: { raw_payload_id: data.id } })}>Xem tin đã ghi</button>}
      <button className="light-button" onClick={() => onRun(data.ingestionRunId)}>Xem lượt chạy</button><button className="light-button" onClick={() => onQuality(data.id, data.ingestionRunId)}>Xem validation của payload</button><button className="light-button" onClick={() => onVersions(data.ingestionRunId)}>Xem version của lượt chạy</button><button className="primary-button" onClick={() => onOperation({ kind: 'validate-raw', rawId: data.id })}>Chạy validation</button></div>
    <div className="detail-section"><h3>Validation đúng payload này · tối đa {LINKED_LIMIT}</h3><QueryState query={validation} empty="Payload chưa có kết quả validation.">{validation.data?.map(result => <button className="mini-record mini-action" key={result.id} onClick={() => onIssue(result)}><b>{result.ruleCode} · {result.status}</b><span>{result.severity} · {result.handlingStatus} · {dateTime(result.checkedAt)}</span><span>{safeText(result.message)}</span></button>)}</QueryState></div>
    <div className="detail-section"><h3>Version tạo từ lượt chạy</h3><QueryState query={versions} empty="Lượt chạy chưa tạo version dữ liệu.">{versions.data?.map(version => <div className="mini-record" key={version.id}><b>{version.versionCode || version.id} · {version.status || '—'}</b><span>Tạo {dateTime(version.createdAt)} · Kích hoạt {dateTime(version.activatedAt)}</span></div>)}</QueryState></div>
  </>}</QueryState></Drawer>;
}
