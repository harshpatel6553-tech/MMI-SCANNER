import { useState, useMemo } from 'react';
import { useNews } from '../../hooks/useNews';
import { useStocks } from '../../hooks/useStocks';
import './LiveNewsFeed.css';

export interface LiveNewsFeedProps {
  onStockClick?: (symbol: string) => void;
}

export function LiveNewsFeed({ onStockClick }: LiveNewsFeedProps) {
  const { news, loading, error } = useNews();
  const { allStocks } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'volume', 'desc');
  const [filter, setFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'BLOCK DEAL'>('ALL');
  const [search, setSearch] = useState('');

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSentimentClass = (sentiment?: string) => {
    if (sentiment === 'Bullish') return 'bullish';
    if (sentiment === 'Bearish') return 'bearish';
    if (sentiment === 'Info') return 'info';
    return 'neutral';
  };

  // Stats for Header
  const advancers = allStocks.filter(s => s.change > 0).length;
  const decliners = allStocks.filter(s => s.change < 0).length;
  const total = allStocks.length;
  
  // Nifty/BankNifty for tape (mocked if not found)
  const nifty50 = allStocks.find(s => s.symbol.includes('NIFTY')) || { changePercent: 0.37 };
  const bankNifty = allStocks.find(s => s.symbol.includes('BANK')) || { changePercent: 0.64 };

  const counts = useMemo(() => {
    let bullish = 0, bearish = 0, block = 0;
    news.forEach(n => {
      if (n.sentiment === 'Bullish') bullish++;
      if (n.sentiment === 'Bearish') bearish++;
      if (n.isPromoterAction) block++;
    });
    return { ALL: news.length, BULLISH: bullish, BEARISH: bearish, 'BLOCK DEAL': block };
  }, [news]);

  const filteredNews = useMemo(() => {
    return news.filter(n => {
      // Filter tab
      if (filter === 'BULLISH' && n.sentiment !== 'Bullish') return false;
      if (filter === 'BEARISH' && n.sentiment !== 'Bearish') return false;
      if (filter === 'BLOCK DEAL' && !n.isPromoterAction) return false;
      
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matchesSym = n.affectedStocks?.some(s => s.toLowerCase().includes(q));
        const matchesTitle = n.title.toLowerCase().includes(q);
        if (!matchesSym && !matchesTitle) return false;
      }
      return true;
    });
  }, [news, filter, search]);

  const trending = useMemo(() => {
    const map = new Map<string, { count: number, sentiment: string }>();
    news.forEach(n => {
      if (!n.affectedStocks) return;
      n.affectedStocks.forEach(sym => {
        const existing = map.get(sym);
        let sent = n.sentiment || 'Neutral';
        if (n.isPromoterAction) sent = 'Info';
        if (existing) {
          existing.count++;
          if (sent !== 'Neutral') existing.sentiment = sent; // Keep strongest sentiment
        } else {
          map.set(sym, { count: 1, sentiment: sent });
        }
      });
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
  }, [news]);

  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

  const sourceIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>
    </svg>
  );

  return (
    <div className="live-news-page">
      <div className="tape-wrap">
        <div className="tape mono" id="tape">
          <span><b>NIFTY50</b> <span className={nifty50.changePercent >= 0 ? "up" : "down"}>{nifty50.changePercent >= 0 ? '+' : ''}{nifty50.changePercent.toFixed(2)}%</span></span>
          <span><b>BANKNIFTY</b> <span className={bankNifty.changePercent >= 0 ? "up" : "down"}>{bankNifty.changePercent >= 0 ? '+' : ''}{bankNifty.changePercent.toFixed(2)}%</span></span>
          <span><b>SEBI ORDER FLAGS FII MANIPULATION</b></span>
          <span><b>POWERGRID WINS MASSIVE ORDER</b></span>
          <span><b>RISHABH INSTRUMENTS: PROMOTERS EYE STAKE SALE, BLOCK DEAL</b></span>
          {/* Duplicate for infinite scroll loop */}
          <span><b>NIFTY50</b> <span className={nifty50.changePercent >= 0 ? "up" : "down"}>{nifty50.changePercent >= 0 ? '+' : ''}{nifty50.changePercent.toFixed(2)}%</span></span>
          <span><b>BANKNIFTY</b> <span className={bankNifty.changePercent >= 0 ? "up" : "down"}>{bankNifty.changePercent >= 0 ? '+' : ''}{bankNifty.changePercent.toFixed(2)}%</span></span>
          <span><b>SEBI ORDER FLAGS FII MANIPULATION</b></span>
          <span><b>POWERGRID WINS MASSIVE ORDER</b></span>
          <span><b>RISHABH INSTRUMENTS: PROMOTERS EYE STAKE SALE, BLOCK DEAL</b></span>
        </div>
      </div>

      <header className="live-news-header">
        <div className="eyebrow"><span className="dot"></span> LIVENEWS · {todayStr}</div>
        <h1 className="display">LiveNews</h1>
        <div className="subline mono">
          <b className="up">{advancers}▲</b> advancers vs <b className="down">{decliners}▼</b> decliners across {total} tracked stocks — here's what's moving.
        </div>
      </header>

      <div className="toolbar">
        {(['ALL', 'BULLISH', 'BEARISH', 'BLOCK DEAL'] as const).map(tab => (
          <button 
            key={tab} 
            className={`filter-pill ${filter === tab ? 'active' : ''}`}
            onClick={() => setFilter(tab)}
          >
            {tab} <span className="count">{counts[tab]}</span>
          </button>
        ))}
        <div className="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input 
            placeholder="Search ticker or keyword…" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="layout">
        <main>
          <div className="block-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            <h2 className="display">Breaking Market News</h2>
          </div>
          
          <div className="news-feed">
            {loading && !news.length && <div style={{padding: '20px', color: 'var(--ink-muted)'}}>Loading news...</div>}
            
            {filteredNews.map(item => {
              const sentClass = item.isPromoterAction ? 'info' : getSentimentClass(item.sentiment);
              const sentLabel = item.isPromoterAction ? 'BLOCK DEAL' : (item.sentiment || '').toUpperCase();
              
              return (
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={`news-item ${sentClass}`} 
                  key={item.id}
                >
                  <div className="news-main">
                    <div className="news-meta">
                      <span className="news-time">{formatTime(item.pubDate)}</span>
                      <span className="news-handle">@{item.source || 'REDBOXINDIA'}</span>
                      {sentLabel && (
                        <span className={`news-sentiment ${sentClass}`}>
                          {sentLabel}
                        </span>
                      )}
                    </div>
                    <div className="news-headline">{item.title}</div>
                    
                    {item.affectedStocks && item.affectedStocks.length > 0 && (
                      <div className="news-footer">
                        {sourceIcon}
                        {item.affectedStocks.map(sym => (
                          <span 
                            key={sym} 
                            className="news-chip"
                            onClick={(e) => {
                              e.preventDefault();
                              if (onStockClick) onStockClick(sym);
                            }}
                          >
                            ${sym}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </main>

        <aside>
          <div className="side-card">
            <h3>Sentiment Split</h3>
            {(() => {
              const totalMentions = news.length || 1;
              const b = counts.BULLISH;
              const r = counts.BEARISH;
              const i = counts['BLOCK DEAL'];
              const n = news.length - b - r - i;
              
              const seg = (val: number) => `${((val / totalMentions) * 100).toFixed(0)}%`;
              
              return (
                <>
                  <div className="split-bar">
                    <div className="split-seg bullish" style={{width: seg(b)}}></div>
                    <div className="split-seg bearish" style={{width: seg(r)}}></div>
                    <div className="split-seg info" style={{width: seg(i)}}></div>
                    <div className="split-seg neutral" style={{width: seg(n)}}></div>
                  </div>
                  <div className="split-legend">
                    <div className="row"><span className="lbl"><span className="sw" style={{background:'var(--pulse-green)'}}></span>Bullish</span>{b}</div>
                    <div className="row"><span className="lbl"><span className="sw" style={{background:'var(--pulse-red)'}}></span>Bearish</span>{r}</div>
                    <div className="row"><span className="lbl"><span className="sw" style={{background:'var(--info)'}}></span>Block deal</span>{i}</div>
                    <div className="row"><span className="lbl"><span className="sw" style={{background:'var(--ink-faint)'}}></span>Neutral</span>{n}</div>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="side-card">
            <h3>Trending Tickers</h3>
            <div>
              {trending.map(([sym, d]) => (
                <div className="trend-row" key={sym} onClick={() => onStockClick?.(sym)}>
                  <div className="trend-left">
                    <span className={`trend-dot ${getSentimentClass(d.sentiment)}`}></span>
                    <span className="trend-sym">{sym}</span>
                  </div>
                  <span className="trend-count">{d.count} MENTION{d.count > 1 ? 'S' : ''}</span>
                </div>
              ))}
              {trending.length === 0 && <div style={{fontSize: 12, color: 'var(--ink-muted)'}}>No trending tickers yet.</div>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
