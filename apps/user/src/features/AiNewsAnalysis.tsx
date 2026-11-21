import { useState } from 'react';
import { Bot, BookOpen, X, CheckCircle2, AlertTriangle, ShieldCheck, Quote, Sparkles, Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { date, text } from '../shared/format';
import {
  parseAiData,
  type EvidenceItem,
  type AnalysisSection,
  type CompanyImpact,
  type FinancialFact,
  type ParsedNewsAiData,
} from '../shared/ai-parsers';

export {
  parseAiData,
  type EvidenceItem,
  type AnalysisSection,
  type CompanyImpact,
  type FinancialFact,
  type ParsedNewsAiData,
};

const taskLabels: Record<string, string> = {
  NEWS_SUMMARY: 'Tóm tắt & Sự kiện',
  NEWS_DETAIL: 'Phân tích tác động',
  NEWS_FINANCIAL_FACTS: 'Số liệu & Dự báo tài chính',
};

const sectionTypeConfig: Record<string, { label: string; className: string }> = {
  EVENT: { label: 'Sự kiện', className: 'type-event' },
  KEY_FACT: { label: 'Số liệu chính', className: 'type-fact' },
  RISK: { label: 'Rủi ro', className: 'type-risk' },
  OPPORTUNITY: { label: 'Cơ hội', className: 'type-opportunity' },
  CONTEXT: { label: 'Bối cảnh', className: 'type-context' },
  LIMITATION: { label: 'Giới hạn', className: 'type-limitation' },
};

function SectionBadge({ type }: { type: string }) {
  const conf = sectionTypeConfig[type] || { label: type, className: 'type-default' };
  return <span className={`ai-section-badge ${conf.className}`}>{conf.label}</span>;
}

function DirectionBadge({ direction }: { direction: string }) {
  if (direction === 'POSITIVE') {
    return <span className="direction-badge positive"><TrendingUp size={13} /> Tích cực</span>;
  }
  if (direction === 'NEGATIVE') {
    return <span className="direction-badge negative"><TrendingDown size={13} /> Tiêu cực</span>;
  }
  return <span className="direction-badge neutral"><Minus size={13} /> Trung lập</span>;
}

export function AiNewsAnalysisModal({
  row,
  articleTitle,
  onClose,
}: {
  row: Record<string, unknown>;
  articleTitle?: string;
  onClose: () => void;
}) {
  const task = text(row.task, 'NEWS_SUMMARY');
  const quality = text(row.qualityStatus, 'VALID');
  const createdAt = typeof row.createdAt === 'string' ? row.createdAt : undefined;
  const data = parseAiData(row.data);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog large ai-analysis-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Toàn văn phân tích tin tức AI"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="ai-modal-header">
          <div className="header-meta">
            <span className="ai-brand-tag">
              <Bot size={15} /> AI Analyst
            </span>
            <span className="task-pill">{taskLabels[task] || task}</span>
            <span className={`quality-chip ${quality === 'VALID' ? 'valid' : 'warning'}`}>
              <ShieldCheck size={13} /> {quality === 'VALID' ? 'Đã kiểm định (VALID)' : quality}
            </span>
            {createdAt && <time className="timestamp">{date(createdAt)}</time>}
          </div>
          <button className="icon-button close-button" onClick={onClose} aria-label="Đóng popup">
            <X size={18} />
          </button>
        </div>

        {articleTitle && <h2 className="ai-modal-title">{articleTitle}</h2>}

        <div className="ai-modal-body">
          {/* Overview Section */}
          {data.overview && (
            <div className="ai-overview-box">
              <div className="overview-title">
                <Sparkles size={16} />
                <strong>Tóm tắt tổng quan bài viết</strong>
              </div>
              <p className="overview-content">{data.overview}</p>
              {data.overview_evidence && data.overview_evidence.length > 0 && (
                <div className="evidence-list">
                  {data.overview_evidence.map((ev, i) => (
                    <blockquote key={i} className="quote-box">
                      <Quote size={13} className="quote-icon" />
                      <span>{ev.quote}</span>
                      {ev.segment_id && <small className="segment-tag">[{ev.segment_id}]</small>}
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sections Breakdown */}
          {data.sections && data.sections.length > 0 && (
            <div className="ai-sections-container">
              <h3 className="section-group-title">Nội dung chi tiết theo đề mục ({data.sections.length} mục)</h3>
              <div className="sections-list">
                {data.sections.map((sec, idx) => (
                  <article key={idx} className="ai-section-card">
                    <div className="section-header">
                      <div className="section-index">{idx + 1}</div>
                      <h4 className="section-heading">{sec.heading}</h4>
                      <SectionBadge type={sec.type} />
                    </div>
                    <p className="section-body">{sec.content}</p>
                    {sec.evidence && sec.evidence.length > 0 && (
                      <div className="evidence-list">
                        {sec.evidence.map((ev, evIdx) => (
                          <blockquote key={evIdx} className="quote-box">
                            <Quote size={13} className="quote-icon" />
                            <span>{ev.quote}</span>
                            {ev.segment_id && <small className="segment-tag">[{ev.segment_id}]</small>}
                          </blockquote>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Company Impacts (for NEWS_DETAIL) */}
          {data.company_impacts && data.company_impacts.length > 0 && (
            <div className="ai-impacts-container">
              <h3 className="section-group-title">Đánh giá tác động theo mã doanh nghiệp</h3>
              <div className="impacts-grid">
                {data.company_impacts.map((imp, idx) => (
                  <div key={idx} className="impact-card">
                    <div className="impact-header">
                      <div className="company-tag">
                        <Building2 size={15} />
                        <strong>{imp.symbol || 'Mã liên quan'}</strong>
                      </div>
                      <DirectionBadge direction={imp.direction} />
                      {imp.confidence && (
                        <span className="confidence-pill">Độ tin cậy: {imp.confidence}</span>
                      )}
                    </div>
                    <p className="impact-rationale">{imp.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financial Facts Table (for NEWS_FINANCIAL_FACTS) */}
          {data.facts && data.facts.length > 0 && (
            <div className="ai-facts-container">
              <h3 className="section-group-title">Số liệu & Kế hoạch tài chính trích xuất ({data.facts.length} chỉ tiêu)</h3>
              <div className="table-scroll">
                <table className="ai-facts-table">
                  <thead>
                    <tr>
                      <th>Chỉ tiêu</th>
                      <th className="number">Giá trị</th>
                      <th>Đơn vị</th>
                      <th>Kỳ</th>
                      <th>Loại số liệu</th>
                      <th>Phát ngôn từ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.facts.map((fact, idx) => (
                      <tr key={idx}>
                        <td><strong>{fact.metric_name}</strong></td>
                        <td className="number highlight-fact">{fact.value_text}</td>
                        <td>{fact.unit || '—'}</td>
                        <td>{fact.period || '—'}</td>
                        <td>
                          <span className={`fact-kind-tag ${fact.fact_kind?.toLowerCase() || ''}`}>
                            {fact.fact_kind === 'ACTUAL' ? 'Thực tế' : fact.fact_kind === 'FORECAST' ? 'Dự báo' : fact.fact_kind === 'TARGET' ? 'Mục tiêu' : fact.fact_kind || '—'}
                          </span>
                        </td>
                        <td>{fact.attributed_to || 'Nguồn bài'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Limitations and Disclaimer */}
          {data.limitations && (
            <div className="ai-limitations-card">
              <AlertTriangle size={15} />
              <span><strong>Giới hạn phân tích:</strong> {data.limitations}</span>
            </div>
          )}

          <div className="ai-modal-footer">
            <small className="ai-disclaimer">
              Thông tin phân tích tự động bởi mô hình AI dựa trên trích dẫn nguyên văn bài viết nguồn. Không cấu thành lời khuyên đầu tư tài chính.
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

export function AiNewsAnalysisCard({
  row,
  articleTitle,
}: {
  row: Record<string, unknown>;
  articleTitle?: string;
}) {
  const [showModal, setShowModal] = useState(false);
  const task = text(row.task, 'NEWS_SUMMARY');
  const quality = text(row.qualityStatus, 'VALID');
  const createdAt = typeof row.createdAt === 'string' ? row.createdAt : undefined;
  const data = parseAiData(row.data);

  const sectionsCount = data.sections?.length || 0;
  const previewSections = (data.sections || []).slice(0, 3);

  return (
    <>
      <article className="analysis-card ai-summary-card">
        {/* Card Header */}
        <div className="ai-card-header">
          <div className="task-info">
            <span className="task-badge">{taskLabels[task] || task}</span>
            <span className={`quality-badge ${quality === 'VALID' ? 'valid' : 'warning'}`}>
              {quality === 'VALID' ? 'Đã kiểm định' : quality}
            </span>
          </div>
          {createdAt && <time className="card-time">{date(createdAt)}</time>}
        </div>

        {/* Overview Box */}
        {data.overview ? (
          <div className="ai-card-overview">
            <p className="overview-text">{data.overview}</p>
          </div>
        ) : (
          <p className="muted">Bản phân tích không có phần tổng quan.</p>
        )}

        {/* Section Headings Preview */}
        {previewSections.length > 0 && (
          <div className="ai-card-sections-preview">
            <span className="preview-label">Đề mục phân tích ({sectionsCount} mục):</span>
            <ul className="preview-list">
              {previewSections.map((sec, i) => (
                <li key={i} className="preview-item">
                  <SectionBadge type={sec.type} />
                  <span className="heading-text">{sec.heading}</span>
                </li>
              ))}
              {sectionsCount > 3 && (
                <li className="preview-more">
                  <span>+{sectionsCount - 3} đề mục khác...</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Action Button: Opens Pop-up Modal */}
        <div className="ai-card-action">
          <button
            type="button"
            className="open-analysis-btn"
            onClick={() => setShowModal(true)}
            title="Mở toàn văn phân tích AI dạng đề mục dễ đọc"
          >
            <BookOpen size={15} />
            <span>Mở toàn văn phân tích AI ({sectionsCount} mục)</span>
          </button>
        </div>
      </article>

      {/* Pop-up Modal */}
      {showModal && (
        <AiNewsAnalysisModal
          row={row}
          articleTitle={articleTitle}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
