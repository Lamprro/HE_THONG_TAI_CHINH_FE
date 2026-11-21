import { useState } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Badge, Drawer, Panel, QueryState } from '../../shared/components/Ui';
import { safeText, safeUrl } from '../../shared/utils/format';
import { companyFields, securityFields } from './forms';
import { useAliases } from './api';
import { ScopeOperationDrawer, type ScopeOperation } from './ScopeOperationDrawer';
import type { Company, Security } from './contracts';
import { API_BASE, postJson } from '../../shared/api/client';

const label = (fields: { key: string; label: string }[], key: string) => fields.find(field => field.key === key)?.label || (key === 'id' ? 'ID' : key);
const show = (value: unknown) => value == null || value === '' ? '—' : typeof value === 'boolean' ? value ? 'Có' : 'Không' : safeText(String(value));
const activeBadge = (active: boolean) => <Badge tone={active ? 'green' : 'neutral'}>{active ? 'Đang hoạt động' : 'Ngừng'}</Badge>;

function CompanyDetails({ company, securities, onClose, onOperation, onSecurity }: { company: Company; securities: Security[] | undefined; onClose: () => void; onOperation: (operation: ScopeOperation) => void; onSecurity: (security: Security) => void }) {
  const aliases = useAliases(company.id);
  const owned = securities?.filter(s => s.companyId === company.id);
  return <Drawer title={company.legalName} subtitle={company.companyCode} onClose={onClose}>
    <div className="operation-actions"><button className="primary-button" onClick={() => onOperation({ kind: 'update-company', company })}>Sửa công ty</button><button className="light-button" onClick={() => onOperation({ kind: 'add-alias', company })}>Thêm tên gọi khác</button></div>
    <div className="detail-grid">{Object.entries(company).filter(([key]) => key !== 'description').map(([key, value]) => <div key={key}><span>{label(companyFields, key)}</span><b className="break">{key === 'website' ? safeUrl(value as string | null) : show(value)}</b></div>)}</div><p>{safeText(company.description)}</p>
    <div className="detail-section"><h3>Tên gọi khác</h3><QueryState query={aliases} empty="Chưa có tên gọi khác.">{aliases.data?.map(alias => <div className="mini-record" key={alias.id}><b>{alias.alias}</b><span>{alias.aliasType} · ID {alias.id}</span></div>)}</QueryState></div>
    <div className="detail-section"><h3>Mã chứng khoán của công ty</h3>{owned === undefined ? <p>Danh sách mã chưa tải xong.</p> : owned.length ? owned.map(security => <button className="mini-record mini-action" key={security.id} onClick={() => onSecurity(security)}>{security.symbol} · {security.exchange} · {security.active ? 'Đang hoạt động' : 'Ngừng'}</button>) : <p>Công ty chưa có mã chứng khoán.</p>}</div>
  </Drawer>;
}
export function DataScopePage({ companies, securities }: { companies: UseQueryResult<Company[]>; securities: UseQueryResult<Security[]> }) {
  const [tab, setTab] = useState<'companies' | 'securities'>('companies');
  const [search, setSearch] = useState(''); const [active, setActive] = useState('ALL');
  const [exchange, setExchange] = useState('ALL'); const [type, setType] = useState('ALL'); const [industry, setIndustry] = useState('ALL');
  const [companyId, setCompanyId] = useState<string | null>(null); const [securityId, setSecurityId] = useState<string | null>(null);
  const [operation, setOperation] = useState<ScopeOperation | null>(null);
  const [scopeMessage, setScopeMessage] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState(false);

  const company = companies.data?.find(c => c.id === companyId), security = securities.data?.find(s => s.id === securityId);
  const companyName = (id: string) => companies.data?.find(c => c.id === id)?.legalName;
  const openOperation = (value: ScopeOperation) => { setCompanyId(null); setSecurityId(null); setOperation(value); };
  const term = search.toLowerCase();
  const companyRows = (companies.data || []).filter(c => `${c.companyCode} ${c.legalName} ${c.shortName || ''} ${c.taxCode || ''}`.toLowerCase().includes(term) && (active === 'ALL' || String(c.active) === active) && (industry === 'ALL' || c.industryName === industry)).sort((a, b) => a.companyCode.localeCompare(b.companyCode));
  const securityRows = (securities.data || []).filter(s => `${s.symbol} ${companyName(s.companyId) || ''}`.toLowerCase().includes(term) && (active === 'ALL' || String(s.active) === active) && (exchange === 'ALL' || s.exchange === exchange) && (type === 'ALL' || s.securityType === type)).sort((a, b) => a.symbol.localeCompare(b.symbol));

  const reconcileAllJobs = async () => {
    try {
      setProvisioning(true);
      const res: any = await postJson(API_BASE, '/api/security-job-reconciliation/run', {});
      setScopeMessage(`Đồng bộ Job thành công. Số job mới được cấp: ${res?.provisionedJobCount ?? 0}.`);
    } catch (err: any) {
      setScopeMessage(`Lỗi đồng bộ job: ${err?.message || 'Thất bại'}`);
    } finally {
      setProvisioning(false);
    }
  };

  const provisionSingle = async (secId: string, sym: string) => {
    try {
      setProvisioning(true);
      const res: any = await postJson(API_BASE, `/api/securities/${secId}/ingestion-jobs/provision`, {});
      setScopeMessage(`Cấp Job cho mã ${sym} thành công. Số job ảnh hưởng: ${res?.affectedJobCount ?? 0}.`);
    } catch (err: any) {
      setScopeMessage(`Lỗi cấp job cho ${sym}: ${err?.message || 'Thất bại'}`);
    } finally {
      setProvisioning(false);
    }
  };

  return <>
    <div className="tabs" role="tablist" aria-label="Danh mục mã">{(['companies', 'securities'] as const).map(value => <button role="tab" key={value} aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => { setTab(value); setSearch(''); setActive('ALL'); }}>{value === 'companies' ? 'Công ty' : 'Mã chứng khoán'}</button>)}</div>
    {scopeMessage && (
      <div className="mini-record" style={{ marginBottom: '1rem', background: 'var(--panel-alt, #f8fafc)', borderLeft: '4px solid var(--accent, #3b82f6)' }}>
        <strong>Thông báo:</strong> {scopeMessage}
        <button className="text-button" style={{ marginLeft: 8 }} onClick={() => setScopeMessage(null)}>Đóng</button>
      </div>
    )}
    <Panel
      title={tab === 'companies' ? 'Công ty' : 'Mã chứng khoán'}
      eyebrow="PHẠM VI THU THẬP"
      note="Tìm kiếm và lọc trên danh mục đã tải"
      action={
        tab === 'companies' ? (
          <button className="primary-button" onClick={() => openOperation({ kind: 'create-company' })}>Thêm công ty</button>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="light-button" disabled={provisioning} onClick={reconcileAllJobs}>
              {provisioning ? 'Đang đồng bộ…' : 'Đồng bộ Job toàn bộ'}
            </button>
            <button className="primary-button" onClick={() => openOperation({ kind: 'create-security' })}>Thêm mã chứng khoán</button>
          </div>
        )
      }
    >
      <div className="toolbar filters"><label>Tìm kiếm <input value={search} onChange={event => setSearch(event.target.value)} placeholder={tab === 'companies' ? 'Tên, mã công ty hoặc mã số thuế' : 'Mã chứng khoán hoặc tên công ty'}/></label><label>Trạng thái <select value={active} onChange={event => setActive(event.target.value)}><option value="ALL">Tất cả</option><option value="true">Đang hoạt động</option><option value="false">Ngừng</option></select></label>
        {tab === 'companies' ? <label>Ngành <select value={industry} onChange={event => setIndustry(event.target.value)}><option value="ALL">Tất cả ngành</option>{[...new Set(companies.data?.map(c => c.industryName).filter((v): v is string => !!v))].sort().map(v => <option key={v}>{v}</option>)}</select></label> : <><label>Sàn <select value={exchange} onChange={event => setExchange(event.target.value)}><option value="ALL">Tất cả sàn</option>{[...new Set(securities.data?.map(s => s.exchange))].sort().map(v => <option key={v}>{v}</option>)}</select></label><label>Loại <select value={type} onChange={event => setType(event.target.value)}><option value="ALL">Tất cả loại</option>{[...new Set(securities.data?.map(s => s.securityType))].sort().map(v => <option key={v}>{v}</option>)}</select></label></>}
        <span className="subtle">{tab === 'companies' ? (companies.data ? `${companyRows.length} / ${companies.data.length} công ty` : '—') : (securities.data ? `${securityRows.length} / ${securities.data.length} mã` : '—')}</span>
      </div>
      {tab === 'companies' ? <QueryState query={companies} empty="Chưa có công ty."><div className="table-scroll"><table><thead><tr><th>Công ty</th><th>Ngành</th><th>Mã số thuế</th><th>Trạng thái</th></tr></thead><tbody>{companyRows.map(c => <tr tabIndex={0} key={c.id} onClick={() => setCompanyId(c.id)} onKeyDown={e => e.key === 'Enter' && setCompanyId(c.id)}><td><strong>{c.legalName}</strong><small>{c.companyCode}</small></td><td>{c.industryName || '—'}</td><td>{c.taxCode || '—'}</td><td>{activeBadge(c.active)}</td></tr>)}</tbody></table></div>{!companyRows.length && <p className="state-empty">Không có công ty khớp bộ lọc.</p>}</QueryState> : <QueryState query={securities} empty="Chưa có mã chứng khoán."><div className="table-scroll"><table><thead><tr><th>Mã</th><th>Công ty</th><th>Sàn</th><th>Loại</th><th>Tiền tệ</th><th>Trạng thái</th></tr></thead><tbody>{securityRows.map(s => <tr tabIndex={0} key={s.id} onClick={() => setSecurityId(s.id)} onKeyDown={e => e.key === 'Enter' && setSecurityId(s.id)}><td><strong>{s.symbol}</strong></td><td>{companyName(s.companyId) || s.companyId}</td><td>{s.exchange}</td><td>{s.securityType}</td><td>{s.currency}</td><td>{activeBadge(s.active)}</td></tr>)}</tbody></table></div>{!securityRows.length && <p className="state-empty">Không có mã khớp bộ lọc.</p>}</QueryState>}
    </Panel>
    {company && <CompanyDetails company={company} securities={securities.data} onClose={() => setCompanyId(null)} onOperation={openOperation} onSecurity={s => { setCompanyId(null); setSecurityId(s.id); }}/>}
    {security && <Drawer title={security.symbol} subtitle={security.id} onClose={() => setSecurityId(null)}>
      <div className="operation-actions">
        <button className="primary-button" onClick={() => openOperation({ kind: 'update-security', security })}>Sửa mã chứng khoán</button>
        <button className="light-button" onClick={() => openOperation({ kind: 'security-activation', security })}>{security.active ? 'Ngừng mã' : 'Kích hoạt mã'}</button>
        <button className="light-button" disabled={provisioning} onClick={() => provisionSingle(security.id, security.symbol)}>Cấp Job cho mã</button>
      </div>
      <p>Trạng thái hoạt động là cấu hình của mã; không cho biết scheduler hay job có đang chạy.</p>
      <div className="detail-grid">{Object.entries(security).map(([key, value]) => <div key={key}><span>{label(securityFields, key)}</span><b className="break">{key === 'companyId' ? companyName(security.companyId) || show(value) : show(value)}</b></div>)}</div>
      {companyName(security.companyId) ? <button className="light-button" onClick={() => { setSecurityId(null); setCompanyId(security.companyId); }}>Xem công ty sở hữu</button> : <p>Công ty ID {security.companyId} không có trong danh sách đã tải.</p>}
    </Drawer>}
    {operation && <ScopeOperationDrawer operation={operation} companies={companies.data || []} onClose={() => setOperation(null)}/>}
  </>;
}
