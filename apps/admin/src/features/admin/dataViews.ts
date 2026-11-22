import { useQuery } from '@tanstack/react-query';
import { API_BASE, getJson } from '../../shared/api/client';
import type { IngestionJob } from '../dashboard/types/dto';
import type { Row } from './Records';

export type DataSelection = { table: string; exact?: Record<string, string> };

export const dataLabels: Record<string, string> = {
  market_prices: 'Giá cổ phiếu',
  index_prices: 'Giá chỉ số',
  financial_statements: 'Báo cáo tài chính',
  financial_statement_items: 'Chỉ tiêu báo cáo',
  financial_periods: 'Kỳ báo cáo',
  financial_metrics: 'Chỉ số tài chính',
  metric_definitions: 'Danh mục chỉ số',
  market_indices: 'Danh mục chỉ số thị trường',
  security_index_memberships: 'Thành phần rổ chỉ số',
  macro_series: 'Chuỗi vĩ mô',
  macro_observations: 'Số liệu vĩ mô',
  security_foreign_observations: 'Giao dịch khối ngoại',
  security_reference_observations: 'Thông tin chứng khoán',
  news_articles: 'Tin tức',
  ingestion_runs: 'Lượt chạy job',
  raw_payloads: 'Dữ liệu nguồn (raw)',
  validation_results: 'Kết quả kiểm tra',
  validation_rules: 'Luật kiểm tra',
  data_versions: 'Phiên bản dữ liệu',
  admin_commands: 'Tác vụ nền',
  llm_runs: 'Lượt chạy LLM',
  llm_run_attempts: 'Lần gọi LLM',
  llm_validation_rounds: 'Kiểm tra đầu ra LLM',
  llm_results: 'Kết quả LLM',
  llm_prompt_templates: 'Mẫu prompt',
};

const markets = ['market_prices', 'index_prices', 'financial_statements', 'financial_statement_items',
  'financial_metrics', 'security_index_memberships', 'macro_observations',
  'security_foreign_observations', 'security_reference_observations', 'news_articles'];
export const isOutputTable = (table: string) => markets.includes(table);

const outputTables: Record<string, string> = {
  MARKET_PRICE: 'market_prices',
  MARKET_INDEX: 'index_prices',
  INDEX_PRICE: 'index_prices',
  FINANCIAL_STATEMENT: 'financial_statements',
  FINANCIAL_METRIC: 'financial_metrics',
  MACRO: 'macro_observations',
  MARKET_FOREIGN: 'security_foreign_observations',
  SECURITY_REFERENCE: 'security_reference_observations',
};

export function versionOutput(id: string, domain: string | null, status: string | null, operation?: string): DataSelection | undefined {
  if (!['ACTIVATED', 'SUPERSEDED', 'ARCHIVED'].includes(status ?? '')) return;
  if (domain === 'MARKET_INDEX' && operation === 'INDEX_MEMBERS') return { table: 'security_index_memberships' };
  const table = domain ? outputTables[domain] : undefined;
  if (!table) return;
  return { table, exact: { data_version_id: id } };
}

export const statusLabels: Record<string, string> = {
  PENDING: 'Chờ chạy', RUNNING: 'Đang chạy', SUCCESS: 'Thành công', PARTIAL_SUCCESS: 'Thành công một phần',
  FAILED: 'Thất bại', CANCELLED: 'Đã hủy', QUEUED: 'Trong hàng đợi', SUCCEEDED: 'Hoàn tất', UNKNOWN: 'Chưa rõ kết quả',
  PASS: 'Đạt', FAIL: 'Không đạt', SKIP: 'Bỏ qua', ACKNOWLEDGED: 'Đã ghi nhận', DRAFT: 'Bản nháp', VALIDATING: 'Đang kiểm tra',
  PENDING_REVIEW: 'Chờ duyệt', ACTIVE: 'Chờ ghi', ACTIVATED: 'Đã ghi', SUPERSEDED: 'Đã thay thế',
  REJECTED: 'Từ chối', ARCHIVED: 'Lưu trữ',
};
export const runStatuses = ['PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED'];
export const tableStatuses: Record<string, string[]> = {
  ingestion_runs: runStatuses,
  admin_commands: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN', 'ACKNOWLEDGED'],
  validation_results: ['PASS', 'FAIL', 'SKIP'],
  data_versions: ['DRAFT', 'VALIDATING', 'PENDING_REVIEW', 'ACTIVE', 'ACTIVATED', 'SUPERSEDED', 'REJECTED', 'ARCHIVED'],
  llm_runs: ['RUNNING', 'PENDING_VALIDATION', 'SUCCESS', 'PARTIAL_SUCCESS', 'REJECTED', 'FAILED', 'CANCELLED'],
};

export const jobStage = (job: IngestionJob) => {
  const code = job.code.toUpperCase();
  return code.endsWith('_BUILD') || code === 'NEWS_DATA_FETCH' ? 'processing' : 'source';
};

export function useAdminRows(table: string, page: number, filter: string, options: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: ['admin-rows', table, page, filter],
    queryFn: () => getJson<{ rows: Row[]; total: number }>(API_BASE,
      `/api/admin/console/data/${table}?page=${page}&size=25${filter ? `&${filter}` : ''}`),
    enabled: options.enabled, refetchInterval: options.refetchInterval,
  });
}
