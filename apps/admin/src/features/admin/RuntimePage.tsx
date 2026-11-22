import { useQuery } from '@tanstack/react-query';
import { API_BASE, getJson } from '../../shared/api/client';
import type { AdminRuntime } from '../../shared/api/admin-contract';
import { Panel, QueryState } from '../../shared/components/Ui';
import { ApiResult } from './Records';
import { CoverageRemediationPanel } from './CoverageRemediationPanel';
import type { WorkflowSelection } from './WorkflowPage';

const cards = [
  ['python-health', 'Python · trạng thái thực qua adapter Java', '/api/external-financial-data/health'],
  ['providers', 'Nhà cung cấp · đăng ký và giới hạn', '/api/external-financial-data/providers'],
  ['capabilities', 'Python · hợp đồng dữ liệu đang triển khai', '/api/external-financial-data/capabilities'],
];
function RuntimeCard({ id, title, path }: { id: string; title: string; path: string }) {
  const query = useQuery({ queryKey: ['runtime-card', id], queryFn: () => getJson(API_BASE, path), staleTime: 30000 });
  return <Panel title={title} action={<button className="text-button" onClick={() => query.refetch()}>Kiểm tra lại</button>}><QueryState query={query}><ApiResult value={query.data}/></QueryState></Panel>;
}
function RuntimeStatusPanel() {
  const query = useQuery({ queryKey: ['admin-runtime'],
    queryFn: () => getJson<AdminRuntime>(API_BASE, '/api/admin/console/runtime'), refetchInterval: 30000 });
  const status = query.data;
  return <Panel title="Backend và lịch chạy" action={<button className="text-button" onClick={() => query.refetch()}>Kiểm tra lại</button>}>
    <QueryState query={query}>{status && <dl>
      <dt>PostgreSQL</dt><dd>{status.database}</dd>
      <dt>Múi giờ</dt><dd>{status.timezone}</dd>
      <dt>Worker lệnh</dt><dd>{status.adminWorkers.commandsEnabled ? 'Bật' : 'Tắt'}</dd>
      {Object.entries(status.schedulers).map(([name, scheduler]) => <div key={name}>
        <dt>{name}</dt><dd>{scheduler.enabled ? 'Đã bật cấu hình' : 'Tắt'}</dd>
      </div>)}
    </dl>}</QueryState>
  </Panel>;
}

export function RuntimePage({ onWorkflow }: { onWorkflow?: (selection: WorkflowSelection) => void }) {
  return <div className="admin-stack">
    <p>Java UP không chứng minh Python, nhà cung cấp hoặc scheduler đang hoạt động. Lịch lấy từ cron và trạng thái bật của từng job. Xem lượt chạy trong mục Tác vụ & lịch sử.</p>
    <CoverageRemediationPanel onWorkflow={onWorkflow} />
    <RuntimeStatusPanel />
    <Panel title="Tài liệu API quản trị">
      <a href={API_BASE + '/admin-api-docs/index.html'} target="_blank" rel="noreferrer">Mở Swagger UI</a>
    </Panel>
    {cards.map(([id, title, path]) => <RuntimeCard key={id} id={id} title={title} path={path}/>)}
  </div>;
}
