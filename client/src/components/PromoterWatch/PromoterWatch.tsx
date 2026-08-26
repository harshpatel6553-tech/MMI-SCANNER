import React, { useEffect, useState, useMemo } from 'react';
import { Search, Lock } from 'lucide-react';
import { useStocks } from '../../hooks/useStocks';
import './PromoterWatch.css';

interface Deal {
  date: string;
  symbol: string;
  clientName: string;
  type: string; // 'BUY' | 'SELL'
  quantity: number;
  price: number;
}

const API_URL = (import.meta.env.VITE_SOCKET_URL || window.location.origin) + '/api';

export const PromoterWatch: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { allStocks } = useStocks({ index: 'ALL', priceMin: 0, priceMax: 0, volumeMin: 0, search: '' }, 'symbol', 'asc');
  const advancers = allStocks.filter(s => s.change >= 0).length;
  const decliners = allStocks.length - advancers;

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/deals/bulk`);
      const data = await res.json();
      if (data.status === 'success') {
        setDeals(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDeals = useMemo(() => {
    return deals.filter(d => 
      d.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
      d.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [deals, searchQuery]);

  const totalBuyValue = filteredDeals.filter(d => d.type === 'BUY').reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const totalSellValue = filteredDeals.filter(d => d.type === 'SELL').reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const netFlow = totalBuyValue - totalSellValue;

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `\u20B9${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `\u20B9${(val / 100000).toFixed(2)} L`;
    return `\u20B9${val.toLocaleString()}`;
  };

  const linePoints = [3,4,4,5,6,6,7,8,9,9,10,11,12,13,14];
  const lw = 320, lh = 90, lpad = 8;
  const lMax = Math.max(...linePoints), lMin = Math.min(...linePoints);
  const lineCoords = linePoints.map((p,i) => {
    const x = lpad + (i/(linePoints.length-1))*(lw-2*lpad);
    const y = lh - lpad - ((p-lMin)/(lMax-lMin||1))*(lh-2*lpad);
    return [x, y];
  });
  const linePath = lineCoords.map(c => c.join(',')).join(' L ');
  const areaPath = `M ${lineCoords[0][0]},${lh-lpad} L ${linePath.replace('L ','')} L ${lineCoords[lineCoords.length-1][0]},${lh-lpad} Z`;

  const barDays = ['12','13','14','15','16','17','18','19','20'];
  const barVals = [120,-45,80,210,-95,150,40,-60,230];
  const bw = 320, bh = 90, base = bh/2, bpad = 6;
  const maxAbs = Math.max(...barVals.map(Math.abs));
  const barWidth = (bw - 2*bpad) / barVals.length;

  return (
    <div className="promoter-page" style={{paddingTop: '0', marginTop: '-24px'}}>
      <div className="page" style={{paddingTop: '0'}}>

        <div className="page-title-row">
          <div>
            <h2 className="display">NSE Bulk Deals</h2>
            <div className="sub">INSTITUTIONAL &amp; PROMOTER WATCH Â· REAL-TIME</div>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="label">Total Buy Value</div>
            <div className="value up">{formatCurrency(totalBuyValue)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Sell Value</div>
            <div className="value down">{formatCurrency(totalSellValue)}</div>
          </div>
          <div className="stat-card">
            <div className="label">Net Flow</div>
            <div className={`value ${netFlow >= 0 ? 'up' : 'down'}`}>
              {netFlow >= 0 ? '+' : 'âˆ’'}{formatCurrency(Math.abs(netFlow))}
            </div>
          </div>
          <div className="stat-card">
            <div className="label">Total Disclosures</div>
            <div className="value neutral">{filteredDeals.length}</div>
          </div>
        </div>

        <div className="search-box">
          <Search size={14} />
          <input 
            placeholder="Filter by ticker or promoter name..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="chart-grid">
          <div className="chart-card">
            <div className="ctitle">Promoter Disclosures â€” Cumulative (30 Days)</div>
            <svg viewBox={`0 0 ${lw} ${lh + 30}`} width="100%" height="120">
              <defs>
                <linearGradient id="fadeGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#22C55E" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <path d={areaPath} fill="url(#fadeGreen)"/>
              <path d={`M ${linePath}`} fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx={lineCoords[lineCoords.length-1][0]} cy={lineCoords[lineCoords.length-1][1]} r="3" fill="#22C55E"/>
              <text x={lpad} y={lh+12} className="axis-lbl">21 JUL</text>
              <text x={lw/2-14} y={lh+12} className="axis-lbl">05 AUG</text>
              <text x={lw-46} y={lh+12} className="axis-lbl">20 AUG</text>
            </svg>
          </div>
          
          <div className="chart-card">
            <div className="ctitle">Net Promoter Flow by Day (₹ Cr)</div>
            <svg viewBox={`0 0 ${bw} ${bh + 30}`} width="100%" height="120">
              <line x1="0" y1={base} x2={bw} y2={base} stroke="#262626" strokeWidth="1"/>
              {barVals.map((v, i) => {
                const bheight = (Math.abs(v)/maxAbs) * (base-14);
                const x = bpad + i*barWidth + barWidth*0.22;
                const bW = barWidth*0.56;
                const y = v >= 0 ? base - bheight : base;
                const color = v >= 0 ? '#22C55E' : '#EF4444';
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={bW} height={bheight} rx="1.5" fill={color} />
                    <text x={x+bW/2} y={bh+11} textAnchor="middle" className="axis-lbl">{barDays[i]}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="block-title">
          <h3 className="display">All Disclosures</h3>
          <span className="count-badge">{filteredDeals.length} SHOWN OF {deals.length}</span>
        </div>
        
        <div className="table-wrap">
          <div className="dt-row head">
            <span>Date</span><span>Ticker</span><span>Client / Promoter</span><span>Type</span>
            <span style={{textAlign: 'right'}}>Qty</span><span style={{textAlign: 'right'}}>Price</span>
            <span style={{textAlign: 'right'}}>Value</span><span>Access</span>
          </div>
          
          {loading ? (
             <div style={{padding: '24px', textAlign: 'center', color: 'var(--ink-muted)'}}>Loading deals...</div>
          ) : filteredDeals.length === 0 ? (
             <div style={{padding: '24px', textAlign: 'center', color: 'var(--ink-muted)'}}>No deals found.</div>
          ) : (
            filteredDeals.map((r, idx) => (
              <div className="dt-row" key={idx}>
                <span className="dt-date">{r.date}</span>
                <span className="dt-ticker">{r.symbol}</span>
                <span className="dt-client" title={r.clientName}>{r.clientName}</span>
                <span className={`dt-type ${r.type.toLowerCase()}`}>{r.type.toUpperCase()}</span>
                <span className="dt-num">{r.quantity.toLocaleString()}</span>
                <span className="dt-num">₹{r.price.toFixed(2)}</span>
                <span className="dt-num">{formatCurrency(r.quantity * r.price)}</span>
                <span className="dt-access"><Lock size={10} /> UNLOCK</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
