import { useState, useId, useMemo } from 'react';
import type { Observation, Series } from './Macro';
import {
  formatMacroPeriod,
  formatMacroValue,
  computeMacroStats,
  type MacroStats,
} from '../shared/macro-format';

export { formatMacroPeriod, formatMacroValue, computeMacroStats, type MacroStats };

export function MacroInteractiveChart({
  observations,
  series,
  height = 320,
}: {
  observations: Observation[];
  series: Series;
  height?: number;
}) {
  const gradientId = useId();
  const [mode, setMode] = useState<'bar' | 'area'>(() => {
    // Default to 'bar' for percentage YoY or discrete frequencies, 'area' for large continuous datasets
    return observations.length <= 60 ? 'bar' : 'area';
  });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const stats = useMemo(() => computeMacroStats(observations), [observations]);

  // Dimensions & Coordinates
  const width = 960;
  const marginLeft = 20;
  const marginRight = 100; // Dedicated Y-axis value column on the right
  const marginTop = 26;
  const marginBottom = 40;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;

  const { min, max, zeroY, ticks, getX, getY, barWidth } = useMemo(() => {
    if (!observations.length) {
      return { min: 0, max: 1, zeroY: null, ticks: [], getX: () => 0, getY: () => 0, barWidth: 10 };
    }
    const nums = observations.map(o => Number(o.value));
    const rawMin = Math.min(...nums);
    const rawMax = Math.max(...nums);
    const pad = (rawMax - rawMin) * 0.1 || Math.abs(rawMax) * 0.05 || 1;

    let computedMin = rawMin - pad;
    let computedMax = rawMax + pad;

    // Pin bottom to 0 if all values are strictly positive and close to zero
    if (rawMin >= 0 && rawMin <= pad * 2) {
      computedMin = 0;
    }
    // Ensure 0 is included if data crosses zero
    if (rawMin < 0 && rawMax > 0) {
      computedMin = Math.min(computedMin, 0);
      computedMax = Math.max(computedMax, 0);
    }

    const range = computedMax - computedMin || 1;
    const calcY = (val: number) => marginTop + ((computedMax - val) / range) * plotHeight;

    const zero = (computedMin <= 0 && computedMax >= 0) ? calcY(0) : null;

    // Y-axis value ticks (5 ticks evenly spaced)
    const tickList: number[] = [];
    for (let i = 0; i < 5; i++) {
      tickList.push(computedMin + (range * i) / 4);
    }

    const calcX = (i: number) => {
      if (observations.length <= 1) return marginLeft + plotWidth / 2;
      return marginLeft + (i / (observations.length - 1)) * plotWidth;
    };

    const bWidth = Math.max(3, Math.min(26, (plotWidth / Math.max(observations.length, 1)) * 0.72));

    return {
      min: computedMin,
      max: computedMax,
      zeroY: zero,
      ticks: tickList,
      getX: calcX,
      getY: calcY,
      barWidth: bWidth,
    };
  }, [observations, marginTop, plotWidth, plotHeight, marginLeft]);

  // X-axis label indices (5 to 7 distributed labels)
  const xLabelIndices = useMemo(() => {
    if (observations.length <= 6) {
      return observations.map((_, i) => i);
    }
    const step = Math.max(1, Math.floor(observations.length / 5));
    const indices: number[] = [];
    for (let i = 0; i < observations.length; i += step) {
      indices.push(i);
    }
    if (!indices.includes(observations.length - 1)) {
      indices.push(observations.length - 1);
    }
    return indices;
  }, [observations]);

  // Active observation: either hovered or latest
  const activeIndex = hoverIndex !== null ? hoverIndex : observations.length - 1;
  const activeObs = observations[activeIndex];
  const prevObs = activeIndex > 0 ? observations[activeIndex - 1] : undefined;
  const activeDelta = activeObs && prevObs && activeObs.value !== null && prevObs.value !== null
    ? Number(activeObs.value) - Number(prevObs.value)
    : null;

  // Paths for Line & Area mode
  const { linePath, areaPath } = useMemo(() => {
    if (!observations.length) return { linePath: '', areaPath: '' };
    const points = observations.map((o, i) => `${i ? 'L' : 'M'}${getX(i).toFixed(1)},${getY(Number(o.value)).toFixed(1)}`).join(' ');
    const baselineY = zeroY !== null ? zeroY : getY(min);
    const area = `${points} L${getX(observations.length - 1).toFixed(1)},${baselineY.toFixed(1)} L${getX(0).toFixed(1)},${baselineY.toFixed(1)} Z`;
    return { linePath: points, areaPath: area };
  }, [observations, getX, getY, zeroY, min]);

  // Pointer move handler
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!observations.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;

    if (mode === 'bar') {
      const colStep = plotWidth / observations.length;
      const idx = Math.floor((svgX - marginLeft) / colStep);
      setHoverIndex(Math.max(0, Math.min(observations.length - 1, idx)));
    } else {
      let closestIdx = 0;
      let minDistance = Infinity;
      for (let i = 0; i < observations.length; i++) {
        const dist = Math.abs(svgX - getX(i));
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }
      setHoverIndex(closestIdx);
    }
  };

  // Tooltip coordinates
  const activeX = activeObs ? (mode === 'bar'
    ? marginLeft + (activeIndex + 0.5) * (plotWidth / observations.length)
    : getX(activeIndex)) : 0;
  const activeY = activeObs ? getY(Number(activeObs.value)) : 0;

  // Tooltip box positioning inside SVG bounds
  const tooltipWidth = 180;
  const tooltipHeight = 72;
  const tooltipX = Math.max(marginLeft, Math.min(width - marginRight - tooltipWidth, activeX - tooltipWidth / 2));
  const tooltipY = activeY - tooltipHeight - 12 < marginTop ? activeY + 14 : activeY - tooltipHeight - 12;

  return (
    <div className="macro-chart-container">
      {/* Chart Toolbar: Mode Toggle */}
      <div className="macro-chart-toolbar">
        <div className="macro-mode-toggle">
          <span className="macro-toolbar-label">Dạng biểu đồ:</span>
          <div className="segments">
            <button
              type="button"
              className={mode === 'bar' ? 'selected' : ''}
              onClick={() => setMode('bar')}
              title="Biểu đồ cột giá trị chi tiết theo từng kỳ"
            >
              Cột giá trị
            </button>
            <button
              type="button"
              className={mode === 'area' ? 'selected' : ''}
              onClick={() => setMode('area')}
              title="Biểu đồ đường và vùng xu hướng liên tục"
            >
              Đường & Vùng
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Detail Inspector (updates on hover) */}
      <div className="macro-chart-legend" role="status" aria-live="polite">
        <div className="item">
          <span className="label">Kỳ quan sát:</span>
          <span className="value">{activeObs ? formatMacroPeriod(activeObs.date, series.frequency) : '—'}</span>
        </div>
        <div className="item">
          <span className="label">Cột giá trị:</span>
          <span className="value highlight">
            {activeObs ? formatMacroValue(activeObs.value, series.unit) : '—'}
          </span>
        </div>
        <div className="item">
          <span className="label">Biến động:</span>
          <span className={'value ' + (activeDelta === null ? '' : activeDelta > 0 ? 'positive' : activeDelta < 0 ? 'negative' : '')}>
            {activeDelta === null ? '—' : (activeDelta > 0 ? '▲ +' : '▼ ') + formatMacroValue(Math.abs(activeDelta), series.unit)}
          </span>
        </div>
        <div className="item">
          <span className="label">Nguồn:</span>
          <span className="value muted-tag">{activeObs?.sourceCode || 'GỐC'}</span>
        </div>
        {hoverIndex !== null && (
          <small className="hover-hint">Đang rê chuột (di chuột ra ngoài để xem kỳ mới nhất)</small>
        )}
      </div>

      {/* Macro Stats Summary Cards */}
      <div className="macro-stats-grid">
        <div className="macro-stat-card">
          <span>Mới nhất ({formatMacroPeriod(stats.latest?.date, series.frequency)})</span>
          <strong>{formatMacroValue(stats.latest?.value, series.unit)}</strong>
          {stats.delta !== null && (
            <small className={stats.delta >= 0 ? 'positive' : 'negative'}>
              {stats.delta >= 0 ? '▲ +' : '▼ '}{formatMacroValue(Math.abs(stats.delta), series.unit)}
            </small>
          )}
        </div>
        <div className="macro-stat-card">
          <span>Đỉnh trong kỳ ({formatMacroPeriod(stats.max?.date, series.frequency)})</span>
          <strong>{formatMacroValue(stats.max?.value, series.unit)}</strong>
          <small>Cao nhất</small>
        </div>
        <div className="macro-stat-card">
          <span>Đáy trong kỳ ({formatMacroPeriod(stats.min?.date, series.frequency)})</span>
          <strong>{formatMacroValue(stats.min?.value, series.unit)}</strong>
          <small>Thấp nhất</small>
        </div>
        <div className="macro-stat-card">
          <span>Trung bình kỳ</span>
          <strong>{formatMacroValue(stats.avg, series.unit)}</strong>
          <small>{observations.length} kỳ quan sát</small>
        </div>
      </div>

      {/* SVG Interactive Chart with Y-Axis Value Column & Hover Tracking */}
      <div className="macro-svg-wrap">
        <svg
          className="macro-svg-chart"
          viewBox={`0 0 ${width} ${height}`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`Biểu đồ vĩ mô ${series.name} với ${observations.length} quan sát và cột giá trị`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#57d6aa" stopOpacity="0.35" />
              <stop offset="85%" stopColor="#57d6aa" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#57d6aa" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id={`${gradientId}-bar-pos`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#67e8b9" />
              <stop offset="100%" stopColor="#3ebd8e" />
            </linearGradient>
            <linearGradient id={`${gradientId}-bar-neg`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#ff5b6b" />
              <stop offset="100%" stopColor="#e04052" />
            </linearGradient>
            <filter id={`${gradientId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Plot Frame */}
          <rect
            x={marginLeft}
            y={marginTop}
            width={plotWidth}
            height={plotHeight}
            fill="#121c27"
            stroke="#1d2a3a"
            strokeWidth="1"
            rx="4"
          />

          {/* Grid lines and CỘT GIÁ TRỊ (Y-Axis Value Column) on the right */}
          {ticks.map((tickVal, i) => {
            const yCoord = getY(tickVal);
            return (
              <g key={i}>
                <line
                  x1={marginLeft}
                  y1={yCoord}
                  x2={marginLeft + plotWidth}
                  y2={yCoord}
                  stroke="#1c2837"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                {/* Cột giá trị (Y-Axis Tick Label) */}
                <text
                  x={marginLeft + plotWidth + 8}
                  y={yCoord + 4}
                  fill="#8ea0b7"
                  fontSize="11"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontWeight="500"
                  textAnchor="start"
                >
                  {formatMacroValue(tickVal, series.unit, true)}
                </text>
              </g>
            );
          })}

          {/* Zero Baseline (Trục 0 nổi bật nếu giá trị đi qua 0) */}
          {zeroY !== null && (
            <g>
              <line
                x1={marginLeft}
                y1={zeroY}
                x2={marginLeft + plotWidth}
                y2={zeroY}
                stroke="#475f78"
                strokeWidth="1.5"
              />
              <text
                x={marginLeft + plotWidth + 8}
                y={zeroY + 4}
                fill="#b8cde3"
                fontSize="11"
                fontFamily="Inter, system-ui, sans-serif"
                fontWeight="700"
                textAnchor="start"
              >
                0.0
              </text>
            </g>
          )}

          {/* X-Axis Horizontal Border */}
          <line
            x1={marginLeft}
            y1={marginTop + plotHeight}
            x2={marginLeft + plotWidth}
            y2={marginTop + plotHeight}
            stroke="#253547"
            strokeWidth="1"
          />

          {/* X-Axis Period Tick Labels */}
          {xLabelIndices.map(idx => {
            const obs = observations[idx];
            if (!obs) return null;
            const xCoord = mode === 'bar'
              ? marginLeft + (idx + 0.5) * (plotWidth / observations.length)
              : getX(idx);
            return (
              <g key={idx}>
                <line
                  x1={xCoord}
                  y1={marginTop + plotHeight}
                  x2={xCoord}
                  y2={marginTop + plotHeight + 5}
                  stroke="#2c3e52"
                  strokeWidth="1"
                />
                <text
                  x={xCoord}
                  y={height - 14}
                  fill="#7d91aa"
                  fontSize="11"
                  fontFamily="Inter, system-ui, sans-serif"
                  textAnchor="middle"
                >
                  {formatMacroPeriod(obs.date, series.frequency)}
                </text>
              </g>
            );
          })}

          {/* MODE 1: Biểu đồ Cột giá trị (Bar Columns) */}
          {mode === 'bar' && (
            <g className="macro-bars">
              {observations.map((obs, i) => {
                const val = Number(obs.value);
                const colStep = plotWidth / observations.length;
                const colCenter = marginLeft + (i + 0.5) * colStep;
                const bX = colCenter - barWidth / 2;
                const baseline = zeroY !== null ? zeroY : getY(min);
                const targetY = getY(val);
                const bTop = Math.min(baseline, targetY);
                const bHeight = Math.max(2, Math.abs(targetY - baseline));
                const isPos = val >= 0;
                const isHovered = hoverIndex === i;

                return (
                  <g key={obs.id || i}>
                    <rect
                      x={bX}
                      y={bTop}
                      width={barWidth}
                      height={bHeight}
                      rx="2"
                      fill={isPos ? `url(#${gradientId}-bar-pos)` : `url(#${gradientId}-bar-neg)`}
                      opacity={hoverIndex === null || isHovered ? 1 : 0.45}
                      stroke={isHovered ? '#ffffff' : isPos ? '#45c898' : '#e04052'}
                      strokeWidth={isHovered ? 1.5 : 0.5}
                      filter={isHovered ? `url(#${gradientId}-glow)` : undefined}
                    />
                    {/* Small column indicator on hover */}
                    {isHovered && (
                      <line
                        x1={colCenter}
                        y1={marginTop}
                        x2={colCenter}
                        y2={marginTop + plotHeight}
                        stroke="#7998b8"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                        pointerEvents="none"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* MODE 2: Biểu đồ Đường & Vùng (Line & Area) */}
          {mode === 'area' && (
            <g className="macro-line-area">
              <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
              <path d={linePath} fill="none" stroke="#57d6aa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

              {/* Data points if <= 60 items */}
              {observations.length <= 60 && observations.map((obs, i) => (
                <circle
                  key={obs.id || i}
                  cx={getX(i)}
                  cy={getY(Number(obs.value))}
                  r={hoverIndex === i ? 4 : 2}
                  fill={hoverIndex === i ? '#ffffff' : '#57d6aa'}
                  stroke="#121c27"
                  strokeWidth="1"
                />
              ))}

              {/* Crosshair guide lines on hover */}
              {hoverIndex !== null && activeObs && (
                <g pointerEvents="none">
                  {/* Vertical crosshair */}
                  <line
                    x1={activeX}
                    y1={marginTop}
                    x2={activeX}
                    y2={marginTop + plotHeight}
                    stroke="#7998b8"
                    strokeDasharray="3 3"
                    strokeWidth="1.2"
                  />
                  {/* Horizontal crosshair to Y-axis value column */}
                  <line
                    x1={activeX}
                    y1={activeY}
                    x2={marginLeft + plotWidth}
                    y2={activeY}
                    stroke="#7998b8"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  {/* Active Point Highlight */}
                  <circle
                    cx={activeX}
                    cy={activeY}
                    r="8"
                    fill="#57d6aa"
                    fillOpacity="0.25"
                  />
                  <circle
                    cx={activeX}
                    cy={activeY}
                    r="4.5"
                    fill="#57d6aa"
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter={`url(#${gradientId}-glow)`}
                  />
                  {/* Highlighted tick on Y-axis */}
                  <rect
                    x={marginLeft + plotWidth + 4}
                    y={activeY - 10}
                    width={marginRight - 10}
                    height="20"
                    rx="3"
                    fill="#1f344a"
                    stroke="#57d6aa"
                    strokeWidth="1"
                  />
                  <text
                    x={marginLeft + plotWidth + 8}
                    y={activeY + 4}
                    fill="#57d6aa"
                    fontSize="11"
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight="700"
                  >
                    {formatMacroValue(activeObs.value, series.unit, true)}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Floating Tooltip Box tracking hover */}
          {hoverIndex !== null && activeObs && (
            <g transform={`translate(${tooltipX}, ${tooltipY})`} pointerEvents="none">
              <rect
                width={tooltipWidth}
                height={tooltipHeight}
                rx="6"
                fill="#152230"
                stroke="#2f455c"
                strokeWidth="1"
                filter={`url(#${gradientId}-glow)`}
              />
              <text
                x="12"
                y="18"
                fill="#94a9bf"
                fontSize="11"
                fontFamily="Inter, system-ui, sans-serif"
              >
                Kỳ: {formatMacroPeriod(activeObs.date, series.frequency)}
              </text>
              <text
                x="12"
                y="40"
                fill="#ffffff"
                fontSize="16"
                fontFamily="Inter, system-ui, sans-serif"
                fontWeight="700"
              >
                {formatMacroValue(activeObs.value, series.unit)}
              </text>
              <text
                x="12"
                y="58"
                fill={activeDelta === null ? '#7d91aa' : activeDelta >= 0 ? '#57d6aa' : '#ff5b6b'}
                fontSize="11"
                fontFamily="Inter, system-ui, sans-serif"
                fontWeight="500"
              >
                {activeDelta === null ? 'Kỳ đầu tiên' : `${activeDelta >= 0 ? '▲ +' : '▼ '}${formatMacroValue(Math.abs(activeDelta), series.unit)} so với kỳ trước`}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
