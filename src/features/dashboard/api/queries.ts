import { useQuery } from '@tanstack/react-query';
import { getHealth, getJson, API_BASE } from '../../../shared/api/client';
import type { JavaHealth, DataSource, IngestionJob, IngestionRun, RawPayload, ValidationResult, DataVersion } from '../types/dto';
import type { ValidationRule } from '../../operations/contracts';
export type DashboardSection = 'overview' | 'jobs' | 'runs' | 'quality' | 'other';
export function useDashboardQueries(section: DashboardSection) {
  const javaHealth = useQuery({ queryKey: ['java-health'], queryFn: () => getHealth<JavaHealth>(API_BASE, '/api/health'), refetchInterval: 45000 });
  const jobs = useQuery({ queryKey: ['jobs'], queryFn: () => getJson<IngestionJob[]>(API_BASE, '/api/ingestion-jobs?activeOnly=false'), enabled: ['overview', 'jobs', 'runs'].includes(section), staleTime: 5 * 60000, refetchInterval: 5 * 60000 });
  const sources = useQuery({ queryKey: ['sources'], queryFn: () => getJson<DataSource[]>(API_BASE, '/api/data-sources'), enabled: ['overview', 'jobs', 'runs'].includes(section), staleTime: 5 * 60000, refetchInterval: 5 * 60000 });
  // Jobs also loads the 20-run sample so job/source drawers can link related runs.
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => getJson<IngestionRun[]>(API_BASE, '/api/ingestions?limit=20'), enabled: ['overview', 'runs', 'jobs'].includes(section), refetchInterval: 45000 });
  const openIssues = useQuery({ queryKey: ['open-issues'], queryFn: () => getJson<ValidationResult[]>(API_BASE, '/api/admin/validation/results/open?limit=50'), enabled: ['overview', 'quality'].includes(section), refetchInterval: 90000 });
  const results = useQuery({ queryKey: ['results'], queryFn: () => getJson<ValidationResult[]>(API_BASE, '/api/admin/validation/results?limit=50'), enabled: section === 'quality', refetchInterval: 120000 });
  const versions = useQuery({ queryKey: ['versions'], queryFn: () => getJson<DataVersion[]>(API_BASE, '/api/admin/validation/data-versions?limit=50'), enabled: section === 'quality', staleTime: 2 * 60000, refetchInterval: 3 * 60000 });
  const rules = useQuery({ queryKey: ['rules'], queryFn: () => getJson<ValidationRule[]>(API_BASE, '/api/admin/validation/rules'), enabled: section === 'quality', staleTime: 5 * 60000 });
  return { javaHealth, jobs, sources, runs, openIssues, results, versions, rules };
}
export function useRunDetail(id: string | null) {
  const run = useQuery({ queryKey: ['run', id], queryFn: () => getJson<IngestionRun>(API_BASE, `/api/ingestions/${encodeURIComponent(id!)}`), enabled: !!id });
  const payloads = useQuery({ queryKey: ['payloads', id], queryFn: () => getJson<RawPayload[]>(API_BASE, `/api/raw-payloads?runId=${encodeURIComponent(id!)}&includeBody=false`), enabled: !!id });
  return { run, payloads };
}

// Records linked to one run/payload come from the exact-filter data browser, not from the "latest 50" samples,
// so older runs still show their own validation results and versions. Rows are snake_case and mapped to the DTOs.
export const LINKED_LIMIT = 100;
type Row = Record<string, unknown>;
const camel = (row: Row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase()), value]));
async function linked(table: string, filters: Record<string, string | null | undefined>) {
  const query = new URLSearchParams({ size: String(LINKED_LIMIT) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return (await getJson<{ rows?: Row[] }>(API_BASE, `/api/admin/console/data/${table}?${query}`)).rows ?? [];
}
export function useLinkedValidation(runId?: string | null, rawId?: string | null) {
  return useQuery({ queryKey: ['linked-validation', runId ?? null, rawId ?? null], enabled: !!(runId || rawId),
    queryFn: async () => (await linked('validation_results', { runId, raw_payload_id: rawId }))
      .map(row => ({ ...camel(row), status: row.result_status, validationRuleId: Number(row.validation_rule_id) }) as unknown as ValidationResult) });
}
export function useLinkedVersions(runId?: string | null) {
  return useQuery({ queryKey: ['linked-versions', runId ?? null], enabled: !!runId,
    queryFn: async () => (await linked('data_versions', { runId }))
      .map(row => ({ ...camel(row), rowCount: row.row_count == null ? null : Number(row.row_count) }) as unknown as DataVersion) });
}
