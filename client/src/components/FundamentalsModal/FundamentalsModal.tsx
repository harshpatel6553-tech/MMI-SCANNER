import React, { useEffect, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { X, TrendingUp, DollarSign, PieChart, Activity, Briefcase } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { StockData } from '../../types';

interface Fundamentals {
  marketCap: string;
  currentPrice: string;
  highLow: string;
  peRatio: string;
  roce: string;
  roe: string;
  bookValue: string;
  dividendYield: string;
  faceValue: string;
}

export function FundamentalsModal({ stocks }: { stocks: StockData[] }) {
  const { selectedStock, setSelectedStock } = useDashboard();
  const [data, setData] = useState<Fundamentals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const stockInfo = stocks.find(s => s.symbol === selectedStock);

  useEffect(() => {
    if (!selectedStock) return;
    let isMounted = true;
    
    setLoading(true);
    setError('');
    
    const API_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
    
    fetch(`${API_URL}/api/stocks/${selectedStock}/fundamentals`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch fundamentals');
        return res.json();
      })
      .then(d => {
        if (isMounted) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [selectedStock]);

  if (!selectedStock) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setSelectedStock(null)}
      >
        <motion.div 
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] shadow-2xl"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] p-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-1)]">{stockInfo?.name || selectedStock}</h2>
              <div className="mt-1 flex items-center gap-3">
                <span className="rounded bg-[var(--bg-primary)] px-2 py-0.5 text-xs font-semibold text-[var(--text-2)] border border-[var(--border)]">
                  {selectedStock}
                </span>
                {stockInfo?.sector && (
                  <span className="text-sm text-[var(--text-2)]">{stockInfo.sector}</span>
                )}
              </div>
            </div>
            <button 
              onClick={() => setSelectedStock(null)}
              className="rounded-full p-2 text-[var(--text-2)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-1)] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="flex h-48 items-center justify-center text-[var(--negative)]">
                <p>Could not load fundamentals for {selectedStock}.</p>
              </div>
            ) : data ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <StatCard title="Market Cap" value={data.marketCap} icon={<Briefcase size={16} />} />
                <StatCard title="Current Price" value={data.currentPrice} icon={<DollarSign size={16} />} />
                <StatCard title="52W High/Low" value={data.highLow} icon={<TrendingUp size={16} />} />
                <StatCard title="Stock P/E" value={data.peRatio} icon={<PieChart size={16} />} />
                <StatCard title="ROCE" value={data.roce} icon={<Activity size={16} />} />
                <StatCard title="ROE" value={data.roe} icon={<Activity size={16} />} />
                <StatCard title="Book Value" value={data.bookValue} icon={<Briefcase size={16} />} />
                <StatCard title="Dividend Yield" value={data.dividendYield} icon={<DollarSign size={16} />} />
                <StatCard title="Face Value" value={data.faceValue} icon={<Briefcase size={16} />} />
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition-colors hover:bg-[var(--bg-surface-hover)]">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[var(--text-2)] uppercase tracking-wider">
        <span className="opacity-70">{icon}</span>
        {title}
      </div>
      <div className="text-lg font-bold text-[var(--text-1)]">{value || 'N/A'}</div>
    </div>
  );
}
