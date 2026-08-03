import React, { useEffect } from 'react';
import { ShieldAlert, X } from 'lucide-react';

export interface WhaleAlertProps {
  id: string;
  symbol: string;
  price: number;
  quantity: number;
  totalValue: number;
  timestamp: string;
  isLargeCap: boolean;
  onClose: (id: string) => void;
}

export const WhaleAlertToast: React.FC<WhaleAlertProps> = ({
  id,
  symbol,
  price,
  quantity,
  totalValue,
  isLargeCap,
  onClose
}) => {
  // Auto close after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 8000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} L`;
    return `₹${val.toLocaleString()}`;
  };

  return (
    <div className="relative overflow-hidden bg-black border-2 border-red-500 p-4 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-in slide-in-from-right fade-in duration-300 w-80">
      <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-[shrink_8s_linear_forwards]" />
      
      <button 
        onClick={() => onClose(id)} 
        className="absolute top-2 right-2 text-gray-500 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start space-x-3">
        <div className="mt-1 flex-shrink-0 animate-pulse text-red-500">
          <ShieldAlert className="w-5 h-5" />
        </div>
        
        <div className="flex-1 font-mono">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] uppercase tracking-widest bg-red-500/20 text-red-500 px-1 py-0.5 border border-red-500/30">
              WHALE DETECTED
            </span>
            <span className="text-[10px] text-gray-500">{isLargeCap ? 'LARGE CAP' : 'S/M CAP'}</span>
          </div>
          
          <h4 className="text-xl font-black text-white uppercase tracking-tighter">{symbol}</h4>
          
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">LTQ</span>
              <span className="text-white">{quantity.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">LTP</span>
              <span className="text-white">₹{price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-800">
              <span className="text-gray-400 font-bold">TOTAL</span>
              <span className="text-red-500 font-bold">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};
