import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_BASE, getJson } from '../../shared/api/client';
import { Drawer, Panel, QueryState } from '../../shared/components/Ui';
import { Records, type Row } from './Records';
import { dataLabels, isOutputTable, statusLabels, tableStatuses, useAdminRows, type DataSelection } from './dataViews';

interface Dataset { name: string; available: boolean; columns: string[]; exactFilters?: string[] }
const fallbackExact = ['id', 'raw_payload_id', 'data_version_id', 'security_id', 'llm_run_id', 'validation_target', 'data_source_id', 'ingestion_job_id'];
const exactLabels: Record<string, string> = {
  data_version_id: 'ID phiên bản', raw_payload_id: 'ID dữ liệu nguồn', ingestion_job_id: 'ID job',
  security_id: 'ID chứng khoán', data_source_id: 'ID nguồn', financial_statement_id: 'ID báo cáo',
};
const exactQuery = (exact: Record<string, string>) => new URLSearchParams(
  Object.entries(exact).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value),
).toString();

export function DataBrowser({ initial, onRun, onRaw, onBack }: {
  initial?: DataSelection; onBack?: () => void; onRun: (id: string) => void; onRaw: (id: string) => void;
}) {
  const [table, setTable] = useState(initial?.table ?? 'market_prices');
  const [page, setPage] = useState(0);
  const [report, setReport] = useState<{ id: string; symbol: string }>();
  const [search, setSearch] = useState('');
  const [run, setRun] = useState('');
  const [status, setStatus] = useState('');
  const [exact, setExact] = useState(initial?.exact ?? {});
  const [filter, setFilter] = useState(() => exactQuery(initial?.exact ?? {}));
  const catalog = useQuery({
    queryKey: ['admin-datasets'], staleTime: 300000,
    queryFn: () => getJson<Dataset[]>(API_BASE, '/api/admin/console/datasets'),
  });
  const available = Array.isArray(catalog.data) ? catalog.data.filter(item => item.available) : [];
  const selected = available.find(item => item.name === table);
  const hasRun = selected?.columns.includes('ingestion_run_id');
  const statuses = tableStatuses[table];
  const exactKeys = selected?.exactFilters ?? fallbackExact.filter(key => selected?.columns.includes(key));
  const data = useAdminRows(table, page, filter, { enabled: !!selected });
  const total = data.data?.total ?? 0;

  const reset = () => {
    setSearch('');
    setRun('');
    setStatus('');
    setExact({});
    setFilter('');
    setPage(0);
  };
  const field = (key: string, value: string) => setExact(previous => ({ ...previous, [key]: value }));

  return <Panel title={initial?.exact?.data_version_id ? 'Dữ liệu đã ghi theo phiên bản' : 'Tra cứu dữ liệu'}
    action={onBack && <button className="light-button" onClick={onBack}>Quay lại</button>}>
    <QueryState query={catalog}>
      {available.length > 0 && <form className="ledger-filters" onSubmit={event => {
        event.preventDefault();
        const params = new URLSearchParams(exactQuery(exact));
        if (search.trim()) params.set('search', search.trim());
        if (hasRun && run.trim()) params.set('runId', run.trim());
        if (statuses && status) params.set('status', status);
        setPage(0);
        setFilter(params.toString());
      }}>
        <label>Loại dữ liệu<select aria-label="Loại dữ liệu" value={table} onChange={event => { setTable(event.target.value); reset(); }}>
          {!selected && <option value={table}>{dataLabels[table] ?? table}</option>}
          {['Dữ liệu đã ghi', 'Lịch sử và danh mục'].map((group, index) =>
            <optgroup key={group} label={group}>{available.filter(item => isOutputTable(item.name) === (index === 0))
              .map(item => <option key={item.name} value={item.name}>{dataLabels[item.name] ?? item.name}</option>)}</optgroup>)}
        </select></label>
        <label>Tìm dữ liệu<input value={search} maxLength={100} onChange={event => setSearch(event.target.value)} placeholder="Mã, tên hoặc ID"/></label>
        {statuses && <label>Trạng thái<select aria-label="Trạng thái" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">Tất cả</option>{statuses.map(value => <option key={value} value={value}>{statusLabels[value] ?? value}</option>)}
        </select></label>}
        {['is_canonical', 'is_current'].filter(key => exactKeys.includes(key)).map(key =>
          <label key={key}>{key === 'is_canonical' ? 'Bản chuẩn' : 'Hiện hành'}<select value={exact[key] ?? ''} onChange={event => field(key, event.target.value)}>
            <option value="">Tất cả</option><option value="true">Có</option><option value="false">Không</option>
          </select></label>)}
        <div className="ledger-actions"><button className="primary-button">Áp dụng bộ lọc</button>
          <button className="light-button" type="button" onClick={reset}>Xóa bộ lọc</button></div>
        {(hasRun || exactKeys.some(key => !['is_canonical', 'is_current'].includes(key))) && <details className="ledger-more">
          <summary>Lọc theo ID</summary>
          <div className="ledger-filters">
            {hasRun && <label>ID lượt chạy<input value={run} onChange={event => setRun(event.target.value)}/></label>}
            {exactKeys.filter(key => !['is_canonical', 'is_current'].includes(key)).map(key =>
              <label key={key}>{exactLabels[key] ?? key}<input maxLength={200} value={exact[key] ?? ''} onChange={event => field(key, event.target.value)}/></label>)}
          </div>
        </details>}
      </form>}
    </QueryState>
    {!selected && catalog.isSuccess && <p className="state-empty">Loại dữ liệu này chưa có trên hệ thống.</p>}
    {selected && <QueryState query={data}>
      <div className="ledger-context"><code>{table}</code>
        {new URLSearchParams(filter).get('data_version_id') && <span className="break">Phiên bản {new URLSearchParams(filter).get('data_version_id')}</span>}
        {new URLSearchParams(filter).get('raw_payload_id') && <span className="break">Raw {new URLSearchParams(filter).get('raw_payload_id')}</span>}
      </div>
      <Records key={`${table}-${page}-${filter}`} rows={data.data?.rows ?? []} onRun={onRun} onRaw={onRaw}
        actions={row => table === 'financial_statements' && row.is_canonical === true && row.is_current === true
          && typeof row.id === 'string' && typeof row.symbol === 'string'
          ? <button className="text-button" onClick={() => setReport({ id: String(row.id), symbol: String(row.symbol) })}>
              Xem chỉ tiêu</button> : null}/>
      <div className="toolbar ledger-pager">
        <span>{total.toLocaleString('vi-VN')} bản ghi · Trang {page + 1}</span>
        <button className="light-button" disabled={!page || data.isFetching} onClick={() => setPage(previous => previous - 1)}>Trang trước</button>
        <button className="light-button" disabled={(page + 1) * 25 >= total || data.isFetching} onClick={() => setPage(previous => previous + 1)}>Trang sau</button>
      </div>
    </QueryState>}
    {report && <StatementItems {...report} onClose={() => setReport(undefined)}/>}
  </Panel>;
}

function StatementItems({ id, symbol, onClose }: { id: string; symbol: string; onClose: () => void }) {
  const query = useQuery({
    queryKey: ['admin-published-statement', id, symbol],
    queryFn: () => getJson<{ data?: { items?: Row[] } }>(API_BASE,
      `/api/v1/securities/${encodeURIComponent(symbol)}/statements/${encodeURIComponent(id)}`),
  });
  return <Drawer title={`Chỉ tiêu báo cáo · ${symbol}`} subtitle={id} onClose={onClose}>
    <QueryState query={query}><Records rows={query.data?.data?.items ?? []}/></QueryState>
  </Drawer>;
}
