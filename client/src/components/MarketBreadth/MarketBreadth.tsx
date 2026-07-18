import { FadeInWhenVisible } from '../Motion/FadeInWhenVisible';
import { motion } from 'framer-motion';
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
      <FadeInWhenVisible delay={0.1}>
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
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${gainerPct}%` }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="breadth-bar-segment bar-gainers"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${unchangedPct}%` }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="breadth-bar-segment bar-unchanged"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${loserPct}%` }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="breadth-bar-segment bar-losers"
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
      </FadeInWhenVisible>
    </div>
  );
}
