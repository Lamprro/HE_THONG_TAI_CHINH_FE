import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DataScopePage } from '../features/data-scope/DataScopePage';
import { useScopeQueries } from '../features/data-scope/api';
import { RawPayloadDrawer } from '../features/ingestion/components/RawPayloadDrawer';
import { AdminLayout, sections, type Section } from '../layouts/AdminLayout';
import { useDashboardQueries, type DashboardSection } from '../features/dashboard/api/queries';
import type { ValidationResult } from '../features/dashboard/types/dto';
import { Overview } from '../features/dashboard/components/Overview';
import { JobsPage } from '../features/ingestion/components/JobsPage';
import { JobRunHistory, RunDrawer } from '../features/ingestion/components/Runs';
import { DataQualityPage, ValidationDrawer } from '../features/data-quality/components/QualityPage';
import { SourcesPage } from '../features/data-sources/components/SourcesPage';
import { dateTime } from '../shared/utils/format';
import { OperationDrawer, type Operation } from '../features/operations/OperationDrawer';
import { SessionGate } from '../shared/api/SessionGate';
import { DataBrowser } from '../features/admin/DataBrowser';
import { CatalogMaintenancePanel } from '../features/admin/CatalogMaintenancePanel';
import { CoverageRemediationPanel } from '../features/admin/CoverageRemediationPanel';
import { RuntimePage } from '../features/admin/RuntimePage';
import { FinancialQualityPage } from '../features/data-quality/components/FinancialQualityPage';
import { MarketDataAdminPage } from '../features/admin/MarketDataAdminPage';
import { WorkflowPage, type WorkflowSelection } from '../features/admin/WorkflowPage';
import { AiOperationsPage } from '../features/admin/AiOperationsPage';
import { OperationsHistory } from '../features/admin/OperationsHistory';
import { ActiveCommandsBanner } from '../features/admin/ActiveCommandsBanner';
import { LineageTracerPage } from '../features/admin/LineageTracerPage';
import { CommandTracker } from '../features/admin/CommandTracker';
import type { DataSelection } from '../features/admin/dataViews';
import { SystemSummary } from '../features/admin/SystemSummary';

const descriptions: Record<Section, string> = {
  overview: 'Sức khỏe hệ thống, số liệu toàn database, lượt chạy và lỗi validation gần nhất.',
  workflow: 'Lấy nguồn qua Python → validation → build đúng version vào bảng cuối, hoặc tiếp tục từ nguồn đã lưu.',
  history: 'Tác vụ nền, lượt chạy nguồn, validation và phiên bản; theo dõi hoặc xử lý tiếp từ bằng chứng đã lưu.',
  jobs: 'Định nghĩa job, lịch cron, chạy một lần và cấu hình nguồn dữ liệu.',
  scope: 'Công ty, mã chứng khoán, alias và việc cấp job theo mã.',
  quality: 'Kết quả validation, luật và phiên bản dữ liệu.',
  ai: 'Dự báo, phân tích tin, khôi phục và prompt — mọi lần chạy đều có audit.',
  data: 'Tra cứu toàn bộ bảng có phân trang, lọc chính xác theo nguồn gốc.',
  system: 'Java, database, Python, scheduler, độ phủ dữ liệu và danh mục API quản trị.',
};
type HistoryKind = 'commands' | 'runs' | 'quality';
const historyTabs: [HistoryKind, string][] = [['runs', 'Lịch sử job'], ['quality', 'Kiểm tra & ghi dữ liệu'], ['commands', 'Tác vụ nền']];

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: [T, string][] }) {
  return <div className="toolbar section-tabs">{items.map(([id, title]) => <button key={id} aria-pressed={value === id} className={value === id ? 'primary-button' : 'light-button'} onClick={() => onChange(id)}>{title}</button>)}</div>;
}

