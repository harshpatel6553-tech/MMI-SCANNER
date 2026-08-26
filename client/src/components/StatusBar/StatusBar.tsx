import { useSocket } from '../../hooks/useSocket';
import { formatTime } from '../../utils/formatters';
import './StatusBar.css';

interface StatusBarProps {
  stockCount: number;
}

export function StatusBar({ stockCount }: StatusBarProps) {
  const { isConnected, lastUpdate } = useSocket();

  return (
    <div className="status-bar">
      {/* Left â€” Connection */}
      <div className="status-section">
        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
        <span className={`status-text ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
        {isConnected && (
          <div className="live-indicator">
            <span className="live-dot" />
            <span className="live-text">LIVE</span>
          </div>
        )}
      </div>

      {/* Center â€” Last Update */}
      <div className="status-section">
        <span className={`refresh-icon ${isConnected ? 'spinning' : ''}`}>âŸ³</span>
        <span>
          {lastUpdate ? `Last update: ${formatTime(lastUpdate)}` : 'Waiting for data...'}
        </span>
      </div>

      {/* Right â€” Stock Count */}
      <div className="status-section">
        <span className="stock-count">{stockCount} stocks loaded</span>
      </div>
    </div>
  );
}
