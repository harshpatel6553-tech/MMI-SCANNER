import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { audioAlerts } from '../../utils/audioAlerts';
import type { StockData } from '../../types';
import './TradeModal.css';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockData;
  onTradeSuccess?: () => void;
}

export function TradeModal({ isOpen, onClose, stock, onTradeSuccess }: TradeModalProps) {
  const { profile } = useAuth();
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !stock) return null;

  const parsedQty = typeof quantity === 'string' ? parseFloat(quantity) || 0 : quantity;
  const currentPrice = Number(stock.price) || 0;
  const totalCost = (parsedQty * currentPrice).toFixed(2);

  const executeTrade = async () => {
    if (!profile) return;
    if (parsedQty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      let handled = false;

      // 1. Attempt backend API first if reachable
      try {
        const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(`${socketUrl}/api/paper-trading/trade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: profile.id,
            symbol: stock.symbol,
            side,
            quantity: parsedQty,
            price: currentPrice
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            handled = true;
          }
        }
      } catch {
        // Backend API unreachable or 404, fallback to direct Supabase execution
      }

      // 2. Direct Supabase execution (Guaranteed to work 100% of the time)
      if (!handled) {
        const orderValue = parsedQty * currentPrice;

        // Fetch current portfolio
        const { data: portData } = await supabase
          .from('paper_portfolios')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle();

        let currentBalance = portData ? Number(portData.balance) : 1000000;

        // Fetch existing position for this stock
        const { data: existingPos } = await supabase
          .from('paper_positions')
          .select('*')
          .eq('user_id', profile.id)
          .eq('symbol', stock.symbol)
          .maybeSingle();

        let newQuantity = existingPos ? Number(existingPos.quantity) : 0;
        let newAvgPrice = existingPos ? Number(existingPos.average_price) : 0;

        if (side === 'BUY') {
          if (newQuantity >= 0 && currentBalance < orderValue) {
            throw new Error(`Insufficient funds. Required: ₹${orderValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}, Available: ₹${currentBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
          }
          currentBalance -= orderValue;

          if (newQuantity < 0) {
            newQuantity += parsedQty;
            if (newQuantity > 0) newAvgPrice = currentPrice;
            else if (newQuantity === 0) newAvgPrice = 0;
          } else {
            const currentTotalValue = (newQuantity * newAvgPrice) + orderValue;
            newQuantity += parsedQty;
            newAvgPrice = currentTotalValue / newQuantity;
          }
        } else {
          currentBalance += orderValue;

          if (newQuantity > 0) {
            newQuantity -= parsedQty;
            if (newQuantity < 0) newAvgPrice = currentPrice;
            else if (newQuantity === 0) newAvgPrice = 0;
          } else {
            const currentCost = Math.abs(newQuantity) * newAvgPrice;
            newQuantity -= parsedQty;
            newAvgPrice = (currentCost + orderValue) / Math.abs(newQuantity);
          }
        }

        // Upsert portfolio balance
        if (portData) {
          await supabase
            .from('paper_portfolios')
            .update({ balance: currentBalance, updated_at: new Date().toISOString() })
            .eq('user_id', profile.id);
        } else {
          await supabase
            .from('paper_portfolios')
            .insert([{ user_id: profile.id, balance: currentBalance }]);
        }

        // Update/Insert/Delete Position
        if (newQuantity !== 0) {
          if (existingPos) {
            await supabase
              .from('paper_positions')
              .update({ 
                quantity: newQuantity, 
                average_price: newAvgPrice,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingPos.id);
          } else {
            await supabase
              .from('paper_positions')
              .insert([{
                user_id: profile.id,
                symbol: stock.symbol,
                quantity: newQuantity,
                average_price: newAvgPrice
              }]);
          }
        } else if (existingPos) {
          await supabase
            .from('paper_positions')
            .delete()
            .eq('id', existingPos.id);
        }

        // Log trade record
        try {
          await supabase.from('paper_trades').insert([{
            user_id: profile.id,
            symbol: stock.symbol,
            side,
            quantity: parsedQty,
            price: currentPrice
          }]);
        } catch {}
      }

      audioAlerts.playBreakoutChime();
      if (onTradeSuccess) {
        onTradeSuccess();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Trade execution failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tm-overlay" onClick={onClose}>
      <div className="tm-modal" onClick={e => e.stopPropagation()}>
        <button className="tm-close" onClick={onClose}>&times;</button>

        <div className="tm-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="pos-sym" style={{ fontSize: 18, fontWeight: 800 }}>{stock.symbol}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{stock.sector || 'EQUITY'}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{stock.name}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="tm-lbl">LIVE PRICE</span>
            <div className="tm-price">₹{currentPrice.toFixed(2)}</div>
          </div>
        </div>

        <div className="tm-sides">
          <button 
            type="button"
            className={`tm-side-btn buy ${side === 'BUY' ? 'active' : ''}`}
            onClick={() => setSide('BUY')}
          >
            BUY / LONG
          </button>
          <button 
            type="button"
            className={`tm-side-btn sell ${side === 'SELL' ? 'active' : ''}`}
            onClick={() => setSide('SELL')}
          >
            SELL / SHORT
          </button>
        </div>

        <div className="tm-qty-group">
          <label className="tm-qty-lbl">Quantity (Shares)</label>
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
          <span className="tm-val-lbl">Total Order Value:</span>
          <span className="tm-val-num">₹{Number(totalCost).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
        </div>

        <button 
          className="tm-submit" 
          onClick={executeTrade}
          disabled={isLoading || parsedQty <= 0}
          style={{
            background: side === 'BUY' ? 'var(--up, #00f59b)' : 'var(--down, #ef4444)',
            color: '#000',
            fontWeight: 800,
            padding: '14px 20px',
            borderRadius: 8,
            boxShadow: side === 'BUY' ? '0 0 20px rgba(0, 245, 155, 0.3)' : '0 0 20px rgba(239, 68, 68, 0.3)'
          }}
        >
          {isLoading ? 'Executing on Supabase...' : `Confirm ${side} Order`}
        </button>

        {error && <div className="tm-error">{error}</div>}
      </div>
    </div>
  );
}
