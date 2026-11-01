import React from 'react';
import { motion } from 'framer-motion';
import { StockLogo } from './StockLogo';
import { CyberIcon, CyberIconName } from './CyberIcon';
import { formatTime } from '../../utils/formatters';
import { Copy, Check, TrendingUp, TrendingDown, Zap, Radio } from 'lucide-react';
import type { StockAlert } from '../../types';

interface AlertMotionCardProps {
  alert: StockAlert;
  onClick?: () => void;
  onCopy?: (sym: string, id: string, e: React.MouseEvent) => void;
  isCopied?: boolean;
}

export function AlertMotionCard({ alert, onClick, onCopy, isCopied }: AlertMotionCardProps) {
  const isHigh = alert.alertType === 'DAY_HIGH';
  const isLow = alert.alertType === 'DAY_LOW';
  const isNews = alert.alertType === 'NEWS';
  const isMilestone = alert.alertType === 'INDEX_MILESTONE';
  const isSpike = alert.alertType === 'VOLUME_SPIKE';

  const typeClass = isMilestone ? 'milestone' : isHigh ? 'high' : isLow ? 'low' : isNews ? 'news' : 'spike';
  const typeIcon: CyberIconName = isMilestone ? 'overview' : isHigh ? 'pulse_up' : isLow ? 'pulse_down' : isNews ? 'livenews' : 'spike';
  const typeText = isMilestone ? 'INDEX PEAK' : isHigh ? 'DAY HIGH' : isLow ? 'DAY LOW' : isNews ? 'NEWS ALPHA' : 'VOL SPIKE';

  const accentColor = isHigh ? 'var(--up)' : isLow ? 'var(--down)' : isNews ? 'var(--gold)' : 'var(--cyan)';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -16, scale: 0.95 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`alert-card ${typeClass} alert-motion-container`}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `3px solid ${accentColor}`,
        background: 'linear-gradient(135deg, rgba(16, 26, 43, 0.85) 0%, rgba(11, 18, 32, 0.95) 100%)',
      }}
    >
      {/* Dynamic light streak animation across newly mounted alerts */}
      <div className="alert-light-streak" />

      <div className="alert-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StockLogo symbol={alert.symbol} name={alert.name} size={20} />
          <span 
            className={`alert-badge ${typeClass}`} 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 5,
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}
          >
            <CyberIcon name={typeIcon} size={11} active={true} />
            <span>{typeText}</span>
          </span>
          {alert.symbol.includes('NIFTY') || alert.symbol.includes('SENSEX') ? (
            <span className="index-pill" style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px' }}>INDEX</span>
          ) : null}
        </div>

        <div className="alert-card-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="alert-time tabular-nums font-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {formatTime(alert.createdAt)}
          </span>

          {onCopy && (
            <button
              type="button"
              className="btn-quick-copy"
              onClick={(e) => onCopy(alert.symbol, alert.id, e)}
              title="Copy ticker"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 4,
                padding: '3px 5px',
                cursor: 'pointer',
                color: isCopied ? 'var(--up)' : 'var(--text-3)'
              }}
            >
              {isCopied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>

      <div className="alert-bottom" style={{ marginTop: 8 }}>
        <div className="alert-ticker-block">
          <div className="alert-sym-row" style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="alert-sym font-mono" style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
              {alert.symbol}
            </span>
            <span className="alert-co-name" style={{ fontSize: 11, color: 'var(--text-2)' }}>
              {alert.name}
            </span>
          </div>

          {alert.details && (
            <div className="alert-details-text" style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.4 }}>
              {alert.details}
            </div>
          )}
        </div>

        {alert.price > 0 && (
          <div className="alert-price-block font-mono tabular-nums" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
              ₹{alert.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {alert.change !== undefined && (
              <div 
                style={{ 
                  fontSize: 10.5, 
                  fontWeight: 700, 
                  color: alert.change >= 0 ? 'var(--up)' : 'var(--down)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 2
                }}
              >
                {alert.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                <span>{alert.change >= 0 ? '+' : ''}{alert.changePercent?.toFixed(2)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
