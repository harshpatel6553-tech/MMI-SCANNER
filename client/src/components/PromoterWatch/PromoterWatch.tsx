import React from 'react';
import { SmartMoneyTerminal } from '../SmartMoney/SmartMoneyTerminal';
import type { StockData } from '../../types';

export const PromoterWatch: React.FC<{ stocks?: StockData[] }> = ({ stocks }) => {
  return <SmartMoneyTerminal stocks={stocks} />;
};

export default PromoterWatch;
