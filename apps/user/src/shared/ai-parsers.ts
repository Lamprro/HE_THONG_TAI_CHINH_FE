export type EvidenceItem = {
  segment_id?: string;
  quote: string;
};

export type AnalysisSection = {
  type: string;
  heading: string;
  content: string;
  evidence?: EvidenceItem[];
};

export type CompanyImpact = {
  company_id?: string;
  symbol?: string;
  direction: string;
  rationale: string;
  confidence?: string;
};

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
      return JSON.parse(raw) as ParsedNewsAiData;
    } catch {
      return { overview: raw };
    }
  }
  if (typeof raw === 'object') {
    return raw as ParsedNewsAiData;
  }
  return {};
}

export type ScenarioDetail = {
  growth_percent: number | string;
  rationale: string;
  evidence_ids?: string[];
};

export type ScenarioMetric = {
  metric_code: string;
  base_point_id?: string;
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
      return { overview: raw };
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  const warnings = Array.isArray(row.limitations) ? row.limitations : [row.limitations];
  const limitations = warnings.filter((item): item is string => typeof item === 'string' && !!item.trim())
    .map(item => {
      const value = item.trim();
      if (value.startsWith('Report scope UNKNOWN')) return 'Chưa xác định báo cáo là hợp nhất hay riêng lẻ.';
      if (value.startsWith('Profit period values are provider-reported')) return 'Chưa xác minh lợi nhuận là số riêng quý hay lũy kế.';
      if (value.startsWith('Stock price scenario uses unadjusted nominal')) return 'Kịch bản dùng giá đóng cửa chưa điều chỉnh, không dự phóng cổ tức và các sự kiện doanh nghiệp.';
      if (value.startsWith('Statements use current canonical data')) return 'Một số báo cáo thiếu ngày công bố. Hệ thống dùng mốc thời gian ước tính nên dữ liệu này không phù hợp để kiểm thử hồi cứu theo thời điểm.';
      return value;
    });
  const scenarios = Array.isArray(row.forecasts) ? row.forecasts : row.scenarios;
  return {
    overview: typeof row.overview === 'string' ? row.overview : undefined,
    horizon_period: typeof row.horizon_period === 'string' ? row.horizon_period : undefined,
    scenarios: Array.isArray(scenarios) ? scenarios.filter(item =>
      item && typeof item.metric_code === 'string' && ['bear', 'base', 'bull'].every(key => {
        const value = item[key]?.growth_percent;
        return typeof value === 'number' && Number.isFinite(value) ||
          typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value);
      })) : [],
    calculatedValues: Array.isArray(row.calculated_values) ? row.calculated_values : [],
    limitations: [...new Set(limitations)],
  };
}
