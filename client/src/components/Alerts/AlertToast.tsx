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

export function AlertToast({ toasts, onDismiss }: AlertToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className="alert-toast">
          <div className={`toast-type-bar ${toast.alertType === 'DAY_HIGH' ? 'day-high' : 'day-low'}`} />
          <div className="toast-body">
            <div className="toast-header">
              <span className="toast-icon">
                🔔
                <span className="sound-ring" />
                <span className="sound-ring" />
              </span>
              <span className="toast-title">
                {toast.alertType === 'DAY_HIGH' ? '📈 Day High Hit' : '📉 Day Low Hit'}
              </span>
            </div>
            <div className="toast-message">
              <strong>{toast.symbol}</strong> reached{' '}
              {toast.alertType === 'DAY_HIGH' ? 'day high' : 'day low'} at{' '}
              <span className={`toast-price ${toast.alertType === 'DAY_HIGH' ? 'positive' : 'negative'}`}>
                {formatPrice(toast.price)}
              </span>
            </div>
            <div className="toast-time">{formatTime(toast.createdAt)}</div>
          </div>
          <button className="toast-dismiss" onClick={() => onDismiss(toast.id)}>✕</button>
          <div className={`toast-progress ${toast.alertType === 'DAY_HIGH' ? 'day-high' : 'day-low'}`} />
        </div>
      ))}
    </div>
  );
}
