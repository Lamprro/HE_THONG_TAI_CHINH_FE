import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE, getJson } from '../../shared/api/client';
import type { AdminRuntime } from '../../shared/api/admin-contract';
import { Badge, Panel, QueryState } from '../../shared/components/Ui';
import { ApiResult } from './Records';

const schedulerLabels: Record<string, string> = {
  ingestion: 'Lấy dữ liệu theo lịch',
  macro: 'Cập nhật dữ liệu vĩ mô',
  validation: 'Kiểm tra dữ liệu chờ',
  'security-job-reconciliation': 'Đồng bộ job theo mã',
  llm: 'Phân tích tin bằng AI',
  'news-recovery': 'Khôi phục nội dung tin',
};

function RuntimeIntegration({ title, endpoint }: { title: string; endpoint: string }) {
  const query = useQuery({
    queryKey: ['runtime-card', endpoint],
    queryFn: () => getJson(API_BASE, '/api/external-financial-data/' + endpoint),
    staleTime: 30000,
  });
  return <section><h3>{title}</h3><QueryState query={query}><ApiResult value={query.data}/></QueryState></section>;
}

export function RuntimePage({ javaLoading, javaUp }: { javaLoading: boolean; javaUp: boolean }) {
  const [details, setDetails] = useState(false);
  const runtime = useQuery({
    queryKey: ['admin-runtime'], queryFn: () => getJson<AdminRuntime>(API_BASE, '/api/admin/console/runtime'),
    refetchInterval: 30000,
  });
  const python = useQuery({
    queryKey: ['runtime-card', 'health'],
    queryFn: () => getJson<{ status?: string }>(API_BASE, '/api/external-financial-data/health'),
    staleTime: 30000,
  });
  const status = runtime.data;
  const pythonStatus = python.isError ? 'Không kết nối được'
    : python.isPending ? 'Đang kiểm tra' : python.data?.status === 'ok' ? 'Đã kết nối' : 'Chưa xác định';
  const schedulers = Object.entries(status?.schedulers ?? {});
  const enabled = schedulers.filter(([, scheduler]) => scheduler.enabled).length;

  return <div className="admin-stack">
    <Panel title="Kết nối dịch vụ" className="runtime-panel">
      <dl className="runtime-grid">
        <div><dt>Java</dt><dd><Badge tone={javaLoading ? 'neutral' : javaUp ? 'green' : 'red'}>
          {javaLoading ? 'Đang kiểm tra' : javaUp ? 'Đã kết nối' : 'Không kết nối được'}</Badge></dd></div>
        <div><dt>PostgreSQL</dt><dd><Badge tone={status?.database === 'UP' ? 'green' : status?.database === 'DOWN' ? 'red' : 'neutral'}>
          {status?.database === 'UP' ? 'Đã kết nối' : status?.database === 'DOWN' ? 'Không kết nối được' : runtime.isPending ? 'Đang kiểm tra' : 'Chưa xác định'}</Badge></dd></div>
        <div><dt>Python</dt><dd><Badge tone={python.isError ? 'red' : python.data?.status === 'ok' ? 'green' : 'neutral'}>{pythonStatus}</Badge></dd></div>
      </dl>
      {python.isError && <p className="runtime-error" role="alert">{python.error.message} <button className="text-button" onClick={() => python.refetch()}>Thử lại Python</button></p>}
      <details className="runtime-details" onToggle={event => setDetails(event.currentTarget.open)}>
        <summary>Nhà cung cấp và dữ liệu Python hỗ trợ</summary>
        {details && <div className="runtime-integrations">
          <RuntimeIntegration title="Nhà cung cấp" endpoint="providers"/>
          <RuntimeIntegration title="Dữ liệu hỗ trợ" endpoint="capabilities"/>
        </div>}
      </details>
    </Panel>
    <Panel title="Lịch tự động" className="runtime-panel"
      action={status && <Badge>{status.timezone.replace('Asia/Ho_Chi_Minh', 'Giờ Việt Nam')}</Badge>}>
      <QueryState query={runtime}>{status && <>
        <div className="runtime-schedule-header">
          <span>Xử lý lệnh quản trị</span>
          <Badge tone={status.adminWorkers.commandsEnabled ? 'green' : 'neutral'}>{status.adminWorkers.commandsEnabled ? 'Bật' : 'Tắt'}</Badge>
        </div>
        {schedulers.length > 0 ? <>
          <h3>Lịch nền · {enabled}/{schedulers.length} bật</h3>
          <dl className="runtime-grid runtime-schedulers">{schedulers.map(([name, scheduler]) => <div key={name}>
            <dt>{schedulerLabels[name] ?? name}</dt>
            <dd><Badge tone={scheduler.enabled ? 'green' : 'neutral'}>{scheduler.enabled ? 'Bật' : 'Tắt'}</Badge></dd>
          </div>)}</dl>
        </> : <p className="subtle">Chưa có cấu hình lịch nền.</p>}
      </>}</QueryState>
    </Panel>
  </div>;
}
