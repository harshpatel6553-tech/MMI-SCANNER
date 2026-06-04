import React from 'react';
import type { StockData } from '../../types';
import { formatPrice, formatVolume, formatPercent, getChangeClass } from '../../utils/formatters';

interface StockRowProps {
  stock: StockData;
  index: number;
  flash: 'up' | 'down' | null;
  isNew: boolean;
}

export const StockRow = React.memo(function StockRow({ stock, index, flash, isNew }: StockRowProps) {
  const changeClass = getChangeClass(stock.change);
  const rowClasses = [
    'stock-row',
    flash === 'up' ? 'flash-up' : '',
    flash === 'down' ? 'flash-down' : '',
    isNew ? 'row-enter' : '',
    stock.atDayHigh ? 'at-day-high' : '',
    stock.atDayLow ? 'at-day-low' : '',
  ].filter(Boolean).join(' ');

  return (
    <tr
      className={rowClasses}
      style={isNew ? { animationDelay: `${index * 30}ms` } : undefined}
    >
      <td className="cell-index">{index + 1}</td>
      <td className="cell-symbol">{stock.symbol}</td>
      <td className="cell-name" title={stock.name}>{stock.name}</td>
      <td className={`cell-price ${changeClass}`}>{formatPrice(stock.price)}</td>
      <td className={`cell-change ${changeClass}`}>
        <span className="change-arrow">{stock.change > 0 ? '▲' : stock.change < 0 ? '▼' : '—'}</span>
        {formatPrice(Math.abs(stock.change))}
      </td>
      <td className="cell-pct">
        <span className={`pct-badge ${changeClass}`}>
          {formatPercent(stock.changePercent)}
        </span>
      </td>
      <td className={`cell-high ${stock.atDayHigh ? 'at-value' : ''}`}>
        {stock.atDayHigh && <span className="day-high-indicator" />}
        {formatPrice(stock.dayHigh)}
      </td>
      <td className={`cell-low ${stock.atDayLow ? 'at-value' : ''}`}>
        {stock.atDayLow && <span className="day-low-indicator" />}
        {formatPrice(stock.dayLow)}
      </td>
      <td className="cell-volume">{formatVolume(stock.volume)}</td>
    </tr>
  );
});
