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
  return 'volume-spike';
}

function getToastTitle(alertType: StockAlert['alertType']): string {
  if (alertType === 'DAY_HIGH') return '📈 Day High Hit';
  if (alertType === 'DAY_LOW') return '📉 Day Low Hit';
  return '⚡ Volume Spike';
}

function getToastMessage(toast: Toast): string {
  if (toast.alertType === 'VOLUME_SPIKE') {
    return `${toast.symbol} is experiencing unusual volume`;
  }
  return `${toast.symbol} reached ${toast.alertType === 'DAY_HIGH' ? 'day high' : 'day low'}`;
}

function getToastPriceClass(alertType: StockAlert['alertType']): string {
  if (alertType === 'DAY_HIGH') return 'positive';
  if (alertType === 'DAY_LOW') return 'negative';
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
              <div className="toast-header">
                <span className="toast-icon">
                  {toast.alertType === 'VOLUME_SPIKE' ? '⚡' : '🔔'}
                  <span className="sound-ring" />
                  <span className="sound-ring" />
                </span>
                <span className="toast-title">
                  {getToastTitle(toast.alertType)}
                </span>
              </div>
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

