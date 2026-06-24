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

function getToastBarClass(alertType: StockAlert['alertType']): string {
  if (alertType === 'DAY_HIGH') return 'day-high';
  if (alertType === 'DAY_LOW') return 'day-low';
  if (alertType === 'NEWS') return 'news';
  if (alertType === 'OPTIONS_CALL_SPIKE') return 'day-low'; // Bearish
  if (alertType === 'OPTIONS_PUT_SPIKE') return 'day-high'; // Bullish
  return 'volume-spike';
}

function getIcon(alertType: StockAlert['alertType']): string {
  if (alertType === 'DAY_HIGH') return '📈';
  if (alertType === 'DAY_LOW') return '📉';
  if (alertType === 'NEWS') return '📰';
  if (alertType === 'OPTIONS_CALL_SPIKE') return '🔴';
  if (alertType === 'OPTIONS_PUT_SPIKE') return '🟢';
  return '⚡';
}

function getToastTitle(alertType: StockAlert['alertType']): string {
  if (alertType === 'DAY_HIGH') return '📈 Day High Hit';
  if (alertType === 'DAY_LOW') return '📉 Day Low Hit';
  if (alertType === 'NEWS') return '📰 News Alert';
  if (alertType === 'OPTIONS_CALL_SPIKE') return '🔴 Call Writing Spike';
  if (alertType === 'OPTIONS_PUT_SPIKE') return '🟢 Put Writing Spike';
  return '⚡ Volume Spike';
}

function getToastPriceClass(alertType: StockAlert['alertType']): string {
  if (alertType === 'DAY_HIGH' || alertType === 'OPTIONS_PUT_SPIKE') return 'positive';
  if (alertType === 'DAY_LOW' || alertType === 'OPTIONS_CALL_SPIKE') return 'negative';
  return 'volume-spike-text';
}

export function AlertToast({ toasts, onDismiss }: AlertToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => {
        const barClass = getToastBarClass(toast.alertType);

        return (
          <div key={toast.id} className="alert-toast">
            <div className={`toast-type-bar ${barClass}`} />
            <div className="toast-body">
              <div className="toast-content">
                <div className="toast-header">
                  <span className="toast-icon">{getIcon(toast.alertType)}</span>
                  <span className="toast-title">{getToastTitle(toast.alertType)}</span>
                </div>
                {toast.alertType === 'NEWS' ? (
                  <>
                    <div className="toast-symbol">{toast.symbol}</div>
                    <div className="toast-news-title" style={{ fontSize: '12px', marginTop: '4px', lineHeight: '1.4' }}>{toast.name}</div>
                  </>
                ) : toast.alertType.startsWith('OPTIONS') ? (
                  <>
                    <div className="toast-message" style={{ marginTop: '4px' }}>
                      <strong>{toast.symbol}</strong> has a sudden spike on the{' '}
                      <strong>{toast.alertType === 'OPTIONS_CALL_SPIKE' ? 'Call' : 'Put'}</strong> side.
                      <br />
                      Strike: <strong>{toast.name}</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="toast-message">
                      <strong>{toast.symbol}</strong>{' '}
                      {toast.alertType === 'VOLUME_SPIKE' ? (
                        <>is experiencing unusual volume at{' '}
                        <span className={`toast-price ${getToastPriceClass(toast.alertType)}`}>
                          {formatPrice(toast.price)}
                        </span></>
                      ) : (
                        <>reached {toast.alertType === 'DAY_HIGH' ? 'day high' : 'day low'} at{' '}
                        <span className={`toast-price ${getToastPriceClass(toast.alertType)}`}>
                          {formatPrice(toast.price)}
                        </span></>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="toast-time">{formatTime(toast.createdAt)}</div>
            </div>
            <button className="toast-dismiss" onClick={() => onDismiss(toast.id)}>✕</button>
            <div className={`toast-progress ${barClass}`} />
          </div>
        );
      })}
    </div>
  );
}

