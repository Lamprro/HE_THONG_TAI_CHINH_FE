import { useState } from 'react';
import { Bot, BookOpen, X, TrendingUp, TrendingDown, Target, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { date, text } from '../shared/format';
import {
  parseScenarioData,
  type ScenarioDetail,
  type ScenarioMetric,
  type ParsedScenarioData,
} from '../shared/ai-parsers';

export {
  parseScenarioData,
  type ScenarioDetail,
  type ScenarioMetric,
  type ParsedScenarioData,
};

const metricNames: Record<string, string> = {
  NET_PROFIT_AFTER_TAX: 'Lợi nhuận sau thuế (NPAT)',
  PRETAX_PROFIT: 'Lợi nhuận trước thuế (EBT)',
  TOTAL_ASSETS: 'Tổng tài sản',
  OWNERS_EQUITY: 'Vốn chủ sở hữu',
  LIABILITIES: 'Nợ phải trả',
  STOCK_PRICE: 'Giá cổ phiếu',
};

export function FinancialScenarioModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const symbol = text(row.symbol, '');
  const exchange = text(row.exchange, '');
  const quality = text(row.qualityStatus, 'VALID');
  const targetScope = text(row.targetScope, 'CONSOLIDATED');
  const data = parseScenarioData(row.data);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog large ai-analysis-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết kịch bản tài chính AI"
        onClick={e => e.stopPropagation()}
      >
        <div className="ai-modal-header">
          <div className="header-meta">
            <span className="ai-brand-tag"><Bot size={15} /> Kịch bản tài chính AI</span>
            <span className="task-pill">{symbol} · {exchange}</span>
            <span className="task-pill scope">{targetScope === 'CONSOLIDATED' ? 'Hợp nhất' : 'Riêng lẻ'}</span>
            <span className={`quality-chip ${quality === 'VALID' ? 'valid' : 'warning'}`}>
              <ShieldCheck size={13} /> {quality === 'VALID' ? 'Đã kiểm định (VALID)' : quality}
            </span>
          </div>
          <button className="icon-button close-button" onClick={onClose} aria-label="Đóng popup">
            <X size={18} />
          </button>
        </div>

        <h2 className="ai-modal-title">Dự phóng kịch bản tài chính cho {symbol} ({data.horizon_period || 'Kỳ tới'})</h2>

        <div className="ai-modal-body">
          {data.overview && (
            <div className="ai-overview-box">
              <div className="overview-title">
                <Sparkles size={16} />
                <strong>Tổng quan kịch bản</strong>
              </div>
              <p className="overview-content">{data.overview}</p>
            </div>
          )}

          {data.scenarios && data.scenarios.length > 0 && (
            <div className="scenarios-matrix">
              {data.scenarios.map((sc, idx) => (
                <div key={idx} className="metric-scenario-group">
                  <h3 className="metric-title">{metricNames[sc.metric_code] || sc.metric_code}</h3>
                  <div className="three-scenarios-grid">
                    {/* Bear */}
                    <div className="scenario-col bear">
                      <div className="scenario-col-header">
                        <TrendingDown size={14} />
                        <strong>Thận trọng (Bear)</strong>
                        <span className="growth-tag negative">
                          {sc.bear.growth_percent > 0 ? '+' : ''}{sc.bear.growth_percent}%
                        </span>
                      </div>
                      <p className="scenario-rationale">{sc.bear.rationale}</p>
                    </div>

                    {/* Base */}
                    <div className="scenario-col base">
                      <div className="scenario-col-header">
                        <Target size={14} />
                        <strong>Cơ sở (Base)</strong>
                        <span className="growth-tag neutral">
                          {sc.base.growth_percent > 0 ? '+' : ''}{sc.base.growth_percent}%
                        </span>
                      </div>
                      <p className="scenario-rationale">{sc.base.rationale}</p>
                    </div>

                    {/* Bull */}
                    <div className="scenario-col bull">
                      <div className="scenario-col-header">
                        <TrendingUp size={14} />
                        <strong>Khả quan (Bull)</strong>
                        <span className="growth-tag positive">
                          {sc.bull.growth_percent > 0 ? '+' : ''}{sc.bull.growth_percent}%
                        </span>
                      </div>
                      <p className="scenario-rationale">{sc.bull.rationale}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.limitations && (
            <div className="ai-limitations-card">
              <AlertCircle size={15} />
              <span><strong>Giới hạn:</strong> {data.limitations}</span>
            </div>
          )}

          <div className="ai-modal-footer">
            <small className="ai-disclaimer">
              Kịch bản AI được xây dựng trên dữ liệu báo cáo tài chính và tin tức đã kiểm định. Đây không phải khuyến nghị đầu tư hay cam kết lợi nhuận.
            </small>
            <button type="button" className="primary" onClick={onClose}>
              Đóng cửa sổ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FinancialScenarioCard({ row }: { row: Record<string, unknown> }) {
  const [showModal, setShowModal] = useState(false);
  const symbol = text(row.symbol, '');
  const asOf = text(row.asOfDate, '');
  const pStart = text(row.forecastPeriodStart, '');
  const pEnd = text(row.forecastPeriodEnd, '');
  const quality = text(row.qualityStatus, 'VALID');
  const data = parseScenarioData(row.data);

  const scenarioCount = data.scenarios?.length || 0;

  return (
    <>
      <article className="scenario-card-styled">
        <div className="scenario-card-header">
          <div className="header-meta">
            <span className="badge-horizon">Kỳ {pStart || '—'} → {pEnd || '—'}</span>
            <span className={`quality-badge ${quality === 'VALID' ? 'valid' : 'warning'}`}>
              {quality === 'VALID' ? 'Đã kiểm định' : quality}
            </span>
          </div>
          {asOf && <small className="as-of-text">Dữ liệu đến {date(asOf)}</small>}
        </div>

        {data.overview && <p className="scenario-overview-text">{data.overview}</p>}

        {data.scenarios && data.scenarios.length > 0 && (
          <div className="metrics-summary-list">
            {data.scenarios.map((sc, i) => (
              <div key={i} className="metric-pill-row">
                <span className="metric-name">{metricNames[sc.metric_code] || sc.metric_code}:</span>
                <span className="scenario-mini-stats">
                  <span className="bear-pill" title="Thận trọng">{sc.bear.growth_percent > 0 ? '+' : ''}{sc.bear.growth_percent}%</span>
                  <span className="base-pill" title="Cơ sở">{sc.base.growth_percent > 0 ? '+' : ''}{sc.base.growth_percent}%</span>
                  <span className="bull-pill" title="Khả quan">{sc.bull.growth_percent > 0 ? '+' : ''}{sc.bull.growth_percent}%</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="scenario-card-action">
          <button
            type="button"
            className="open-analysis-btn"
            onClick={() => setShowModal(true)}
            title="Mở toàn văn kịch bản tài chính 3 kịch bản Bear/Base/Bull"
          >
            <BookOpen size={14} />
            <span>Xem chi tiết 3 kịch bản ({scenarioCount} chỉ tiêu)</span>
          </button>
        </div>
      </article>

      {showModal && (
        <FinancialScenarioModal row={row} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
