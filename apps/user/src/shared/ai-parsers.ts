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
  growth_percent: number;
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

export type ParsedScenarioData = {
  overview?: string;
  horizon_period?: string;
  scenarios?: ScenarioMetric[];
  limitations?: string;
};

export function parseScenarioData(raw: unknown): ParsedScenarioData {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as ParsedScenarioData;
    } catch {
      return { overview: raw };
    }
  }
  if (typeof raw === 'object') {
    return raw as ParsedScenarioData;
  }
  return {};
}
