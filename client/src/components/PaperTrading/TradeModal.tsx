import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { StockData } from '../../types';
import './TradeModal.css';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockData;
}

export function TradeModal({ isOpen, onClose, stock }: TradeModalProps) {
  const { profile } = useAuth();
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !stock) return null;

  const parsedQty = typeof quantity === 'string' ? parseFloat(quantity) || 0 : quantity;
  const totalCost = (parsedQty * stock.price).toFixed(2);

  const executeTrade = async () => {
    if (!profile) return;
    if (parsedQty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
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
          quantity: parsedQty,
          price: stock.price
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Trade failed');
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tm-overlay" onClick={onClose}>
      <div className="tm-modal" onClick={e => e.stopPropagation()}>
        <button className="tm-close" onClick={onClose}>&times;</button>

        <div className="tm-header">
          <span className="tm-lbl">LIVE PRICE</span>
          <span className="tm-price">₹{stock.price.toFixed(2)}</span>
        </div>

        <div className="tm-sides">
          <button 
            className={`tm-side-btn buy ${side === 'BUY' ? 'active' : ''}`}
            onClick={() => setSide('BUY')}
          >
            BUY
          </button>
          <button 
            className={`tm-side-btn sell ${side === 'SELL' ? 'active' : ''}`}
            onClick={() => setSide('SELL')}
          >
            SELL
          </button>
        </div>

        <div className="tm-qty-group">
          <label className="tm-qty-lbl">Quantity</label>
          <input 
            type="number" 
            className="tm-qty-input" 
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)}
            min="1"
            autoFocus
          />
        </div>

        <div className="tm-val-row">
          <span className="tm-val-lbl">Order Value:</span>
          <span className="tm-val-num">₹{totalCost}</span>
        </div>

        <button 
          className="tm-submit" 
          onClick={executeTrade}
          disabled={isLoading || parsedQty <= 0}
        >
          {isLoading ? 'Processing...' : `Confirm ${side}`}
        </button>

        {error && <div className="tm-error">{error}</div>}
      </div>
    </div>
  );
}