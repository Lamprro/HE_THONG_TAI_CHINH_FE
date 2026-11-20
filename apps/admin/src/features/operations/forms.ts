import type { DataSource } from '../dashboard/types/dto';
import { datasetTypes, sourceTypes, licenseStatuses, operations, type CreateIngestionJobRequest, type DataSourceRequest, type ManualIngestionRequest, type ExternalOperation } from './contracts';
export type FormValues = Record<string, string>;
export function jsonObject(value: string, stringsOnly = false): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('Nhập JSON hợp lệ.'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Nhập một JSON object.');
  if (stringsOnly && Object.values(parsed).some(v => typeof v !== 'string')) throw new Error('Mọi giá trị tham số phải là chuỗi.');
  if (/"[^"\n]*(?:secret|password|token|api[_-]?key|authorization|credential)[^"\n]*"\s*:/i.test(value)) throw new Error('Thông tin đăng nhập phải cấu hình trên server, không gửi từ form.');
  return parsed as Record<string, unknown>;
}
export function buildRequest(kind: 'create-job' | 'manual-ingestion' | 'upsert-source', v: FormValues, sources: DataSource[], editing?: DataSource): { body?: CreateIngestionJobRequest | ManualIngestionRequest | DataSourceRequest; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const required = (key: string) => { if (!v[key]?.trim()) errors[key] = 'Trường này bắt buộc.'; return v[key]?.trim() ?? ''; };
  const object = (key: string, strings = false) => { try { return jsonObject(v[key], strings); } catch (e) { errors[key] = (e as Error).message; return {}; } };
  if (kind === 'create-job') {
    const dataSourceCode = required('dataSourceCode'), code = required('code').toUpperCase(), name = required('name');
    if (!sources.some(s => s.code === dataSourceCode)) errors.dataSourceCode = 'Chọn một nguồn dữ liệu có trong danh sách.';
    if (!datasetTypes.includes(v.datasetType as typeof datasetTypes[number])) errors.datasetType = 'Chọn loại dữ liệu được hỗ trợ.';
    if (v.maxRetries !== '10') errors.maxRetries = 'Chính sách retry của server yêu cầu 10.';
    const timeout = v.timeoutSeconds ? Number(v.timeoutSeconds) : undefined;
    if (timeout !== undefined && (!Number.isInteger(timeout) || timeout <= 0 || timeout > 2147483647)) errors.timeoutSeconds = 'Nhập số nguyên dương (32-bit).';
    const cron = v.cronExpression?.trim();
    if (cron && !/^@(yearly|annually|monthly|weekly|daily|midnight|hourly)$/.test(cron) && (cron.split(/\s+/).length !== 6 || !/^[\dA-Za-z*?,/\s#LWC-]+$/.test(cron))) errors.cronExpression = 'Dùng cron Spring 6 trường hoặc @macro được hỗ trợ. Server kiểm tra đầy đủ biểu thức.';
    const parameters = object('parameters');
    return { errors, body: { dataSourceCode, code, name, datasetType: v.datasetType as CreateIngestionJobRequest['datasetType'], cronExpression: cron || null, parameters, maxRetries: 10, ...(timeout === undefined ? {} : { timeoutSeconds: timeout }), active: v.active === 'true' } };
  }
  if (kind === 'upsert-source') {
    const code = required('code').toUpperCase(), name = required('name');
    if (editing && code !== editing.code) errors.code = 'Không thể đổi mã nguồn.';
    if (!editing && sources.some(s => s.code.toUpperCase() === code)) errors.code = 'Mã này đã tồn tại. Hãy dùng Sửa nguồn dữ liệu.';
    if (!sourceTypes.includes(v.sourceType as typeof sourceTypes[number])) errors.sourceType = 'Chọn loại nguồn được hỗ trợ.';
    if (!licenseStatuses.includes(v.licenseStatus as typeof licenseStatuses[number])) errors.licenseStatus = 'Chọn trạng thái giấy phép được hỗ trợ.';
    if (v.baseUrl) { try { const url = new URL(v.baseUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /token|key|password|secret/i.test(url.search)) throw new Error(); } catch { errors.baseUrl = 'Nhập URL HTTP(S) không kèm thông tin đăng nhập.'; } }
    return { errors, body: { code, name, sourceType: v.sourceType as DataSourceRequest['sourceType'], baseUrl: v.baseUrl || null, provider: v.provider || null, official: v.official === 'true', licenseStatus: v.licenseStatus as DataSourceRequest['licenseStatus'], active: v.active === 'true' } };
  }
  const operation = required('operation') as ExternalOperation;
  if (!operations.includes(operation)) errors.operation = 'Chọn thao tác được hỗ trợ.';
  const source = sources.find(s => s.code === v.dataSourceCode && s.active && s.sourceType === 'API');
  if (!source) errors.dataSourceCode = 'Chọn một nguồn API đang bật.';
  const provider = source?.provider?.toLowerCase() || '';
  const noProvider = ['HEALTH', 'PROVIDERS', 'CAPABILITIES', 'NEWS_STATUS', 'NEWS_SITES', 'NEWS_LATEST', 'NEWS_HISTORY', 'NEWS_COMPANY', 'PROXY_PROVIDERS', 'FETCH_URL'];
  if (!noProvider.includes(operation) && !provider) errors.dataSourceCode = 'Thao tác này cần nguồn có provider.';
  if (operation.startsWith('INDEX_') && !(provider === 'vnstock' || (operation === 'INDEX_OHLCV' && ['kbs', 'vndirect', 'cafef'].includes(provider)))) errors.dataSourceCode = 'Thao tác chỉ số cần provider vnstock.';
  if (['QUOTE', 'OHLCV', 'COMPANY', 'FINANCIAL_STATEMENT', 'RATIO'].includes(operation) && !['vnstock', 'vndirect', 'cafef'].includes(provider)) errors.dataSourceCode = 'Chọn nguồn API vnstock, vndirect hoặc cafef.';
  if (operation === 'RATIO' && provider === 'cafef') errors.dataSourceCode = 'CafeF không hỗ trợ chỉ số tài chính (ratio).';
  if (['MANAGEMENT', 'SUBSIDIARIES', 'NEWS', 'EVENTS'].includes(operation) && provider !== 'cafef') errors.dataSourceCode = 'Thao tác này cần nguồn API cafef.';
  if (operation === 'RAW_PROXY' && !['vndirect', 'cafef', 'cafef-financial'].includes(provider)) errors.dataSourceCode = 'Chọn nguồn proxy được hỗ trợ.';
  if (operation === 'MACRO_OBSERVATIONS' && !['worldbank', 'bis'].includes(provider)) errors.dataSourceCode = 'Chọn nguồn API worldbank hoặc bis.';
  if (operation === 'FOREIGN_TRADES' && provider !== 'cafef') errors.dataSourceCode = 'Giao dịch khối ngoại cần provider cafef.';
  if (['RATIO', 'FOREIGN_TRADES'].includes(operation) && !!v.startDate !== !!v.endDate) errors.endDate = 'Lịch sử cần cả ngày bắt đầu và ngày kết thúc.';
  const symbol = v.symbol?.trim().toUpperCase();
  if (['QUOTE', 'OHLCV', 'INDEX_OHLCV', 'INDEX_LATEST', 'INDEX_MEMBERS', 'COMPANY', 'FINANCIAL_STATEMENT', 'RATIO', 'FOREIGN_TRADES', 'MANAGEMENT', 'SUBSIDIARIES', 'NEWS', 'EVENTS', 'NEWS_COMPANY'].includes(operation) && !symbol) errors.symbol = 'Thao tác này cần mã chứng khoán.';
  if (symbol && !/^[A-Z0-9._-]{1,20}$/.test(symbol)) errors.symbol = 'Dùng 1–20 ký tự chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.';
  for (const field of ['startDate', 'endDate']) if (v[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(v[field]) || Number.isNaN(Date.parse(v[field])) || new Date(v[field]).toISOString().slice(0, 10) !== v[field])) errors[field] = 'Nhập ngày hợp lệ.';
  if (v.startDate && v.endDate) {
    if (v.startDate > v.endDate) errors.endDate = 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
    const max = new Date(v.startDate); max.setUTCFullYear(max.getUTCFullYear() + (operation === 'MACRO_OBSERVATIONS' ? 20 : ['RATIO', 'FOREIGN_TRADES', 'INDEX_OHLCV'].includes(operation) ? 15 : 10));
    if (new Date(v.endDate) > max) errors.endDate = 'Khoảng ngày vượt giới hạn của thao tác.';
  }
  const parameters = object('parameters', true) as Record<string, string>;
  for (const [op, key] of [['FINANCIAL_STATEMENT', 'statement'], ['RAW_PROXY', 'upstream_path'], ['FETCH_URL', 'url']] as const) if (operation === op && !parameters[key]?.trim()) errors.parameters = `Cần tham số chuỗi "${key}".`;
  if (operation === 'FINANCIAL_STATEMENT' && parameters.statement && !['balance_sheet', 'income_statement', 'cash_flow'].includes(parameters.statement.trim().toLowerCase().replaceAll('-', '_'))) errors.parameters = 'statement phải là balance_sheet, income_statement hoặc cash_flow.';
  if (operation === 'RAW_PROXY' && parameters.upstream_path && (parameters.upstream_path.startsWith('/') || parameters.upstream_path.includes('..'))) errors.parameters = 'upstream_path phải là đường dẫn tương đối an toàn.';
  return { errors, body: { operation, dataSourceCode: v.dataSourceCode, ...(provider ? { provider } : {}), ...(symbol ? { symbol } : {}), ...(v.startDate ? { startDate: v.startDate } : {}), ...(v.endDate ? { endDate: v.endDate } : {}), ...(v.interval ? { interval: v.interval } : {}), parameters } };
}
