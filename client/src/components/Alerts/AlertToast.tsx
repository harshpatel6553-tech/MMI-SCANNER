import { motion, AnimatePresence } from 'framer-motion';
import type { StockAlert } from '../../types';
import { formatPrice, formatTime } from '../../utils/formatters';
import { useDashboard } from '../../contexts/DashboardContext';
import { audioAlerts } from '../../utils/audioAlerts';
import { X, ExternalLink } from 'lucide-react';
import './Alerts.css';

interface Toast extends StockAlert {
  dismissAt: number;
}

interface AlertToastProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function getToastGlowClass(alertType: StockAlert['alertType']) {
  if (alertType === 'INDEX_MILESTONE') {
    return 'border-amber-500/40 shadow-[0_10px_30px_rgba(245,158,11,0.25)]';
  }
  if (alertType === 'DAY_HIGH') {
    return 'border-emerald-500/40 shadow-[0_10px_30px_rgba(16,185,129,0.25)]';
  }
  if (alertType === 'DAY_LOW') {
    return 'border-rose-500/40 shadow-[0_10px_30px_rgba(244,63,94,0.25)]';
  }
  if (alertType === 'NEWS') {
    return 'border-cyan-500/40 shadow-[0_10px_30px_rgba(6,182,212,0.25)]';
  }
  return 'border-purple-500/40 shadow-[0_10px_30px_rgba(168,85,247,0.25)]';
}

import { CyberIcon } from '../common/CyberIcon';

function getIcon(alertType: StockAlert['alertType']): React.ReactNode {
  if (alertType === 'INDEX_MILESTONE') return <CyberIcon name="overview" size={18} active={true} />;
  if (alertType === 'DAY_HIGH') return <CyberIcon name="pulse_up" size={18} active={true} />;
  if (alertType === 'DAY_LOW') return <CyberIcon name="pulse_down" size={18} active={true} />;
  if (alertType === 'NEWS') return <CyberIcon name="livenews" size={18} active={true} />;
  return <CyberIcon name="spike" size={18} active={true} />;
}

function isIndexSymbol(symbol: string): boolean {
  return symbol.includes('NIFTY') || symbol === 'BANKNIFTY';
}

function getToastLabel(alertType: StockAlert['alertType']): string {
  if (alertType === 'INDEX_MILESTONE') return 'ALL-TIME PEAK';
  if (alertType === 'DAY_HIGH') return 'NEW DAY HIGH';
  if (alertType === 'DAY_LOW') return 'NEW DAY LOW';
  if (alertType === 'NEWS') return 'BREAKING ALPHA';
  return 'VOLUME TSUNAMI';
}

export function AlertToast({ toasts, onDismiss }: AlertToastProps) {
  const { setActiveTab, setChartSymbol, setSelectedStock } = useDashboard();

  const handleToastClick = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    audioAlerts.playHapticClick();
    setChartSymbol(symbol);
    setSelectedStock(symbol);
    setActiveTab('Charts');
  };

  return (
    <div className="fixed top-[74px] right-[20px] z-[9999] flex flex-col gap-2.5 pointer-events-none w-[340px] max-w-[90vw]">
      <AnimatePresence>
        {toasts.slice(0, 3).map(toast => {
          const isHigh = toast.alertType === 'DAY_HIGH';
          const isLow = toast.alertType === 'DAY_LOW';
          const isIdx = isIndexSymbol(toast.symbol);
          const icon = getIcon(toast.alertType);
          const label = getToastLabel(toast.alertType);

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              onClick={(e) => handleToastClick(toast.symbol, e)}
              className={`relative z-0 overflow-hidden pointer-events-auto p-3.5 rounded-xl border bg-[#0b0e14]/95 backdrop-blur-2xl cursor-pointer group ${getToastGlowClass(toast.alertType)}`}
            >
              {/* Top Row */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{icon}</span>
                  <span className={`text-[10px] font-extrabold tracking-wider px-2 py-0.5 rounded ${
                    isHigh ? 'bg-emerald-500/20 text-emerald-400' :
                    isLow ? 'bg-rose-500/20 text-rose-400' :
                    toast.alertType === 'INDEX_MILESTONE' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                    {label}
                  </span>
                  {isIdx && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                      INDEX
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                    {formatTime(toast.createdAt)}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss(toast.id);
                    }}
                    className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Symbol & Price Details */}
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm text-white tracking-tight">{toast.symbol}</span>
                    <span className="text-[11px] text-slate-400 truncate max-w-[130px]">{toast.name}</span>
                  </div>
                  {toast.details && (
                    <span className="text-[10.5px] font-medium text-amber-400 mt-0.5">{toast.details}</span>
                  )}
                </div>

                <div className="flex flex-col items-end flex-shrink-0">
                  <span className={`font-extrabold text-sm tabular-nums ${
                    isHigh ? 'text-emerald-400' : isLow ? 'text-rose-400' : 'text-amber-400'
                  }`}>
                    {formatPrice(toast.price)}
                  </span>
                  {toast.changePercent !== undefined && (
                    <span className={`text-[10.5px] font-bold tabular-nums ${
                      toast.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {toast.changePercent >= 0 ? '+' : '−'}{Math.abs(toast.changePercent).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Hover Cue */}
              <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[9.5px] text-slate-400 group-hover:text-emerald-400 transition-colors">
                <span>CLICK TO VIEW LIVE CHART</span>
                <ExternalLink size={10} />
              </div>

              {/* Progress Bar */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5, ease: "linear" }}
                className={`absolute bottom-0 left-0 h-[2.5px] ${
                  isHigh ? 'bg-emerald-400' : isLow ? 'bg-rose-400' : 'bg-amber-400'
                } opacity-50`}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
