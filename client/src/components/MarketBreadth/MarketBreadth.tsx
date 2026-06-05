import './MarketBreadth.css';

interface MarketBreadthProps {
  stats: {
    total: number;
    gainers: number;
    losers: number;
    unchanged: number;
    advanceDeclineRatio: number;
    breadthPercent: number;
    volumeSpikes: number;
  };
}

export function MarketBreadth({ stats }: MarketBreadthProps) {
  const { total, gainers, losers, unchanged, advanceDeclineRatio, volumeSpikes } = stats;

  const gainerPct = total > 0 ? (gainers / total) * 100 : 0;
  const unchangedPct = total > 0 ? (unchanged / total) * 100 : 0;
  const loserPct = total > 0 ? (losers / total) * 100 : 0;

  const adDisplay = advanceDeclineRatio === Infinity ? '∞' : advanceDeclineRatio.toFixed(2);

  return (
    <div className="market-breadth glass-card">
      <div className="breadth-labels">
        <span className="breadth-count positive">
          {gainers} <span className="breadth-arrow">▲</span>
        </span>
        <span className="breadth-count text-muted">
          {unchanged} <span className="breadth-dash">―</span>
        </span>
        <span className="breadth-count negative">
          {losers} <span className="breadth-arrow">▼</span>
        </span>
      </div>

      <div className="breadth-bar-track">
        <div
          className="breadth-bar-segment bar-gainers"
          style={{ width: `${gainerPct}%` }}
        />
        <div
          className="breadth-bar-segment bar-unchanged"
          style={{ width: `${unchangedPct}%` }}
        />
        <div
          className="breadth-bar-segment bar-losers"
          style={{ width: `${loserPct}%` }}
        />
      </div>

      <div className="breadth-pills">
        <span className="pill pill-accent breadth-pill">
          A/D {adDisplay}
        </span>
        {volumeSpikes > 0 && (
          <span className="pill pill-volume-spike breadth-pill">
            ⚡ {volumeSpikes} Spike{volumeSpikes !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
