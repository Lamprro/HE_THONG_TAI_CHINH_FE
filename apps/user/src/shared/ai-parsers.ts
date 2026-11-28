export type EvidenceItem = {
  quote: string;
};

export type AnalysisSection = {
  type: string;
  heading: string;
  content: string;
  evidence?: EvidenceItem[];
};

export type CompanyImpact = {
  symbol?: string;
  direction: string;
  rationale: string;
  confidence?: string;
};

function cleanAiText(value: string) {
  return value
    .replace(/\b(?:[a-z][a-z0-9_-]*:\s*)?[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/gi, 'dữ liệu nguồn')
    .replace(/\b(?:FSI|PRICE|METRIC|MACRO):\s*\d+\b/gi, 'dữ liệu nguồn')
    .replace(/dữ liệu nguồn(?:(?:,\s*|\s+(?:và|and)\s+)dữ liệu nguồn)+/g, 'dữ liệu nguồn');
}

export type FinancialFact = {
  metric_name: string;
  value_text: string;
  unit?: string | null;
  period?: string | null;
  fact_kind?: string;
  attributed_to?: string | null;
  evidence?: EvidenceItem[];
};

export type ParsedNewsAiData = {
  status?: string;
  overview?: string;
  overview_evidence?: EvidenceItem[];
  sections?: AnalysisSection[];
  document_types?: string[];
  contains_financial_figures?: boolean;
  contains_forecasts?: boolean;
  company_impacts?: CompanyImpact[];
  facts?: FinancialFact[];
  limitations?: string;
};

export function parseAiData(raw: unknown): ParsedNewsAiData {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return parseAiData(JSON.parse(raw));
    } catch {
      return { overview: cleanAiText(raw) };
    }
  }
  if (typeof raw === 'object') {
    return JSON.parse(JSON.stringify(raw), (key, value) => {
      if (/(?:^|_)(?:id|ids|uuid|uuids)$/i.test(key.replace(/([a-z0-9])([A-Z])/g, '$1_$2'))) return undefined;
      return typeof value === 'string' ? cleanAiText(value) : value;
    }) as ParsedNewsAiData;
  }
  return {};
}

export type ScenarioDetail = {
  growth_percent: number | string;
  rationale: string;
};

export type ScenarioMetric = {
  metric_code: string;
  bear: ScenarioDetail;
  base: ScenarioDetail;
  bull: ScenarioDetail;
};

export type CalculatedScenario = {
  metric_code: string;
  unit?: string;
  base_value?: number | string;
  bear?: number | string;
  base?: number | string;
  bull?: number | string;
};

export type ParsedScenarioData = {
  overview?: string;
  horizon_period?: string;
  scenarios?: ScenarioMetric[];
  limitations?: string[];
  calculatedValues?: CalculatedScenario[];
};

export function parseScenarioData(raw: unknown): ParsedScenarioData {
  if (typeof raw === 'string') {
    try {
      return parseScenarioData(JSON.parse(raw));
    } catch {
      return { overview: cleanAiText(raw) };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  const warnings = Array.isArray(row.limitations) ? row.limitations : [row.limitations];
  const limitations = warnings.filter((item): item is string => typeof item === 'string' && !!item.trim())
    .map(item => {
      const value = cleanAiText(item.trim());
      if (value.startsWith('Report scope UNKNOWN')) return 'Chưa xác định báo cáo là hợp nhất hay riêng lẻ.';
      if (value.startsWith('Profit period values are provider-reported')) return 'Chưa xác minh lợi nhuận là số riêng quý hay lũy kế.';
      if (value.startsWith('Stock price scenario uses unadjusted nominal')) return 'Kịch bản dùng giá đóng cửa chưa điều chỉnh, không dự phóng cổ tức và các sự kiện doanh nghiệp.';
      if (value.startsWith('Statements use current canonical data')) return 'Một số báo cáo thiếu ngày công bố. Hệ thống dùng mốc thời gian ước tính nên dữ liệu này không phù hợp để kiểm thử hồi cứu theo thời điểm.';
      return value;
    });
  const scenarios = Array.isArray(row.forecasts) ? row.forecasts : row.scenarios;
  return {
    overview: typeof row.overview === 'string' ? cleanAiText(row.overview) : undefined,
    horizon_period: typeof row.horizon_period === 'string' ? row.horizon_period : undefined,
    scenarios: Array.isArray(scenarios) ? scenarios.filter(item =>
      item && typeof item.metric_code === 'string' && ['bear', 'base', 'bull'].every(key => {
        const value = item[key]?.growth_percent;
        return typeof value === 'number' && Number.isFinite(value) ||
          typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value);
      })).map(item => ({
        metric_code: item.metric_code,
        bear: { growth_percent: item.bear.growth_percent, rationale: cleanAiText(String(item.bear.rationale ?? '')) },
        base: { growth_percent: item.base.growth_percent, rationale: cleanAiText(String(item.base.rationale ?? '')) },
        bull: { growth_percent: item.bull.growth_percent, rationale: cleanAiText(String(item.bull.rationale ?? '')) },
      })) : [],
    calculatedValues: Array.isArray(row.calculated_values) ? row.calculated_values : [],
    limitations: [...new Set(limitations)],
  };
}
