import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { StockData } from '../../types';
import './TradeModal.css';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockData;
  onTradeComplete?: () => void;
}

export function TradeModal({ isOpen, onClose, stock, onTradeComplete }: TradeModalProps) {
  const { profile } = useAuth();
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalCost = (quantity * stock.price).toFixed(2);

  const executeTrade = async () => {
    if (!profile) return;
    setIsLoading(true);
    setError(null);

    try {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
      const response = await fetch(`${socketUrl}/api/paper-trading/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          symbol: stock.symbol,
          side,
          quantity: Number(quantity),
          price: stock.price
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Trade failed');
      }

      alert(data.message);
      if (onTradeComplete) onTradeComplete();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content trade-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Trade {stock.symbol}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="trade-body">
          <div className="trade-price-row">
            <span className="live-label">LIVE PRICE</span>
            <span className={`live-price ${stock.change >= 0 ? 'bullish' : 'bearish'}`}>
              ₹{stock.price.toFixed(2)}
            </span>
          </div>

          <div className="trade-sides">
            <button 
              className={`side-btn buy ${side === 'BUY' ? 'active' : ''}`}
              onClick={() => setSide('BUY')}
            >
              BUY
            </button>
            <button 
              className={`side-btn sell ${side === 'SELL' ? 'active' : ''}`}
              onClick={() => setSide('SELL')}
            >
              SELL
            </button>
          </div>

          <div className="trade-input-group">
            <label>Quantity</label>
            <input 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <div className="trade-summary">
            <div className="summary-row">
              <span>Order Value:</span>
              <span>₹{totalCost}</span>
            </div>
          </div>

          {error && <div className="trade-error">{error}</div>}

          <button 
            className={`execute-btn ${side.toLowerCase()}`}
            onClick={executeTrade}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : `Confirm ${side}`}
          </button>
        </div>
      </div>
    </div>
  );
}
