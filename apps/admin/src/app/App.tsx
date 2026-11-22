import { useState } from 'react';
import type { AdminSession } from '../shared/api/admin-contract';
import { Badge } from '../shared/components/Ui';
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
import { CommandTracker } from '../features/admin/CommandTracker';
import type { DataSelection } from '../features/admin/dataViews';
import { SystemSummary } from '../features/admin/SystemSummary';

type HistoryKind = 'commands' | 'runs' | 'quality';
const historyTabs: [HistoryKind, string][] = [['runs', 'Lịch sử job'], ['quality', 'Kiểm tra & ghi dữ liệu'], ['commands', 'Tác vụ nền']];

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: [T, string][] }) {
  return <div className="toolbar section-tabs">{items.map(([id, title]) => <button key={id} aria-pressed={value === id} className={value === id ? 'primary-button' : 'light-button'} onClick={() => onChange(id)}>{title}</button>)}</div>;
}

export function App() {
  return <SessionGate>{(session, onLogout, logoutPending, logoutError) =>
    <Dashboard session={session} onLogout={onLogout} logoutPending={logoutPending} logoutError={logoutError}/>}</SessionGate>;
}
function Dashboard({ session, onLogout, logoutPending, logoutError }: {
  session: AdminSession; onLogout: () => void; logoutPending: boolean; logoutError: string;
}) {
  const [section, setSection] = useState<Section>('overview');
  const [workflow, setWorkflow] = useState<WorkflowSelection>({});
  const [historyKind, setHistoryKind] = useState<HistoryKind>('runs');
  const [historyJob, setHistoryJob] = useState<string | undefined>();
  const [dataSelection, setDataSelection] = useState<DataSelection>();
  const [dataOrigin, setDataOrigin] = useState<{ section: Section; runId: string | null; rawId: string | null }>();
  const [jobsTab, setJobsTab] = useState<'jobs' | 'sources'>('jobs');
  const [qualityTab, setQualityTab] = useState<'validation' | 'financial'>('validation');
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
  const connection = health.isPending ? 'Đang kiểm tra Java'
    : health.isError || health.data?.data.status !== 'UP' ? 'Mất kết nối Java' : null;
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

  return <AdminLayout section={section} setSection={navigate} dark={dark} setDark={setDark}
    account={session.email ?? session.principal} onLogout={onLogout} logoutPending={logoutPending}>
    <div className="content">
      <header className="page-header">
        <h1>{current.title}</h1>
        <div className="header-actions">
          <button className="light-button" disabled={refreshing} onClick={() => queryClient.invalidateQueries({ type: 'active' })}>
            <RefreshCw size={15}/>{refreshing ? 'Đang tải…' : 'Tải lại'}
          </button>
        </div>
      </header>
      {logoutError && <p className="state-error" role="alert">{logoutError}</p>}
      {connection && section !== 'system' && <div className="page-connection" role="status">
        <Badge tone={health.isPending ? 'neutral' : 'red'}>{connection}</Badge>
      </div>}
      <ActiveCommandsBanner onSelectCommand={setTrackedCommand} onOpenHistory={() => { setHistoryKind('commands'); setSection('history'); }}/>

      {section === 'overview' && <>
        <SystemSummary/>
        <Overview jobs={jobs} sources={sources} runs={runs} issues={issues} onRun={setRunId} onIssue={setIssue} onRuns={() => openHistory()} onQuality={() => setSection('quality')}/>
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
        <Tabs value={qualityTab} onChange={setQualityTab} items={[['validation', 'Kết quả kiểm tra'], ['financial', 'Chất lượng BCTC']]}/>
        {qualityTab === 'validation' ? (
          <>
            <div className="management-toolbar">
              <button className="light-button" onClick={() => setOperation({ kind: 'validate-pending' })}>Validate dữ liệu chờ</button>
            </div>
            <DataQualityPage key={`${qualityRun}-${qualityRaw}-${qualityView}`} initialTab={qualityView} rawFilter={qualityRaw} onRaw={setRawId} openIssues={issues} results={results} versions={versions} rules={q.rules} onSelect={setIssue} onRun={setRunId} runFilter={qualityRun} clearRunFilter={() => { setQualityRun(null); setQualityRaw(null); }}/>
          </>
        ) : <FinancialQualityPage/>}
      </>}

      {section === 'ai' && <AiOperationsPage onRun={setRunId}/>}
      {section === 'data' && <DataBrowser key={JSON.stringify(dataSelection)} initial={dataSelection} onBack={dataOrigin ? returnToOrigin : undefined} onRun={setRunId} onRaw={setRawId}/>}

      {section === 'system' && <>
        <Tabs value={systemTab} onChange={setSystemTab} items={[['status', 'Kết nối'], ['coverage', 'Độ phủ dữ liệu'], ['market', 'Dữ liệu thị trường'], ['api', 'Danh mục & tài liệu API']]}/>
        {systemTab === 'status' ? <RuntimePage javaLoading={health.isPending} javaUp={health.isSuccess && health.data?.data.status === 'UP'}/> : systemTab === 'coverage' ? <CoverageRemediationPanel onWorkflow={openWorkflow}/> : systemTab === 'market' ? <MarketDataAdminPage/> : <CatalogMaintenancePanel/>}
      </>}
    </div>
    <RunDrawer onLinkedRun={setRunId} key={runId ?? 'none'} onOutput={openOutput} onProcess={id => openWorkflow({ mode: 'PROCESS_RUN', runId: id })} onRaw={id => { setRunId(null); setRawId(id); }} onIssue={value => { setRunId(null); setIssue(value); }} id={runId} onClose={() => setRunId(null)} onOperation={setOperation} onJob={id => { setRunId(null); openJobs(id); }} onSource={id => { setRunId(null); openSources(id); }} onQuality={id => { setRunId(null); openQuality(id, null, 'validation'); }}/>
    <ValidationDrawer onRaw={id => { setIssue(null); setRawId(id); }} issue={issue} onClose={() => setIssue(null)} onRun={setRunId} onWorkflow={openWorkflow}/>
    <RawPayloadDrawer key={rawId ?? 'none'} onOutput={openOutput} id={rawId} onClose={() => setRawId(null)} onRun={id => { setRawId(null); setRunId(id); }} onIssue={value => { setRawId(null); setIssue(value); }} onOperation={value => { setRawId(null); setOperation(value); }} onQuality={(payloadId, ingestionRunId) => { setRawId(null); openQuality(ingestionRunId, payloadId, 'validation'); }} onVersions={id => { setRawId(null); openQuality(id, null, 'versions'); }}/>
    {operation && <OperationDrawer operation={operation} sources={sources.data} onClose={() => setOperation(null)} onRun={setRunId}/>}
    {trackedCommand && <CommandTracker id={trackedCommand} onRun={setRunId} onCommand={setTrackedCommand}/>}
  </AdminLayout>;
}
