import { useEffect, useRef, useState } from 'react';
import './StockChart.css';

interface ChartData {
  timestamps: number[];
  close: number[];
  volume: number[];
}

interface StockChartProps {
  symbol: string;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function StockChart({ symbol }: StockChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    price: number;
    date: string;
    volume: number;
  } | null>(null);

  // Fetch chart data
  useEffect(() => {
    setLoading(true);
    setError(null);
    setChartData(null);

    fetch(`${SOCKET_URL}/api/stocks/${encodeURIComponent(symbol)}/chart?range=3mo`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((json) => {
        if (json.success && json.data) {
          const { timestamps, close, volume } = json.data;
          // Filter out null/invalid data points
          const validData: ChartData = { timestamps: [], close: [], volume: [] };
          for (let i = 0; i < timestamps.length; i++) {
            if (close[i] != null && !isNaN(close[i])) {
              validData.timestamps.push(timestamps[i]);
              validData.close.push(close[i]);
              validData.volume.push(volume[i] ?? 0);
            }
          }
          setChartData(validData);
        } else {
          setError('No data available');
        }
      })
      .catch(() => setError('Failed to load chart'))
      .finally(() => setLoading(false));
  }, [symbol]);

  // Render chart
  useEffect(() => {
    if (!chartData || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Padding
    const padTop = 20;
    const padBottom = 30;
    const padLeft = 60;
    const padRight = 20;
    const chartW = W - padLeft - padRight;
    const chartH = H - padTop - padBottom;

    const { close, timestamps } = chartData;
    const minPrice = Math.min(...close) * 0.998;
    const maxPrice = Math.max(...close) * 1.002;
    const priceRange = maxPrice - minPrice || 1;

    const toX = (i: number) => padLeft + (i / (close.length - 1)) * chartW;
    const toY = (price: number) => padTop + (1 - (price - minPrice) / priceRange) * chartH;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(171, 166, 158, 0.06)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padTop + (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(W - padRight, y);
      ctx.stroke();

      // Price labels
      const price = maxPrice - (i / gridLines) * priceRange;
      ctx.fillStyle = '#726e68';
      ctx.font = '11px "Space Grotesk", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('₹' + price.toFixed(0), padLeft - 8, y + 4);
    }

    // Date labels
    ctx.fillStyle = '#726e68';
    ctx.font = '10px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    const dateStep = Math.max(1, Math.floor(timestamps.length / 5));
    for (let i = 0; i < timestamps.length; i += dateStep) {
      const x = toX(i);
      const d = new Date(timestamps[i] * 1000);
      ctx.fillText(
        d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        x,
        H - 6
      );
    }

    // Determine if stock is up overall
    const isUp = close[close.length - 1] >= close[0];
    const lineColor = isUp ? '#10b981' : '#ef4444';
    const gradientTop = isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    const gradientBot = isUp ? 'rgba(16, 185, 129, 0.0)' : 'rgba(239, 68, 68, 0.0)';

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    gradient.addColorStop(0, gradientTop);
    gradient.addColorStop(1, gradientBot);

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(close[0]));
    for (let i = 1; i < close.length; i++) {
      ctx.lineTo(toX(i), toY(close[i]));
    }
    ctx.lineTo(toX(close.length - 1), padTop + chartH);
    ctx.lineTo(toX(0), padTop + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(close[0]));
    for (let i = 1; i < close.length; i++) {
      ctx.lineTo(toX(i), toY(close[i]));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw glow line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(close[0]));
    for (let i = 1; i < close.length; i++) {
      ctx.lineTo(toX(i), toY(close[i]));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.15;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw last price dot
    const lastX = toX(close.length - 1);
    const lastY = toY(close[close.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, [chartData]);

  // Handle hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!chartData || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const padLeft = 60;
    const padRight = 20;
    const chartW = rect.width - padLeft - padRight;

    const idx = Math.round(((mouseX - padLeft) / chartW) * (chartData.close.length - 1));
    if (idx < 0 || idx >= chartData.close.length) {
      setHoveredPoint(null);
      return;
    }

    const padTop = 20;
    const padBottom = 30;
    const chartH = rect.height - padTop - padBottom;
    const minPrice = Math.min(...chartData.close) * 0.998;
    const maxPrice = Math.max(...chartData.close) * 1.002;
    const priceRange = maxPrice - minPrice || 1;

    const x = padLeft + (idx / (chartData.close.length - 1)) * chartW;
    const y = padTop + (1 - (chartData.close[idx] - minPrice) / priceRange) * chartH;

    const d = new Date(chartData.timestamps[idx] * 1000);
    setHoveredPoint({
      x,
      y,
      price: chartData.close[idx],
      date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      volume: chartData.volume[idx],
    });
  };

  const formatVol = (v: number) => {
    if (v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
    if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toString();
  };

  if (loading) {
    return (
      <div className="stock-chart-container">
        <div className="chart-loading">
          <div className="chart-loading-pulse" />
          <span>Loading chart...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stock-chart-container">
        <div className="chart-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="stock-chart-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="stock-chart-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      />
      {hoveredPoint && (
        <>
          {/* Crosshair */}
          <div
            className="chart-crosshair-v"
            style={{ left: `${hoveredPoint.x}px` }}
          />
          <div
            className="chart-crosshair-h"
            style={{ top: `${hoveredPoint.y}px` }}
          />
          {/* Dot */}
          <div
            className="chart-hover-dot"
            style={{ left: `${hoveredPoint.x}px`, top: `${hoveredPoint.y}px` }}
          />
          {/* Tooltip */}
          <div
            className="chart-tooltip"
            style={{
              left: `${Math.min(hoveredPoint.x + 12, (containerRef.current?.getBoundingClientRect().width ?? 500) - 150)}px`,
              top: `${Math.max(hoveredPoint.y - 60, 5)}px`,
            }}
          >
            <div className="chart-tooltip-date">{hoveredPoint.date}</div>
            <div className="chart-tooltip-price">
              ₹{hoveredPoint.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="chart-tooltip-vol">Vol: {formatVol(hoveredPoint.volume)}</div>
          </div>
        </>
      )}
    </div>
  );
}
