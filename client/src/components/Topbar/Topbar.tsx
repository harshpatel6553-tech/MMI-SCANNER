import React, { useState, useEffect, useMemo } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { CommandSearch } from './CommandSearch';
import type { StockData } from '../../types';
import { ArrowRight } from 'lucide-react';

interface TopbarProps {
  allStocks: StockData[];
}

export function Topbar({ allStocks }: TopbarProps) {
  const { searchQuery, setSearchQuery } = useDashboard();
  const [time, setTime] = useState('');

  const searchItems = useMemo(() => {
    const items = allStocks.map(stock => ({
      id: stock.symbol,
      title: `${stock.symbol} - ${stock.name}`,
      section: (stock.sector || 'Stocks') as any,
      icon: <ArrowRight size={16} />,
      action: () => setSearchQuery(stock.symbol),
    }));
    items.unshift({
      id: 'clear',
      title: 'Clear Search Filter',
      section: 'Actions' as any,
      icon: <ArrowRight size={16} />,
      action: () => setSearchQuery(''),
    });
    return items;
  }, [allStocks, setSearchQuery]);

  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const tick = () => {
      const d = new Date();
      setTime(""+pad(d.getHours())+":"+pad(d.getMinutes())+":"+pad(d.getSeconds())+" IST");
    };
    tick();
    const intv = setInterval(tick, 1000);
    return () => clearInterval(intv);
  }, []);

  const headlines = [
    'LUPIN LIMITED enters exclusive license agreement with Visus Therapeutics for YUVEZZITM in Europe',
    'VIPUL ORGANICS commences production at greenfield facility in Sayakha, Gujarat',
    'DEV INFORMATION TECH secures ₹5.15 Cr order from NICSI for IFMS 3.0',
    'L&T wins large contract valued between ₹25B–50B',
    'UNICOMMERCE & Urban Co expand partnership to UAE & Saudi Arabia'
  ];

  return (
    <header className="topbar">
      <div className="ticker-wrap">
        <span className="ticker-tag">Breaking</span>
        <div className="ticker-track" id="tickerTrack">
          {[...headlines, ...headlines].map((h, i) => (
            <span key={i} className="ticker-item"><span className="sep">●</span>{h}</span>
          ))}
        </div>
      </div>
      <CommandSearch items={searchItems} />
      <div className="topbar-right">
        <div className="market-pill"><span className="dot-live"></span>Market Open</div>
        <div className="clock">{time}</div>
        <div className="icon-btn">
          <span className="badge"></span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>
        </div>
        <div className="avatar">MM</div>
      </div>
    </header>
  );
}
