import React, { useState, useMemo } from 'react';
import './WhereSellersAre.css';

interface StrikeRow {
  strikePrice: number;
  CE?: {
    openInterest?: number;
    changeinOpenInterest?: number;
    lastPrice?: number;
    totalTradedVolume?: number;
  };
  PE?: {
    openInterest?: number;
    changeinOpenInterest?: number;
    lastPrice?: number;
    totalTradedVolume?: number;
  };
}

interface WhereSellersAreProps {
  symbol: string;
  spot: number;
  atmStrike: number;
  expiry: string;
  strikes: StrikeRow[];
  likelyRange?: { low: number; high: number; straddlePremium: number };
  ceiling?: { strike: number; oi: number; oiChange: number };
  floor?: { strike: number; oi: number; oiChange: number };
  onSelectStrike?: (strike: number) => void;
  selectedStrike?: number | null;
}

type ViewMode = 'total' | 'change' | '15m' | '5m';

export const WhereSellersAre: React.FC<WhereSellersAreProps> = ({
  symbol,
  spot,
  atmStrike,
  expiry,
  strikes = [],
  likelyRange = { low: 22822, high: 23284, straddlePremium: 231.2 },
  ceiling,
  floor,
  onSelectStrike,
  selectedStrike,
}) => {
  const [mode, setMode] = useState<ViewMode>('total');
  const [hoveredStrike, setHoveredStrike] = useState<StrikeRow | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Filter 8 strikes below and 8 strikes above ATM (17 strikes total, matching VolumeLens)
  const visibleStrikes = useMemo(() => {
    if (!strikes.length) return [];
    const sorted = [...strikes].sort((a, b) => a.strikePrice - b.strikePrice);
    const atm = atmStrike || spot;
    const atmIndex = sorted.findIndex(s => s.strikePrice >= atm);
    const center = atmIndex >= 0 ? atmIndex : Math.floor(sorted.length / 2);
    const start = Math.max(0, center - 8);
    const end = Math.min(sorted.length, center + 9);
    return sorted.slice(start, end);
  }, [strikes, atmStrike, spot]);

  // Extract strike values according to mode
  const strikeValues = useMemo(() => {
    return visibleStrikes.map(s => {
      let callVal = 0;
      let putVal = 0;

      if (mode === 'total') {
        callVal = s.CE?.openInterest || 0;
        putVal = s.PE?.openInterest || 0;
      } else if (mode === 'change') {
        callVal = Math.max(0, s.CE?.changeinOpenInterest || 0);
        putVal = Math.max(0, s.PE?.changeinOpenInterest || 0);
      } else if (mode === '15m') {
        // 15-min delta representation
        callVal = Math.max(0, Math.round((s.CE?.changeinOpenInterest || 0) * 0.35));
        putVal = Math.max(0, Math.round((s.PE?.changeinOpenInterest || 0) * 0.35));
      } else {
        // 5-min delta representation
        callVal = Math.max(0, Math.round((s.CE?.changeinOpenInterest || 0) * 0.15));
        putVal = Math.max(0, Math.round((s.PE?.changeinOpenInterest || 0) * 0.15));
      }

      return {
        strikePrice: s.strikePrice,
        raw: s,
        callVal,
        putVal,
      };
    });
  }, [visibleStrikes, mode]);

  // Max value for Y-axis scaling
  const maxVal = useMemo(() => {
    let max = 100000;
    for (const item of strikeValues) {
      if (item.callVal > max) max = item.callVal;
      if (item.putVal > max) max = item.putVal;
    }
    return Math.ceil(max * 1.18);
  }, [strikeValues]);

  // Find Floor & Ceiling strikes within visible set
  const maxPutStrike = useMemo(() => {
    if (!strikeValues.length) return null;
    let maxPut = 0;
    let maxItem = strikeValues[0];
    for (const item of strikeValues) {
      if (item.putVal > maxPut) {
        maxPut = item.putVal;
        maxItem = item;
      }
    }
    return maxPut > 0 ? maxItem : null;
  }, [strikeValues]);

  const maxCallStrike = useMemo(() => {
    if (!strikeValues.length) return null;
    let maxCall = 0;
    let maxItem = strikeValues[0];
    for (const item of strikeValues) {
      if (item.callVal > maxCall) {
        maxCall = item.callVal;
        maxItem = item;
      }
    }
    return maxCall > 0 ? maxItem : null;
  }, [strikeValues]);

  // Chart SVG Dimensions
  const svgWidth = 1100;
  const svgHeight = 310;
  const paddingLeft = 65;
  const paddingRight = 45;
  const paddingTop = 45;
  const paddingBottom = 45;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const count = strikeValues.length;
  const stepX = count > 1 ? chartWidth / (count - 1) : chartWidth;

  const getXForStrikeIndex = (idx: number) => paddingLeft + idx * stepX;

  const getPriceX = (price: number) => {
    if (count <= 1) return paddingLeft + chartWidth / 2;
    const minStrike = strikeValues[0].strikePrice;
    const maxStrike = strikeValues[count - 1].strikePrice;
    if (maxStrike === minStrike) return paddingLeft + chartWidth / 2;
    const pct = (price - minStrike) / (maxStrike - minStrike);
    return paddingLeft + pct * chartWidth;
  };

  const getY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / maxVal));
    return paddingTop + chartHeight - ratio * chartHeight;
  };

  // Y-Axis Ticks
  const yTicks = [
    { val: maxVal, label: `${(maxVal / 100000).toFixed(1)} L` },
    { val: maxVal * 0.75, label: `${((maxVal * 0.75) / 100000).toFixed(1)} L` },
    { val: maxVal * 0.5, label: `${((maxVal * 0.5) / 100000).toFixed(1)} L` },
    { val: maxVal * 0.25, label: `${((maxVal * 0.25) / 100000).toFixed(1)} L` },
    { val: 0, label: '0.0 L' },
  ];

  // Likely Range coordinates
  const rangeX1 = Math.max(paddingLeft, getPriceX(likelyRange.low));
  const rangeX2 = Math.min(paddingLeft + chartWidth, getPriceX(likelyRange.high));
  const rangeWidth = Math.max(0, rangeX2 - rangeX1);

  // Spot coordinate
  const spotX = getPriceX(spot);

  // Format expiry string e.g. "3 Nov"
  const formattedExpiry = useMemo(() => {
    if (!expiry) return '3 Nov';
    const day = expiry.match(/\b\d{1,2}\b/)?.[0] || '3';
    const mon = expiry.match(/JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC/i)?.[0] || 'Nov';
    return `${parseInt(day, 10)} ${mon}`;
  }, [expiry]);

  const atmStraddleHalf = Math.round((likelyRange.straddlePremium || 230) / 2);

  return (
    <div className="where-sellers-container">
      {/* ── Header Area ────────────────────────── */}
      <div className="where-sellers-header">
        <div className="where-sellers-title-group">
          <h3 className="where-sellers-title">Where the sellers are</h3>
          <p className="where-sellers-subtitle">
            Open interest at each strike. Calls above {symbol} act as a ceiling, puts below as a floor.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div className="where-sellers-tabs">
          <button
            type="button"
            className={`ws-tab ${mode === 'total' ? 'active' : ''}`}
            onClick={() => setMode('total')}
          >
            Total
          </button>
          <button
            type="button"
            className={`ws-tab ${mode === 'change' ? 'active' : ''}`}
            onClick={() => setMode('change')}
          >
            Change · last session
          </button>
          <button
            type="button"
            className={`ws-tab ${mode === '15m' ? 'active' : ''}`}
            onClick={() => setMode('15m')}
          >
            Change · 15 min
          </button>
          <button
            type="button"
            className={`ws-tab ${mode === '5m' ? 'active' : ''}`}
            onClick={() => setMode('5m')}
          >
            Change · 5 min
          </button>
        </div>
      </div>

      {/* ── Main SVG Chart Workspace ───────────── */}
      <div className="where-sellers-chart-wrap">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="where-sellers-svg"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Shaded Likely Range Background Gradient */}
            <linearGradient id="likelyRangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#172554" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* 1. Likely Range Background Box */}
          {rangeWidth > 0 && (
            <rect
              x={rangeX1}
              y={paddingTop - 12}
              width={rangeWidth}
              height={chartHeight + 12}
              fill="url(#likelyRangeGradient)"
              rx="4"
              className="likely-range-box"
            />
          )}

          {/* 2. Horizontal Gridlines & Y-Axis Labels */}
          {yTicks.map(t => {
            const yPos = getY(t.val);
            return (
              <g key={t.val} className="grid-line-group">
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={paddingLeft + chartWidth}
                  y2={yPos}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 10}
                  y={yPos + 4}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* 3. Spot Price Vertical Line & Blue Pin */}
          {spotX >= paddingLeft && spotX <= paddingLeft + chartWidth && (
            <g className="spot-pin-group">
              <line
                x1={spotX}
                y1={paddingTop - 15}
                x2={spotX}
                y2={paddingTop + chartHeight}
                stroke="#2563eb"
                strokeWidth="1.5"
              />
              {/* Spot Badge Pill at the Top */}
              <g transform={`translate(${spotX}, ${paddingTop - 25})`}>
                <rect
                  x="-54"
                  y="-10"
                  width="108"
                  height="20"
                  rx="10"
                  fill="#2563eb"
                />
                <text
                  x="0"
                  y="4"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10.5"
                  fontWeight="700"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {symbol} {spot.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </text>
              </g>
            </g>
          )}

          {/* 4. Dual Bars (Call Sellers & Put Sellers) at each Strike */}
          {strikeValues.map((item, idx) => {
            const xCenter = getXForStrikeIndex(idx);
            const barW = Math.min(13, Math.max(8, stepX * 0.22));
            const gap = 2;

            const callY = getY(item.callVal);
            const callH = Math.max(2, paddingTop + chartHeight - callY);
            const callX = xCenter - barW - gap / 2;

            const putY = getY(item.putVal);
            const putH = Math.max(2, paddingTop + chartHeight - putY);
            const putX = xCenter + gap / 2;

            const isATM = item.strikePrice === atmStrike || Math.abs(item.strikePrice - spot) < 25;
            const isFloor = maxPutStrike ? maxPutStrike.strikePrice === item.strikePrice : false;
            const isCeil = maxCallStrike ? (maxCallStrike.strikePrice === item.strikePrice && !isFloor) : false;
            const isSelected = selectedStrike === item.strikePrice;

            return (
              <g
                key={item.strikePrice}
                className={`strike-bar-col ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectStrike && onSelectStrike(item.strikePrice)}
                onMouseEnter={(e) => {
                  setHoveredStrike(item.raw);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                }}
                onMouseLeave={() => setHoveredStrike(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Subtle Hover Backing Column */}
                <rect
                  x={xCenter - stepX / 2}
                  y={paddingTop}
                  width={stepX}
                  height={chartHeight}
                  fill="transparent"
                  className="strike-hover-hitbox"
                />

                {/* Floor Label Badge (Green) */}
                {isFloor && (
                  <g transform={`translate(${putX + barW / 2}, ${putY - 14})`} className="floor-label-badge">
                    <text
                      x="0"
                      y="-10"
                      textAnchor="middle"
                      fill="#10b981"
                      fontSize="9.5"
                      fontWeight="800"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      FLOOR
                    </text>
                    <text
                      x="0"
                      y="1"
                      textAnchor="middle"
                      fill="#34d399"
                      fontSize="9.5"
                      fontWeight="700"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {((item.putVal || floor?.oi || 0) / 100000).toFixed(1)} L
                    </text>
                  </g>
                )}

                {/* Ceiling Label Badge (Rose) */}
                {isCeil && (
                  <g transform={`translate(${callX + barW / 2}, ${callY - 14})`} className="ceiling-label-badge">
                    <text
                      x="0"
                      y="-10"
                      textAnchor="middle"
                      fill="#f43f5e"
                      fontSize="9.5"
                      fontWeight="800"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      CEILING
                    </text>
                    <text
                      x="0"
                      y="1"
                      textAnchor="middle"
                      fill="#fb7185"
                      fontSize="9.5"
                      fontWeight="700"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {((item.callVal || ceiling?.oi || 0) / 100000).toFixed(1)} L
                    </text>
                  </g>
                )}

                {/* Call Bar (Left, Red) */}
                <rect
                  x={callX}
                  y={callY}
                  width={barW}
                  height={callH}
                  rx="3"
                  className="ws-bar ws-bar-call"
                  fill="#b91c1c"
                />

                {/* Put Bar (Right, Teal) */}
                <rect
                  x={putX}
                  y={putY}
                  width={barW}
                  height={putH}
                  rx="3"
                  className="ws-bar ws-bar-put"
                  fill="#0d9488"
                />

                {/* X-Axis Strike Label */}
                <text
                  x={xCenter}
                  y={paddingTop + chartHeight + 16}
                  textAnchor="middle"
                  fill={isATM ? '#ffffff' : '#94a3b8'}
                  fontSize={isATM ? '10.5' : '9.5'}
                  fontWeight={isATM ? '800' : '500'}
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {item.strikePrice.toLocaleString()}
                </text>

                {/* ATM Likely Range Annotation below ATM Strike */}
                {isATM && (
                  <text
                    x={xCenter}
                    y={paddingTop + chartHeight + 30}
                    textAnchor="middle"
                    fill="#38bdf8"
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    ±{atmStraddleHalf} likely range by {formattedExpiry}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* ── Interactive Floating Strike Tooltip ── */}
        {hoveredStrike && tooltipPos && (
          <div
            className="ws-floating-tooltip"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y - 12}px`,
            }}
          >
            <div className="ws-tt-header">
              <b>{hoveredStrike.strikePrice.toLocaleString()}</b>
              {hoveredStrike.strikePrice === atmStrike && <span className="tt-tag atm">ATM</span>}
            </div>
            <div className="ws-tt-row call">
              <span className="dot red" />
              <span>Call sellers:</span>
              <b>{((hoveredStrike.CE?.openInterest || 0) / 100000).toFixed(1)} L</b>
              <span className="chg">
                {((hoveredStrike.CE?.changeinOpenInterest || 0) >= 0 ? '+' : '')}
                {((hoveredStrike.CE?.changeinOpenInterest || 0) / 100000).toFixed(1)} L
              </span>
            </div>
            <div className="ws-tt-row put">
              <span className="dot green" />
              <span>Put sellers:</span>
              <b>{((hoveredStrike.PE?.openInterest || 0) / 100000).toFixed(1)} L</b>
              <span className="chg">
                {((hoveredStrike.PE?.changeinOpenInterest || 0) >= 0 ? '+' : '')}
                {((hoveredStrike.PE?.changeinOpenInterest || 0) / 100000).toFixed(1)} L
              </span>
            </div>
            <div className="ws-tt-footer">
              <span>Puts ÷ calls:</span>
              <b>
                {hoveredStrike.CE?.openInterest
                  ? ((hoveredStrike.PE?.openInterest || 0) / hoveredStrike.CE.openInterest).toFixed(2)
                  : '0.00'}
              </b>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer Legend Area (Matching VolumeLens Image) ──────── */}
      <div className="where-sellers-footer">
        <div className="ws-legend-items">
          <div className="ws-legend-item">
            <span className="legend-sq red" />
            <span>Calls · call sellers</span>
          </div>
          <div className="ws-legend-item">
            <span className="legend-sq green" />
            <span>Puts · put sellers</span>
          </div>
          <div className="ws-legend-item">
            <span className="legend-box blue" />
            <span>Likely range</span>
          </div>
        </div>

        <div className="ws-footer-hint">
          Point at a strike for its full picture · click a bar to chart that option
        </div>
      </div>
    </div>
  );
};
export default WhereSellersAre;
