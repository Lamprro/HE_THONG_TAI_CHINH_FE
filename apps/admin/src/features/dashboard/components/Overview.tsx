import { Database, Server, ShieldAlert } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { DataSource, IngestionJob, IngestionRun, JavaHealth, ValidationResult } from '../types/dto';
import { Badge, Panel } from '../../../shared/components/Ui';
import { dateTime } from '../../../shared/utils/format';
import { RunsPanel } from '../../ingestion/components/Runs';
import { IssuesPreview } from '../../data-quality/components/QualityPage';

type HealthObservation = { data: JavaHealth; latencyMs: number; checkedAt: string };
function value<T>(query: UseQueryResult<T[]>, calculate: (rows: T[]) => number | string): number | string {
  if (query.data) return calculate(query.data);
  if (query.isError) return 'Lỗi';
  return '—';
}
function Metric({ label, value: numberOrText, scope, icon }: { label: string; value: number | string; scope: string; icon: React.ReactNode }) {
  return <div className="metric"><div className="metric-icon">{icon}</div><strong className={numberOrText === 'Lỗi' ? 'metric-error' : ''}>{numberOrText}</strong><span>{label}</span><small>{scope}</small></div>;
}
const statuses = ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'RUNNING', 'PENDING', 'CANCELLED'] as const;
export function StatusChart({ runs }: { runs: UseQueryResult<IngestionRun[]> }) {
  const counts = statuses.map(status => ({ status, count: runs.data?.filter(run => run.status === status).length ?? 0 }));
  const total = runs.data?.length ?? 0;
  return <Panel eyebrow="HOẠT ĐỘNG GẦN ĐÂY" title="Phân bố trạng thái lượt chạy" note="Chỉ tính 20 lượt chạy mới nhất" action={<Badge tone="neutral">{runs.data ? `${total} lượt` : '—'}</Badge>}>
    {runs.isPending ? <div className="skeleton-stack"><div/><div/><div/></div> : runs.isError && !runs.data ? <div className="state-error" role="alert">Không tải được lượt chạy. <button className="light-button" onClick={() => runs.refetch()}>Thử lại</button></div> : total === 0 ? <div className="state-empty">Chưa có lượt chạy nào.</div> : <><div className="stack-bar" aria-label="Phân bố trạng thái">{counts.filter(item => item.count > 0).map(item => <span key={item.status} className={`bar-${item.status.toLowerCase()}`} style={{ width: `${item.count / total * 100}%` }} title={`${item.status}: ${item.count}`}/>)}</div><div className="chart-legend">{counts.map(item => <div key={item.status}><i className={`dot-${item.status.toLowerCase()}`}/><span>{item.status.replace('_', ' ')}</span><b>{item.count}</b></div>)}</div></>}
  </Panel>;
}

// Whole-database counts live in SystemSummary; this block only adds what the summary does not cover.
export function Overview({ health, jobs, sources, runs, issues, onRun, onIssue, onRuns, onQuality }: { health: UseQueryResult<HealthObservation>; jobs: UseQueryResult<IngestionJob[]>; sources: UseQueryResult<DataSource[]>; runs: UseQueryResult<IngestionRun[]>; issues: UseQueryResult<ValidationResult[]>; onRun: (id: string) => void; onIssue: (issue: ValidationResult) => void; onRuns: () => void; onQuality: () => void }) {
  const status = health.isPending ? 'Đang kiểm tra' : health.isError || health.data?.data.status !== 'UP' ? 'Mất kết nối' : 'Hoạt động';
  const metrics = [
    { label: 'Nguồn dữ liệu đang bật', value: value(sources, rows => rows.filter(source => source.active).length), scope: 'Cờ cấu hình, không phải kiểm tra sức khỏe nhà cung cấp', icon: <Database size={18}/> },
    { label: 'Lượt lỗi gần đây', value: value(runs, rows => rows.filter(run => run.status === 'FAILED').length), scope: 'Trong 20 lượt chạy mới nhất', icon: <ShieldAlert size={18}/> },
    { label: 'Lỗi validation đang mở', value: value(issues, rows => rows.length >= 50 ? '50+' : rows.length), scope: 'API trả tối đa 50 lỗi mới nhất', icon: <ShieldAlert size={18}/> },
  ];
  return <>
    <div className="health-summary"><div className="health-summary-main"><span className="health-icon"><Server size={20}/></span><div><strong>Java Backend</strong><small>{health.data?.data.service || 'financial-data-api'}</small></div><Badge tone={status === 'Hoạt động' ? 'green' : status === 'Mất kết nối' ? 'red' : 'neutral'}>{status}</Badge></div><div className="health-summary-meta"><span>Độ trễ đo từ trình duyệt <b>{health.data ? `${health.data.latencyMs} ms` : '—'}</b></span><span>Kiểm tra thành công gần nhất <b>{dateTime(health.data?.checkedAt)}</b></span>{health.isError && <span className="health-error">{health.error.message} <button onClick={() => health.refetch()}>Thử lại</button></span>}</div></div>
    <div className="metrics-grid three">{metrics.map(metric => <Metric key={metric.label} {...metric}/>)}</div>
    <div className="overview-grid"><StatusChart runs={runs}/><IssuesPreview issues={issues} onSelect={onIssue} onViewAll={onQuality}/></div>
    <RunsPanel compact runs={runs} jobs={jobs.data} sources={sources.data} onSelect={onRun} onViewAll={onRuns}/>
  </>;
}
