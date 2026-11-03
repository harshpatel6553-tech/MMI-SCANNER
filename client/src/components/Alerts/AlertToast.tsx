import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StockAlert } from '../../types';
import { formatPrice, formatTime } from '../../utils/formatters';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { X, ExternalLink, Zap } from 'lucide-react';
import { CyberIcon } from '../common/CyberIcon';
import { StockLogo } from '../common/StockLogo';
import './Alerts.css';

interface Toast extends StockAlert {
  dismissAt: number;
}

interface AlertToastProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function isIndexSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase();
  return (
    s.includes('NIFTY') ||
    s.includes('BANKNIFTY') ||
    s.includes('SENSEX') ||
    s.includes('INDIA VIX') ||
    s.includes('INDEX')
  );
}

function getToastLabel(alertType: StockAlert['alertType']): string {
  if (alertType === 'FNO_OI') return 'F&O BIG MONEY';
  if (alertType === 'SMART_MONEY') return 'SMART MONEY';
  if (alertType === 'INDEX_MILESTONE') return 'INDEX PEAK';
  if (alertType === 'DAY_HIGH') return 'DAY HIGH BREAK';
  if (alertType === 'DAY_LOW') return 'DAY LOW BREAK';
  if (alertType === 'NEWS') return 'BREAKING NEWS';
  return 'VOLUME SPIKE';
}

export function AlertToast({ toasts, onDismiss }: AlertToastProps) {
  const { setActiveTab, setChartSymbol, setSelectedStock, isAlertPanelOpen } = useDashboard();

  const handleToastClick = (toast: Toast, e: React.MouseEvent) => {
    e.stopPropagation();
    audioAlerts.playHapticClick();
    if (toast.alertType === 'NEWS') {
      setActiveTab('LiveNews');
    } else if (toast.alertType === 'FNO_OI') {
      setActiveTab('OptionsLens');
    } else if (toast.alertType === 'SMART_MONEY') {
      setActiveTab('Promoter');
    } else {
      setChartSymbol(toast.symbol);
      setSelectedStock(toast.symbol);
      setActiveTab('Charts');
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: '74px',
        right: isAlertPanelOpen ? '460px' : '20px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
        width: '360px',
        maxWidth: '92vw',
        transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <AnimatePresence>
        {toasts.slice(0, 3).map(toast => {
          const isHigh = toast.alertType === 'DAY_HIGH';
          const isLow = toast.alertType === 'DAY_LOW';
          const isMilestone = toast.alertType === 'INDEX_MILESTONE';
          const isNews = toast.alertType === 'NEWS';
          const isIdx = isIndexSymbol(toast.symbol);
          const label = getToastLabel(toast.alertType);

          const accentColor = isHigh ? 'var(--up)' : isLow ? 'var(--down)' : isNews ? 'var(--gold)' : 'var(--cyan)';

          return (
            <motion.div
              key={toast.id}
              data-testid="alert-toast-item"
              initial={{ opacity: 0, x: 80, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              onClick={(e) => handleToastClick(toast, e)}
              className="relative overflow-hidden pointer-events-auto p-3.5 rounded-xl border bg-[#0B1220]/95 backdrop-blur-2xl cursor-pointer group shadow-[0_16px_36px_-10px_rgba(0,0,0,0.85)]"
              style={{
                borderLeft: `4px solid ${accentColor}`,
                borderColor: 'var(--border)'
              }}
            >
              {/* Dynamic light streak animation across newly arrived toast */}
              <div className="alert-light-streak" />

              {/* Top Row: Type Badge + Time + Dismiss */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center w-5 h-5">
                    <span 
                      className="absolute inset-0 rounded-full animate-ping opacity-60"
                      style={{ background: accentColor }}
                    />
                    <CyberIcon 
                      name={isHigh ? 'pulse_up' : isLow ? 'pulse_down' : isNews ? 'livenews' : 'spike'} 
                      size={15} 
                      active={true} 
                    />
                  </div>

                  <span 
                    className="text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded font-mono"
                    style={{
                      background: isHigh ? 'rgba(0, 214, 163, 0.15)' : isLow ? 'rgba(255, 66, 104, 0.15)' : 'rgba(40, 207, 255, 0.15)',
                      color: accentColor,
                      border: `1px solid ${accentColor}33`
                    }}
                  >
                    {label}
                  </span>

                  {isIdx && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono">
                      NSE INDEX
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-medium text-slate-400 tabular-nums">
                    {formatTime(toast.createdAt)}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      audioAlerts.playHapticClick();
                      onDismiss(toast.id);
                    }}
                    className="text-slate-400 hover:text-white p-1 rounded transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Symbol & Price Details */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <StockLogo symbol={toast.symbol} name={toast.name} size={24} className="shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-extrabold text-sm text-white tracking-tight">{toast.symbol}</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{toast.name}</span>
                    </div>
                    {toast.details && (
                      <span className="text-[10.5px] font-medium text-cyan-400 mt-0.5 font-mono">
                        {toast.details}
                      </span>
                    )}
                  </div>
                </div>

                {toast.price > 0 && (
                  <div className="flex flex-col items-end shrink-0">
                    <span className="font-mono font-bold text-sm text-white tabular-nums">
                      {formatPrice(toast.price)}
                    </span>
                    {toast.changePercent !== undefined && (
                      <span className={`text-[10px] font-mono font-bold tabular-nums ${toast.changePercent >= 0 ? 'text-[#00D6A3]' : 'text-[#FF4268]'}`}>
                        {toast.changePercent >= 0 ? '+' : ''}{toast.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Subtle hover prompt */}
              <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-cyan-400 transition-colors">
                <span className="font-mono">
                  {toast.alertType === 'NEWS'
                    ? 'CLICK TO VIEW LIVE NEWS FEED'
                    : toast.alertType === 'FNO_OI'
                    ? 'CLICK TO INSPECT F&O OPTIONS LENS'
                    : toast.alertType === 'SMART_MONEY'
                    ? 'CLICK TO INSPECT SMART MONEY RADAR'
                    : 'CLICK TO INSPECT REAL-TIME CHART'}
                </span>
                <ExternalLink size={10} />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
