import { useEffect, useId, useRef, useState } from 'react';
import { Bot, BookOpen, X, TrendingUp, TrendingDown, Target, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { date, decimal, text } from '../shared/format';
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

const scenarios = [
  { key: 'bear', name: 'Thận trọng', Icon: TrendingDown },
  { key: 'base', name: 'Cơ sở', Icon: Target },
  { key: 'bull', name: 'Khả quan', Icon: TrendingUp },
] as const;

function scopeLabel(value: unknown) {
  if (value === 'CONSOLIDATED') return 'Hợp nhất';
  if (value === 'SEPARATE') return 'Riêng lẻ';
  return null;
}

function growthLabel(value: number | string) {
  return (Number(value) > 0 ? '+' : '') + decimal(value) + '%';
}

export function FinancialScenarioModal({
  row,
  onClose,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const symbol = text(row.symbol, '');
  const exchange = text(row.exchange, '');
  const quality = text(row.qualityStatus);
  const scope = scopeLabel(row.targetScope);
  const data = parseScenarioData(row.data);
  const period = row.forecastPeriodStart && row.forecastPeriodEnd
    ? date(String(row.forecastPeriodStart)) + ' – ' + date(String(row.forecastPeriodEnd))
    : data.horizon_period;
  const titleId = useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog large ai-analysis-dialog financial-scenario-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        onKeyDown={event => { if (event.key === 'Escape') onClose(); }}
      >
        <div className="ai-modal-header">
          <div><div className="header-meta">
            <span className="task-pill">{symbol} · {exchange}</span>
            {scope && <span className="task-pill scope">{scope}</span>}
            <span className={`quality-chip ${quality === 'VALID' ? 'valid' : 'warning'}`}>
              <ShieldCheck size={13} /> {quality === 'VALID' ? 'Đạt kiểm tra dữ liệu' : quality === 'WARNING' ? 'Có cảnh báo' : quality}
            </span>
          </div>
          <h2 id={titleId}><Bot size={19} aria-hidden="true"/> Kịch bản tài chính</h2>
          {period && <p className="muted">Kỳ dự báo {period}</p>}</div>
          <button ref={closeButton} className="icon-button close-button" onClick={onClose} aria-label="Đóng popup">
            <X size={18} />
          </button>
        </div>

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
              {data.scenarios.map(sc => {
                const calculated = data.calculatedValues?.find(value => value.metric_code === sc.metric_code);
                const unit = calculated?.unit === 'VND_PER_SHARE' ? 'VND/cổ phiếu' : calculated?.unit;
                return <article key={sc.metric_code} className="metric-scenario-group">
                  <div className="metric-scenario-heading">
                    <h3>{metricNames[sc.metric_code] || sc.metric_code}</h3>
                    {calculated?.base_value != null && <div><span>Giá trị gốc</span>
                      <strong>{decimal(calculated.base_value)} {unit}</strong></div>}
                  </div>
                  <div className="three-scenarios-grid">
                    {scenarios.map(({ key, name, Icon }) => <section key={key} className={'scenario-col ' + key}>
                      <div className="scenario-col-header">
                        <h4><Icon size={16} aria-hidden="true"/>{name}</h4>
                        <span className="scenario-growth">{growthLabel(sc[key].growth_percent)}</span>
                      </div>
                      {calculated?.[key] != null && <div className="scenario-value">
                        <strong>{decimal(calculated[key])}</strong>{unit && <small>{unit}</small>}
                      </div>}
                      {sc[key].rationale && <details><summary>Giải thích</summary>
                        <p className="scenario-rationale">{sc[key].rationale}</p>
                      </details>}
                    </section>)}
                  </div>
                </article>;
              })}
            </div>
          )}

          {!!data.limitations?.length && (
            <div className="ai-limitations-card">
              <AlertCircle size={15} />
              <div><strong>Giới hạn dữ liệu</strong><ul>{data.limitations.map(item => <li key={item}>{item}</li>)}</ul></div>
            </div>
          )}

        </div>
        <div className="ai-modal-footer">
            <small className="ai-disclaimer">
              Các giá trị là kịch bản tham khảo và chưa được kiểm chứng về độ chính xác dự báo.
            </small>
            <button type="button" className="primary" onClick={onClose}>
              Đóng cửa sổ
            </button>
        </div>
      </div>
    </div>
  );
}

export function FinancialScenarioCard({ row }: { row: Record<string, unknown> }) {
  const [showModal, setShowModal] = useState(false);
  const asOf = text(row.asOfDate, '');
  const pStart = text(row.forecastPeriodStart, '');
  const pEnd = text(row.forecastPeriodEnd, '');
  const quality = text(row.qualityStatus);
  const data = parseScenarioData(row.data);

  const scenarioCount = data.scenarios?.length || 0;

  return (
    <>
      <article className="scenario-card-styled">
        <div className="scenario-card-header">
          <div className="header-meta">
            <span className="badge-horizon">Kỳ {pStart || '—'} → {pEnd || '—'}</span>
            <span className={`quality-badge ${quality === 'VALID' ? 'valid' : 'warning'}`}>
              {quality === 'VALID' ? 'Đạt kiểm tra dữ liệu' : quality === 'WARNING' ? 'Có cảnh báo' : quality}
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
                  <span className="bear-pill" title="Thận trọng">{growthLabel(sc.bear.growth_percent)}</span>
                  <span className="base-pill" title="Cơ sở">{growthLabel(sc.base.growth_percent)}</span>
                  <span className="bull-pill" title="Khả quan">{growthLabel(sc.bull.growth_percent)}</span>
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
            <span>{scenarioCount ? 'Xem 3 kịch bản (' + scenarioCount + ' chỉ tiêu)' : 'Xem chi tiết dự báo'}</span>
          </button>
        </div>
      </article>

      {showModal && (
        <FinancialScenarioModal row={row} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