export function App() {
  return <SessionGate><Dashboard/></SessionGate>;
}
function Dashboard() {
  const [section, setSection] = useState<Section>('overview');
  const [workflow, setWorkflow] = useState<WorkflowSelection>({});
  const [historyKind, setHistoryKind] = useState<HistoryKind>('runs');
  const [historyJob, setHistoryJob] = useState<string | undefined>();
  const [dataSelection, setDataSelection] = useState<DataSelection>();
  const [dataOrigin, setDataOrigin] = useState<{ section: Section; runId: string | null; rawId: string | null }>();
  const [jobsTab, setJobsTab] = useState<'jobs' | 'sources'>('jobs');
  const [qualityTab, setQualityTab] = useState<'validation' | 'financial' | 'lineage'>('validation');
  const [systemTab, setSystemTab] = useState<'status' | 'coverage' | 'market' | 'api'>('status');
  const [dark, setDark] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [issue, setIssue] = useState<ValidationResult | null>(null);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [jobLink, setJobLink] = useState<string | null>(null);
  const [sourceLink, setSourceLink] = useState<number | null>(null);
  const [rawId, setRawId] = useState<string | null>(null);
  const [qualityView, setQualityView] = useState<'validation' | 'versions'>('validation');
  const [qualityRaw, setQualityRaw] = useState<string | null>(null);
  const [qualityRun, setQualityRun] = useState<string | null>(null);
  const [trackedCommand, setTrackedCommand] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const view: DashboardSection = section === 'overview' || section === 'jobs' || section === 'quality' ? section
    : section === 'history' && historyKind === 'runs' ? 'runs' : 'other';
  const scopeQueries = useScopeQueries(section === 'scope');
  const q = useDashboardQueries(view);
  const { javaHealth: health, jobs, sources, runs, openIssues: issues, results, versions } = q;
  const activeQueries = section === 'scope' ? [health, scopeQueries.companies, scopeQueries.securities]
    : view === 'overview' ? [health, jobs, sources, runs, issues]
    : view === 'jobs' ? [health, jobs, sources, runs]
    : view === 'runs' ? [health, runs, jobs, sources]
    : view === 'quality' ? [health, issues, results, versions, q.rules]
    : [health];
  const refreshing = activeQueries.some(query => query.isFetching);
  const latest = (() => {
    const timestamp = activeQueries.map(query => query.dataUpdatedAt).filter(Boolean).sort((a, b) => b - a)[0];
    return timestamp ? new Date(timestamp).toISOString() : undefined;
  })();
  const connection = health.isPending ? 'Đang kiểm tra' : health.isError || health.data?.data.status !== 'UP' ? 'Mất kết nối' : 'Đã kết nối';
  const current = sections.find(item => item.id === section)!;
  const openJobs = (id?: string) => { setJobLink(id ?? null); setJobsTab('jobs'); setSection('jobs'); };
  const openSources = (id?: number) => { setSourceLink(id ?? null); setJobsTab('sources'); setSection('jobs'); };
  const openQuality = (run: string | null, raw: string | null, tab: 'validation' | 'versions') => { setQualityRun(run); setQualityRaw(raw); setQualityView(tab); setQualityTab('validation'); setSection('quality'); };
  const openHistory = (jobId?: string) => { setHistoryJob(jobId); setHistoryKind('runs'); setSection('history'); };
  const openOutput = (selection: DataSelection) => {
    setDataOrigin({ section, runId, rawId });
    setRunId(null);
    setRawId(null);
    setDataSelection(selection);
    setSection('data');
  };
  const returnToOrigin = () => {
    if (!dataOrigin) return;
    setSection(dataOrigin.section);
    setRunId(dataOrigin.runId);
    setRawId(dataOrigin.rawId);
    setDataOrigin(undefined);
  };
  const navigate = (next: Section) => {
    if (next === 'data') { setDataSelection(undefined); setDataOrigin(undefined); }
    if (next === 'history') setHistoryJob(undefined);
    setSection(next);
  };
  const openWorkflow = (selection: WorkflowSelection) => { setWorkflow(selection); setSection('workflow'); };

  return <AdminLayout section={section} setSection={navigate} dark={dark} setDark={setDark}>
    <div className="topline">
      <div className="breadcrumb">{current.group} <span>/</span> {current.title}</div>
    </div>
    <div className="content">
      <header className="page-header">
        <div>
          <h1>{current.title}</h1>
          {['overview', 'workflow', 'quality'].includes(section) && <p>{descriptions[section]}</p>}
          <p className="last-updated">Cập nhật lúc {dateTime(latest)}</p>
        </div>
        <div className="header-actions">
          <button className="primary-button" disabled={refreshing} onClick={() => queryClient.invalidateQueries({ type: 'active' })}>
            <RefreshCw size={15}/>{refreshing ? 'Đang tải…' : 'Tải lại'}
          </button>
        </div>
      </header>
      <div className="connection-strip"><div><span className={`signal ${connection === 'Đã kết nối' ? 'online' : connection === 'Đang kiểm tra' ? '' : 'offline'}`}/><b>Java Backend</b><span>{connection}</span></div></div>
      <ActiveCommandsBanner onSelectCommand={setTrackedCommand}/>

      {section === 'overview' && <>
        <SystemSummary/>
        <Overview health={health} jobs={jobs} sources={sources} runs={runs} issues={issues} onRun={setRunId} onIssue={setIssue} onRuns={() => openHistory()} onQuality={() => setSection('quality')}/>
      </>}

      {section === 'workflow' && <WorkflowPage key={JSON.stringify(workflow)} initial={workflow} onRun={setRunId}/>}

      {section === 'history' && <>
        <Tabs value={historyKind} onChange={setHistoryKind} items={historyTabs}/>
        {historyKind === 'runs'
          ? <JobRunHistory key={historyJob ?? 'all'} jobs={jobs} sources={sources.data} initialJobId={historyJob} onRun={setRunId}/>
          : <OperationsHistory key={historyKind} kind={historyKind} onRun={setRunId}
              onRaw={setRawId} onWorkflow={openWorkflow} onOutput={openOutput}/>}
      </>}

      {section === 'jobs' && <>
        <Tabs value={jobsTab} onChange={setJobsTab} items={[['jobs', 'Job lấy dữ liệu'], ['sources', 'Nguồn dữ liệu']]}/>
        <div className="management-toolbar">
          <div className="header-actions">
            {jobsTab === 'jobs'
              ? <><button className="primary-button" onClick={() => setOperation({ kind: 'create-job' })}>Tạo job</button><button className="light-button" onClick={() => setOperation({ kind: 'manual-ingestion' })}>Lấy dữ liệu thủ công</button></>
              : <button className="primary-button" onClick={() => setOperation({ kind: 'upsert-source' })}>Thêm nguồn dữ liệu</button>}
          </div>
        </div>
        {jobsTab === 'jobs'
          ? <JobsPage onHistory={openHistory} onSource={openSources} jobs={jobs} sources={sources.data} runs={runs.data} onRun={setRunId} onOperation={setOperation} linkedId={jobLink}/>
          : <SourcesPage onJob={openJobs} sources={sources} jobs={jobs.data} runs={runs.data} onRun={setRunId} onOperation={setOperation} linkedId={sourceLink}/>}
      </>}

      {section === 'scope' && <DataScopePage companies={scopeQueries.companies} securities={scopeQueries.securities}/>}

      {section === 'quality' && <>
        <Tabs value={qualityTab} onChange={setQualityTab} items={[['validation', 'Kiểm tra & Vi phạm'], ['financial', 'Chất lượng BCTC'], ['lineage', 'Truy vết nguồn (Lineage)']]}/>
        {qualityTab === 'validation' ? (
          <>
            <div className="management-toolbar">
              <div className="header-actions"><button className="light-button" onClick={() => setOperation({ kind: 'validate-pending' })}>Validate dữ liệu chờ</button></div>
                </div>
            <DataQualityPage key={`${qualityRun}-${qualityRaw}-${qualityView}`} initialTab={qualityView} rawFilter={qualityRaw} onRaw={setRawId} openIssues={issues} results={results} versions={versions} rules={q.rules} onSelect={setIssue} onRun={setRunId} runFilter={qualityRun} clearRunFilter={() => { setQualityRun(null); setQualityRaw(null); }}/>
          </>
        ) : qualityTab === 'financial' ? (
          <FinancialQualityPage />
        ) : (
          <LineageTracerPage onRun={setRunId} onRaw={setRawId}/>
        )}
      </>}

      {section === 'ai' && <AiOperationsPage onRun={setRunId}/>}
      {section === 'data' && <DataBrowser key={JSON.stringify(dataSelection)} initial={dataSelection} onBack={dataOrigin ? returnToOrigin : undefined} onRun={setRunId} onRaw={setRawId}/>}

      {section === 'system' && <>
        <Tabs value={systemTab} onChange={setSystemTab} items={[['status', 'Kết nối'], ['coverage', 'Độ phủ dữ liệu'], ['market', 'Dữ liệu thị trường'], ['api', 'Danh mục & tài liệu API']]}/>
        {systemTab === 'status' ? <RuntimePage/> : systemTab === 'coverage' ? <CoverageRemediationPanel onWorkflow={openWorkflow}/> : systemTab === 'market' ? <MarketDataAdminPage/> : <CatalogMaintenancePanel/>}
      </>}
    </div>
    <RunDrawer onLinkedRun={setRunId} key={runId ?? 'none'} onOutput={openOutput} onProcess={id => openWorkflow({ mode: 'PROCESS_RUN', runId: id })} onRaw={id => { setRunId(null); setRawId(id); }} onIssue={value => { setRunId(null); setIssue(value); }} id={runId} onClose={() => setRunId(null)} onOperation={setOperation} onJob={id => { setRunId(null); openJobs(id); }} onSource={id => { setRunId(null); openSources(id); }} onQuality={id => { setRunId(null); openQuality(id, null, 'validation'); }}/>
    <ValidationDrawer onRaw={id => { setIssue(null); setRawId(id); }} issue={issue} onClose={() => setIssue(null)} onRun={setRunId} onWorkflow={openWorkflow}/>
    <RawPayloadDrawer key={rawId ?? 'none'} onOutput={openOutput} id={rawId} onClose={() => setRawId(null)} onRun={id => { setRawId(null); setRunId(id); }} onIssue={value => { setRawId(null); setIssue(value); }} onOperation={value => { setRawId(null); setOperation(value); }} onQuality={(payloadId, ingestionRunId) => { setRawId(null); openQuality(ingestionRunId, payloadId, 'validation'); }} onVersions={id => { setRawId(null); openQuality(id, null, 'versions'); }}/>
    {operation && <OperationDrawer operation={operation} sources={sources.data} onClose={() => setOperation(null)} onRun={setRunId}/>}
    {trackedCommand && <CommandTracker id={trackedCommand} onRun={setRunId} onCommand={setTrackedCommand}/>}
  </AdminLayout>;
}
