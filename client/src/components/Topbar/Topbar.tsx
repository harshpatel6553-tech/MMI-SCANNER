import React, { useState, useEffect, useMemo } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { CommandSearch } from './CommandSearch';
import { HeaderIndices } from './HeaderIndices';
import { useIndices } from '../../hooks/useIndices';
import type { StockData } from '../../types';
import { ArrowRight, Volume2, VolumeX, Bell } from 'lucide-react';
import { isMarketOpen } from '../../utils/marketHours';
import { audioAlerts } from '../../utils/audioAlerts';
import { CyberIcon } from '../common/CyberIcon';

interface TopbarProps {
  allStocks: StockData[];
  alertCount?: number;
}

function getMarketCountdown(isOpen: boolean): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 3600000 * 5.5);
  const curMins = ist.getHours() * 60 + ist.getMinutes();
  
  if (isOpen) {
    const closeMins = 15 * 60 + 30; // 15:30 IST
    const diff = closeMins - curMins;
    if (diff <= 0) return 'CLOSING NOW';
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return hrs > 0 ? `CLOSES IN ${hrs}H ${mins}M` : `CLOSES IN ${mins}M`;
  } else {
    return 'OPENS AT 09:15 AM';
  }
}

export function Topbar({ allStocks, alertCount }: TopbarProps) {
  const { searchQuery, setSearchQuery, setSelectedStock, activeTab, setChartSymbol, isAlertPanelOpen, setIsAlertPanelOpen } = useDashboard();
  const { nifty50, bankNifty } = useIndices(allStocks);
  const [time, setTime] = useState('');
  const [isMuted, setIsMuted] = useState(audioAlerts.getIsMuted());

  const searchItems = useMemo(() => {
    const items = allStocks.map(stock => ({
      id: stock.symbol,
      title: `${stock.symbol} - ${stock.name}`,
      section: (stock.sector || 'Stocks') as any,
      icon: <ArrowRight size={16} />,
      action: () => {
        audioAlerts.playHapticClick();
        if (activeTab === 'Charts') {
          setChartSymbol(stock.symbol);
        } else {
          setSelectedStock(stock.symbol);
        }
      },
    }));
    items.unshift({
      id: 'clear',
      title: 'Clear Search Filter',
      section: 'Actions' as any,
      icon: <ArrowRight size={16} />,
      action: () => {
        audioAlerts.playHapticClick();
        setSearchQuery('');
      },
    });
    return items;
  }, [allStocks, setSearchQuery, setSelectedStock, activeTab, setChartSymbol]);

  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const tick = () => {
      const d = new Date();
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} IST`);
    };
    tick();
    const intv = setInterval(tick, 1000);
    return () => clearInterval(intv);
  }, []);

  const [marketOpen, setMarketOpen] = useState(isMarketOpen());
  useEffect(() => {
    const intv = setInterval(() => setMarketOpen(isMarketOpen()), 10000);
    return () => clearInterval(intv);
  }, []);

  // Compute live tape sentiment
  const advancers = allStocks.filter(s => s.change >= 0).length;
  const total = allStocks.length || 1;
  const bullPct = Math.round((advancers / total) * 100);

  const handleSoundToggle = () => {
    const muted = audioAlerts.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      audioAlerts.playBreakoutChime();
    }
  };

  return (
    <header className="topbar">
      {/* Live NIFTY 50 & BANK NIFTY Indices Telemetry (Replaces Breaking News) */}
      <HeaderIndices nifty50={nifty50} bankNifty={bankNifty} />

      {/* Global Command Search */}
      <CommandSearch items={searchItems} />

      {/* Right Controls & Telemetry */}
      <div className="topbar-right">
        {/* Dynamic Tape Sentiment Pill */}
        <div 
          className="market-pill beast-sentiment-pill" 
          title={`${advancers} advancers vs ${total - advancers} decliners`}
          style={{
            background: bullPct >= 50 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            borderColor: bullPct >= 50 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)',
            color: bullPct >= 50 ? 'var(--up)' : 'var(--down)',
          }}
        >
          <CyberIcon name={bullPct >= 50 ? 'bull' : 'bear'} size={18} />
          <span className="tabular-nums" style={{ fontWeight: 800 }}>{bullPct}% {bullPct >= 50 ? 'BULL' : 'BEAR'}</span>
        </div>

        {/* Live Market Status Pill */}
        {marketOpen ? (
          <div className="market-pill">
            <span className="dot-live"></span>
            <span>LIVE · {getMarketCountdown(true)}</span>
          </div>
        ) : (
          <div className="market-pill closed">
            <span className="dot-closed"></span>
            <span>CLOSED · {getMarketCountdown(false)}</span>
          </div>
        )}

        {/* Digital Precision Clock */}
        <div className="clock tabular-nums">{time}</div>

        {/* Audio Alerts Synthesizer Toggle */}
        <div 
          className={`icon-btn ${!isMuted ? 'active-audio' : ''}`}
          onClick={handleSoundToggle}
          title={isMuted ? "Sound Alerts Muted — Click to Enable" : "Sound Alerts Active — Click to Mute"}
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          {isMuted ? (
            <VolumeX size={16} color="var(--text-3)" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Volume2 size={16} color="var(--up)" />
            </div>
          )}
        </div>

        {/* Live Alerts Drawer Button */}
        <div 
          className="icon-btn"
          onClick={() => {
            audioAlerts.playHapticClick();
            setIsAlertPanelOpen(!isAlertPanelOpen);
          }}
          title="Toggle Radar Alerts Drawer"
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          {alertCount !== undefined && alertCount > 0 && (
            <span style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '10px', 
              minWidth: '17px', 
              height: '17px', 
              padding: '0 4px', 
              background: 'var(--down)', 
              color: '#fff', 
              borderRadius: '9999px', 
              position: 'absolute', 
              top: '-4px', 
              right: '-4px', 
              fontWeight: '800',
              boxShadow: '0 0 10px rgba(244, 63, 94, 0.7)'
            }}>
              {alertCount > 99 ? '99+' : alertCount}
            </span>
          )}
          <Bell size={16} />
        </div>
      </div>
    </header>
  );
}
