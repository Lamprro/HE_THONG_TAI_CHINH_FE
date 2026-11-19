import { aliasTypes, exchanges, securityTypes, type Company, type CompanyRequest, type CompanyAliasRequest, type SecurityRequest } from './contracts';
export interface ScopeField { key: string; label: string; required?: boolean; type?: string; options?: readonly string[] }
export const companyFields: ScopeField[] = [
  { key: 'companyCode', label: 'Mã công ty', required: true }, { key: 'legalName', label: 'Tên pháp lý', required: true },
  ...[['taxCode', 'Mã số thuế'], ['shortName', 'Tên viết tắt'], ['englishName', 'Tên tiếng Anh'], ['industryCode', 'Mã ngành'], ['industryName', 'Tên ngành'], ['sectorName', 'Nhóm ngành'], ['website', 'Website'], ['headquarters', 'Trụ sở'], ['listingStatus', 'Trạng thái niêm yết']].map(([key, label]) => ({ key, label })),
  { key: 'foundedDate', label: 'Ngày thành lập', type: 'date' }, { key: 'description', label: 'Mô tả', type: 'textarea' }, { key: 'active', label: 'Đang hoạt động', options: ['true', 'false'] },
];
export const securityFields: ScopeField[] = [
  { key: 'companyId', label: 'Công ty', required: true }, { key: 'symbol', label: 'Mã chứng khoán', required: true },
  { key: 'exchange', label: 'Sàn', options: exchanges, required: true }, { key: 'securityType', label: 'Loại chứng khoán', options: securityTypes, required: true },
  { key: 'isin', label: 'ISIN' }, { key: 'currency', label: 'Tiền tệ', required: true },
  { key: 'listedDate', label: 'Ngày niêm yết', type: 'date' }, { key: 'delistedDate', label: 'Ngày hủy niêm yết', type: 'date' },
  { key: 'sharesOutstanding', label: 'Số cổ phiếu lưu hành', type: 'text' }, { key: 'parValue', label: 'Mệnh giá', type: 'text' },
  { key: 'primary', label: 'Mã chính', options: ['true', 'false'] }, { key: 'active', label: 'Đang hoạt động', options: ['true', 'false'] },
];
export const aliasFields: ScopeField[] = [{ key: 'alias', label: 'Tên gọi khác', required: true }, { key: 'aliasType', label: 'Loại tên gọi', options: aliasTypes, required: true }];
export function scopeRequest(kind: 'company' | 'security' | 'alias', values: Record<string, string>, companies: Company[] = []) {
  const errors: Record<string, string> = {};
  const fields = kind === 'company' ? companyFields : kind === 'security' ? securityFields : aliasFields;
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key]?.trim() ?? '';
    if (field.required && !value) errors[field.key] = 'Trường này bắt buộc.';
    if (field.options && !field.options.includes(value)) errors[field.key] = 'Chọn giá trị được hỗ trợ.';
    if (field.type === 'date' && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) errors[field.key] = 'Nhập ngày hợp lệ.';
    body[field.key] = ['active', 'primary'].includes(field.key) ? value === 'true' : value || null;
  }
  if (kind === 'company') {
    body.companyCode = values.companyCode?.trim().toUpperCase() ?? '';
    if (values.website?.trim()) { try { const url = new URL(values.website); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(); } catch { errors.website = 'Nhập URL HTTP(S) không kèm thông tin đăng nhập.'; } }
  }
  if (kind === 'security') {
    if (!companies.some(c => c.id === values.companyId)) errors.companyId = 'Chọn một công ty có trong danh sách.';
    body.symbol = values.symbol?.trim().toUpperCase() ?? '';
    body.currency = values.currency?.trim().toUpperCase() ?? '';
    if (values.currency && !/^[A-Z]{3}$/.test(String(body.currency))) errors.currency = 'Dùng mã tiền tệ 3 chữ cái.';
    for (const key of ['sharesOutstanding', 'parValue']) {
      const value = values[key]?.trim(); const number = Number(value);
      if (value && (!/^-?\d+(\.\d+)?$/.test(value) || !Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER || value.replace(/[^\d]/g, '').replace(/^0+/, '').length > 15)) errors[key] = 'Nhập số thập phân tối đa 15 chữ số có nghĩa.';
      body[key] = value ? number : null;
    }
  }
  if (kind === 'alias') body.aliasType = values.aliasType;
  return { errors, body: body as unknown as CompanyRequest | SecurityRequest | CompanyAliasRequest };
}
