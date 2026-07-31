import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShieldAlert, Target, Info, Search } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Deal {
  date: string;
  symbol: string;
  clientName: string;
  type: string; // 'BUY' | 'SELL'
  quantity: number;
  price: number;
}

const API_URL = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000') + '/api';

export const PromoterWatch: React.FC = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredDeals = deals.filter(d => 
    d.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate aggregated stats for the charts based on the filtered deals
  const totalBuyValue = filteredDeals.filter(d => d.type === 'BUY').reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const totalSellValue = filteredDeals.filter(d => d.type === 'SELL').reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  
  // Format data for Bar Chart (Aggregating daily sell values)
  const sellValuePerDay = filteredDeals.filter(d => d.type === 'SELL').reduce((acc, curr) => {
    const val = (curr.price * curr.quantity) / 10000000; // In Crores
    if (!acc[curr.date]) acc[curr.date] = 0;
    acc[curr.date] += val;
    return acc;
  }, {} as Record<string, number>);

  const barChartData = Object.keys(sellValuePerDay).map(date => ({
    date,
    value: parseFloat(sellValuePerDay[date].toFixed(2))
  })).slice(0, 10); // Show top 10 recent dates

  // Format data for Line Chart (Net Institutional Flow over time)
  // For the brutalist UI, we'll simulate a dropping trend line based on selling pressure
  let cumulativeHoldings = 100;
  const lineChartData = barChartData.map(d => {
    cumulativeHoldings -= (d.value * 0.05); // Simulated % drop
    return {
      date: d.date,
      holdings: parseFloat(Math.max(0, cumulativeHoldings).toFixed(2))
    };
  }).reverse();

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className="flex-1 bg-[#0a0a0a] min-h-screen text-gray-300 font-mono overflow-y-auto">
      {/* HEADER */}
      <div className="border-b border-gray-800 p-6 flex flex-col md:flex-row justify-between items-start md:items-end bg-black">
        <div>
          <button className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors mb-4 text-xs uppercase tracking-widest">
            <ArrowLeft className="w-3 h-3" />
            <span>Back</span>
          </button>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-1">
            {searchQuery ? searchQuery : "NSE BULK DEALS"}
          </h1>
          <p className="text-gray-500 text-xs tracking-widest uppercase">
            INSTITUTIONAL & PROMOTER WATCH / REAL-TIME TAPE
          </p>
        </div>

        <div className="flex space-x-8 mt-6 md:mt-0">
          <div className="text-right">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Total Buy Flow</p>
            <p className="text-xl font-bold text-green-500">{formatCurrency(totalBuyValue)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Total Sell Flow</p>
            <p className="text-xl font-bold text-red-500">{formatCurrency(totalSellValue)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Flagged Events</p>
            <p className="text-xl font-bold text-yellow-500">{filteredDeals.length}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input 
            type="text" 
            placeholder="FILTER BY TICKER OR PROMOTER NAME..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111] border border-gray-800 text-white pl-10 pr-4 py-3 focus:outline-none focus:border-red-500 transition-colors text-xs uppercase tracking-widest"
          />
        </div>

        {/* CHARTS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* LINE CHART: HOLDING TREND */}
          <div className="bg-[#111] border border-gray-800 p-4 rounded-sm">
            <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-6">PROMOTER HOLDING TREND (SIMULATED)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="date" stroke="#444" tick={{fill: '#666', fontSize: 10}} tickLine={false} axisLine={false} />
                  <YAxis stroke="#444" tick={{fill: '#666', fontSize: 10}} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '12px' }}
                    itemStyle={{ color: '#ff3333' }}
                  />
                  <Line type="monotone" dataKey="holdings" stroke="#ff3333" strokeWidth={2} dot={{ r: 4, fill: '#ff3333', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* BAR CHART: SELL VALUE */}
          <div className="bg-[#111] border border-gray-800 p-4 rounded-sm">
            <h3 className="text-[10px] text-gray-500 uppercase tracking-widest mb-6">SELL VALUE PER DISCLOSURE (CR)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis dataKey="date" stroke="#444" tick={{fill: '#666', fontSize: 10}} tickLine={false} axisLine={false} />
                  <YAxis stroke="#444" tick={{fill: '#666', fontSize: 10}} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '12px' }}
                    cursor={{fill: '#222'}}
                  />
                  <Bar dataKey="value" fill="#ff3333" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-[#111] border border-gray-800 rounded-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">ALL DISCLOSURES</h2>
            {loading && <span className="text-xs text-red-500 animate-pulse">SYNCING WITH EXCHANGE...</span>}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black/50 text-[10px] text-gray-500 uppercase tracking-widest border-b border-gray-800">
                  <th className="px-6 py-4 font-normal">DATE</th>
                  <th className="px-6 py-4 font-normal">TICKER</th>
                  <th className="px-6 py-4 font-normal">CLIENT / PROMOTER</th>
                  <th className="px-6 py-4 font-normal">TYPE</th>
                  <th className="px-6 py-4 font-normal text-right">QUANTITY</th>
                  <th className="px-6 py-4 font-normal text-right">PRICE</th>
                  <th className="px-6 py-4 font-normal text-right">TOTAL VALUE</th>
                  <th className="px-6 py-4 font-normal text-center">FLAG</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {filteredDeals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-600">
                      NO DEALS FOUND FOR "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredDeals.map((deal, index) => {
                    const isSell = deal.type === 'SELL';
                    const totalValue = deal.quantity * deal.price;
                    
                    return (
                      <tr key={index} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-gray-400">{deal.date}</td>
                        <td className="px-6 py-4 font-bold text-white">{deal.symbol}</td>
                        <td className="px-6 py-4 text-gray-300 max-w-[200px] truncate" title={deal.clientName}>{deal.clientName}</td>
                        <td className={`px-6 py-4 font-bold ${isSell ? 'text-red-500' : 'text-green-500'}`}>
                          {deal.type}
                        </td>
                        <td className="px-6 py-4 text-right">{deal.quantity.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono">₹{deal.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-bold text-gray-300">
                          {formatCurrency(totalValue)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isSell && totalValue > 100000000 ? (
                            <span className="inline-block bg-red-500/20 text-red-500 border border-red-500/30 px-2 py-1 text-[9px] rounded-sm uppercase tracking-widest font-bold">
                              HEAVY DUMP
                            </span>
                          ) : isSell ? (
                            <span className="inline-block bg-orange-500/20 text-orange-500 border border-orange-500/30 px-2 py-1 text-[9px] rounded-sm uppercase tracking-widest font-bold">
                              STAKE SALE
                            </span>
                          ) : (
                            <span className="inline-block bg-green-500/20 text-green-500 border border-green-500/30 px-2 py-1 text-[9px] rounded-sm uppercase tracking-widest font-bold">
                              ACCUMULATION
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
