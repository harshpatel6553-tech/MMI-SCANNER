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

  const adDisplay = advanceDeclineRatio === Infinity ? 'INF' : advanceDeclineRatio.toFixed(2);

  return (
    <div className="market-breadth">
      <div className="breadth-panel">
        <div className="breadth-data">
          <span className="breadth-label">ADV</span>
          <span className="breadth-value positive">{gainers}</span>
        </div>
        <div className="breadth-data">
          <span className="breadth-label">DEC</span>
          <span className="breadth-value negative">{losers}</span>
        </div>
        <div className="breadth-data">
          <span className="breadth-label">UNC</span>
          <span className="breadth-value text-muted">{unchanged}</span>
        </div>
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

      <div className="breadth-panel right">
        <div className="breadth-data">
          <span className="breadth-label">A/D RATIO</span>
          <span className="breadth-value">{adDisplay}</span>
        </div>
        {volumeSpikes > 0 && (
          <div className="breadth-data alert">
            <span className="breadth-label">SPIKES</span>
            <span className="breadth-value">{volumeSpikes}</span>
          </div>
        )}
      </div>
    </div>
  );
}
