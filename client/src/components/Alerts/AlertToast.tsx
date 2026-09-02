import { motion, AnimatePresence } from 'framer-motion';
import type { StockAlert } from '../../types';
import { formatPrice, formatTime } from '../../utils/formatters';
import './Alerts.css';

interface Toast extends StockAlert {
  dismissAt: number;
}

interface AlertToastProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function getToastStyle(alertType: StockAlert['alertType']) {
  // Day High pattern requested by user
  if (alertType === 'DAY_HIGH') {
    return 'rounded-md border-l-[10px] border-green-600 bg-green-600/10 text-green-600 dark:border-green-400 dark:bg-green-400/10 dark:text-green-400';
  }
  // Day Low pattern requested by user
  if (alertType === 'DAY_LOW') {
    // using red/destructive colors to match the "destructive" intent
    return 'rounded-none border-0 border-l-[10px] border-red-600 bg-red-600/10 text-red-600 dark:border-red-500 dark:bg-red-500/10 dark:text-red-500';
  }
  // News and Volume Spike matching the same beautiful pattern
  if (alertType === 'NEWS') {
    return 'rounded-md border-l-[10px] border-blue-600 bg-blue-600/10 text-blue-600 dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-400';
  }
  return 'rounded-md border-l-[10px] border-purple-600 bg-purple-600/10 text-purple-600 dark:border-purple-400 dark:bg-purple-400/10 dark:text-purple-400';
}

function getIcon(alertType: StockAlert['alertType']): string {
  if (alertType === 'DAY_HIGH') return '🚀';
  if (alertType === 'DAY_LOW') return '📉';
  if (alertType === 'NEWS') return '📰';
  return '⚡';
}

function getToastTitle(alertType: StockAlert['alertType']): string {
  if (alertType === 'DAY_HIGH') return 'Day High Hit';
  if (alertType === 'DAY_LOW') return 'Day Low Hit';
  if (alertType === 'NEWS') return 'News Alert';
  return 'Volume Spike';
}

export function AlertToast({ toasts, onDismiss }: AlertToastProps) {
  return (
    <div className="fixed top-[80px] right-[20px] z-[9999] flex flex-col gap-3 pointer-events-none w-[320px]">
      <AnimatePresence>
        {toasts.map(toast => {
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={`relative z-0 overflow-hidden pointer-events-auto p-4 shadow-2xl backdrop-blur-xl before:absolute before:inset-0 before:bg-[#0b0b0d] before:bg-opacity-95 before:-z-10 ${getToastStyle(toast.alertType)}`}
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0 text-xl leading-none">
                  {getIcon(toast.alertType)}
                </div>
                
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm tracking-wide">
                      {getToastTitle(toast.alertType)}
                    </span>
                    <span className="text-[10px] font-medium opacity-60">
                      {formatTime(toast.createdAt)}
                    </span>
                  </div>
                  
                  {toast.alertType === 'NEWS' ? (
                    <div className="flex flex-col mt-1">
                      <strong className="text-sm">{toast.symbol}</strong>
                      <span className="text-xs opacity-90 leading-snug mt-0.5">{toast.name}</span>
                    </div>
                  ) : (
                      <div className="text-sm opacity-90 leading-snug mt-0.5">
                      <strong>{toast.symbol}</strong>{' '}
                      {toast.alertType === 'VOLUME_SPIKE' ? (
                        <>
                          is experiencing unusual volume at <strong className="tabular-nums">{formatPrice(toast.price)}</strong>
                          {toast.changePercent !== undefined && (
                            <span className={`ml-1 text-xs font-semibold ${toast.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              ({toast.changePercent >= 0 ? '+' : ''}{toast.changePercent.toFixed(2)}%)
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          reached {toast.alertType === 'DAY_HIGH' ? 'day high' : 'day low'} at <strong className="tabular-nums">{formatPrice(toast.price)}</strong>
                          {toast.changePercent !== undefined && (
                            <span className={`ml-1 text-xs font-semibold ${toast.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              ({toast.changePercent >= 0 ? '+' : ''}{toast.changePercent.toFixed(2)}%)
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => onDismiss(toast.id)}
                  className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity self-start -mt-1 -mr-1 p-1"
                >
                  ✕
                </button>
              </div>
              
              {/* Animated Progress Bar at bottom */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5, ease: "linear" }}
                className="absolute bottom-0 left-0 h-[3px] bg-current opacity-30"
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
