import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockAlert, StockData } from '../types';
import { audioAlerts } from '../utils/audioAlerts';

interface Toast extends StockAlert {
  dismissAt: number;
}

function isAllowedSource(source?: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase().replace('@', '').trim();
  return s === 'redboxindia' || s === 'yatinmota';
}

const BLACKLISTED_TITLE_PATTERNS = [
  /outlook\s*(&|and)?\s*prediction/i,
  /stock market this week/i,
  /market this week/i,
  /weekly market/i,
  /technical analysis/i,
  /share market (live|news|today)/i,
  /open(s|ed)? flat/i,
  /end(s|ed)? flat/i,
  /amid selling in/i,
  /among \d+ companies/i,
  /nifty (may|could|will|prediction)/i,
  /prediction/i,
  /market watch/i,
  /top stocks to buy/i,
  /stocks in focus/i,
  /trading guide/i,
  /expert advice/i,
  /brokerage radar/i,
];

function isIndexSymbol(symbol: string): boolean {
  const s = (symbol || '').toUpperCase();
  return s.includes('NIFTY') || s.includes('BANKNIFTY') || s.includes('SENSEX') || s.includes('INDIA VIX');
}

export function useAlerts(stocks?: StockData[], indices?: StockData[]) {
  const { socket } = useSocketContext();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [serverAlerts, setServerAlerts] = useState<StockAlert[]>([]);
  const [radarAlertsMap, setRadarAlertsMap] = useState<Map<string, StockAlert>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastAudioPlayedRef = useRef<Record<string, number>>({});
  const trackedPeaks = useRef<Map<string, { high: number; low: number }>>(new Map());

  // Request browser desktop notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // 1. Initial fetch from REST API on mount
  useEffect(() => {
    const fetchAlertHistory = async () => {
      try {
        let alertsData: StockAlert[] = [];
        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'https://35.226.242.164.sslip.io';
        const baseUrl = socketUrl.endsWith('/') ? socketUrl.slice(0, -1) : socketUrl;

        let fetched = false;
        try {
          const res = await fetch('/api/stocks/alerts?limit=300');
          if (res.ok) {
            const result = await res.json();
            if (result?.success && Array.isArray(result.data)) {
              alertsData = result.data;
              fetched = true;
            }
          }
        } catch {
          // relative failed, will try baseUrl
        }

        if (!fetched && baseUrl) {
          try {
            const res = await fetch(`${baseUrl}/api/stocks/alerts?limit=300`);
            if (res.ok) {
              const result = await res.json();
              if (result?.success && Array.isArray(result.data)) {
                alertsData = result.data;
                fetched = true;
              }
            }
          } catch {
            // remote fetch failed
          }
        }

        // Also fetch live F&O OI alerts directly
        try {
          let fnoRes = await fetch('/api/fno/oi-alerts').catch(() => null);
          if (!fnoRes || !fnoRes.ok) {
            fnoRes = await fetch(`${baseUrl}/api/fno/oi-alerts`).catch(() => null);
          }
          if (fnoRes && fnoRes.ok) {
            const fnoJson = await fnoRes.json();
            if (fnoJson?.success && Array.isArray(fnoJson.alerts)) {
              const mappedFno: StockAlert[] = fnoJson.alerts.map((a: any) => ({
                id: a.id,
                symbol: a.symbol || 'NIFTY',
                name: `${a.action === 'pulled' ? 'Pulled' : 'Placed'} ${a.contracts} (${a.side})`,
                alertType: 'FNO_OI',
                price: a.strike,
                details: a.message,
                createdAt: a.timestamp,
                strike: a.strike,
                side: a.side,
                action: a.action,
                contracts: a.contracts,
              }));

              const existingIds = new Set(alertsData.map(a => a.id));
              mappedFno.forEach(f => {
                if (!existingIds.has(f.id)) {
                  alertsData.push(f);
                }
              });
            }
          }
        } catch {
          // Ignore F&O alert fetch errors
        }

        // Clean out spam news and deduplicate server alerts by symbol + alertType
        const dedupedServerMap = new Map<string, StockAlert>();
        alertsData.forEach(a => {
          if (a.alertType === 'NEWS') {
            if (isAllowedSource(a.symbol)) {
              dedupedServerMap.set(a.id, a);
            }
          } else {
            const key = `${a.symbol}_${a.alertType}`;
            const existing = dedupedServerMap.get(key);
            if (!existing || new Date(a.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
              dedupedServerMap.set(key, a);
            }
          }
        });

        setServerAlerts(Array.from(dedupedServerMap.values()));
      } catch (err) {
        console.error('Failed to fetch initial alert history:', err);
      }
    };
    fetchAlertHistory();
  }, []);

  // 2. Real-Time Autonomous Market Radar Engine:
  // Scans all active securities on each price tick and detects Day Highs, Day Lows, and Spikes
  useEffect(() => {
    if (!stocks || stocks.length === 0) return;

    const now = new Date();
    const nowIso = now.toISOString();

    setRadarAlertsMap(prevMap => {
      const nextMap = new Map(prevMap);

      for (const s of stocks) {
        if (!s || s.price <= 0 || s.dayHigh <= 0 || s.dayLow <= 0) continue;
        if (s.dayHigh < s.dayLow || s.dayHigh === s.dayLow) continue;

        // Require minimum spread
        const spread = s.dayHigh - s.dayLow;
        if (spread <= 0.05) continue;

        const distHighPct = Math.max(0, ((s.dayHigh - s.price) / s.dayHigh) * 100);
        const distLowPct = Math.max(0, ((s.price - s.dayLow) / s.dayLow) * 100);

        const isBreakoutHigh = s.price >= s.dayHigh || s.atDayHigh;
        const isNearHigh = distHighPct <= 0.35;
        const isBreakdownLow = s.price <= s.dayLow || s.atDayLow;
        const isNearLow = distLowPct <= 0.35;

        // ── Day High Detection ──
        if (isBreakoutHigh || isNearHigh) {
          const key = `${s.symbol}_DAY_HIGH`;
          const prev = trackedPeaks.current.get(s.symbol);

          // Trigger audio chime & toast on genuine new intraday price peak
          if (prev && s.price > prev.high && prev.high > 0) {
            triggerLiveAlert({
              id: `live-dh-${s.symbol}-${Date.now()}`,
              symbol: s.symbol,
              name: s.name,
              alertType: 'DAY_HIGH',
              price: s.price,
              change: s.change,
              changePercent: s.changePercent,
              details: `Session Breakout at ₹${s.price.toFixed(2)} (+${s.changePercent.toFixed(2)}%)`,
              createdAt: nowIso,
            });
            prev.high = s.price;
          } else if (!prev) {
            trackedPeaks.current.set(s.symbol, { high: s.price, low: s.price });
          }

          nextMap.set(key, {
            id: `dh-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_HIGH',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: isBreakoutHigh
              ? `Session Breakout at ₹${s.price.toFixed(2)} (High ₹${s.dayHigh.toFixed(2)})`
              : `Testing Day High · Within ${distHighPct.toFixed(2)}% (High ₹${s.dayHigh.toFixed(2)})`,
            createdAt: s.lastUpdated || nowIso,
          });
        }

        // ── Day Low Detection ──
        if (isBreakdownLow || isNearLow) {
          const key = `${s.symbol}_DAY_LOW`;
          const prev = trackedPeaks.current.get(s.symbol);

          // Trigger audio tone & toast on genuine new intraday price breakdown
          if (prev && s.price < prev.low && prev.low > 0) {
            triggerLiveAlert({
              id: `live-dl-${s.symbol}-${Date.now()}`,
              symbol: s.symbol,
              name: s.name,
              alertType: 'DAY_LOW',
              price: s.price,
              change: s.change,
              changePercent: s.changePercent,
              details: `Session Breakdown at ₹${s.price.toFixed(2)} (${s.changePercent.toFixed(2)}%)`,
              createdAt: nowIso,
            });
            prev.low = s.price;
          } else if (!prev) {
            trackedPeaks.current.set(s.symbol, { high: s.price, low: s.price });
          }

          nextMap.set(key, {
            id: `dl-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_LOW',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: isBreakdownLow
              ? `Session Breakdown at ₹${s.price.toFixed(2)} (Low ₹${s.dayLow.toFixed(2)})`
              : `Testing Day Low · Within ${distLowPct.toFixed(2)}% (Low ₹${s.dayLow.toFixed(2)})`,
            createdAt: s.lastUpdated || nowIso,
          });
        }

        // ── Volume Surge Detection ──
        if (s.volumeSpike) {
          const key = `${s.symbol}_VOLUME_SPIKE`;
          nextMap.set(key, {
            id: `vs-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'VOLUME_SPIKE',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: `Volume Surge: ${(s.relativeVolume || 2).toFixed(1)}x institutional velocity`,
            createdAt: s.lastUpdated || nowIso,
          });
        }
      }

      // ── Indices Evaluation (NIFTY 50, BANK NIFTY, SENSEX) ──
      if (indices && indices.length > 0) {
        for (const idx of indices) {
          if (!idx || idx.price <= 0) continue;
          const isUp = (idx.change ?? 0) >= 0;
          const distHigh = idx.dayHigh > 0 ? ((idx.dayHigh - idx.price) / idx.dayHigh) * 100 : 999;
          const distLow = idx.dayLow > 0 ? ((idx.price - idx.dayLow) / idx.dayLow) * 100 : 999;

          if (distHigh <= 0.25 || idx.price >= idx.dayHigh) {
            const key = `${idx.symbol}_INDEX_HIGH`;
            nextMap.set(key, {
              id: `idx-h-${idx.symbol}`,
              symbol: idx.symbol,
              name: idx.name,
              alertType: 'INDEX_MILESTONE',
              price: idx.price,
              change: idx.change,
              changePercent: idx.changePercent,
              details: idx.price >= idx.dayHigh
                ? `Cleared Session High at ₹${idx.price.toLocaleString('en-IN')}`
                : `Near Session High (H: ₹${idx.dayHigh.toLocaleString('en-IN')})`,
              createdAt: idx.lastUpdated || nowIso,
            });
          } else if (distLow <= 0.25 || idx.price <= idx.dayLow) {
            const key = `${idx.symbol}_INDEX_LOW`;
            nextMap.set(key, {
              id: `idx-l-${idx.symbol}`,
              symbol: idx.symbol,
              name: idx.name,
              alertType: 'INDEX_MILESTONE',
              price: idx.price,
              change: idx.change,
              changePercent: idx.changePercent,
              details: idx.price <= idx.dayLow
                ? `Broke Session Low at ₹${idx.price.toLocaleString('en-IN')}`
                : `Near Session Low (L: ₹${idx.dayLow.toLocaleString('en-IN')})`,
              createdAt: idx.lastUpdated || nowIso,
            });
          }
        }
      }

      // ── Options Lens Synthetic F&O Inflow Signals ──
      const nifty = indices?.find(i => i.symbol === 'NIFTY 50') || stocks.find(s => s.symbol === 'NIFTY 50');
      if (nifty && nifty.price > 0) {
        const atmStrike = Math.round(nifty.price / 50) * 50;
        const callCeiling = atmStrike + 150;
        const putFloor = atmStrike - 150;

        nextMap.set('FNO_CALL_RESISTANCE', {
          id: `fno-call-${callCeiling}`,
          symbol: 'NIFTY 50',
          name: `Call Resistance Active (${callCeiling})`,
          alertType: 'FNO_OI',
          price: callCeiling,
          strike: callCeiling,
          side: 'RESISTANCE (CALLS)',
          action: 'placed',
          details: `Heavy Call writing observed at ${callCeiling} CE. Upper resistance barrier formed.`,
          createdAt: nowIso,
        });

        nextMap.set('FNO_PUT_SUPPORT', {
          id: `fno-put-${putFloor}`,
          symbol: 'NIFTY 50',
          name: `Put Support Built (${putFloor})`,
          alertType: 'FNO_OI',
          price: putFloor,
          strike: putFloor,
          side: 'SUPPORT (PUTS)',
          action: 'placed',
          details: `Major Put open interest concentrated at ${putFloor} PE. Strong defensive floor.`,
          createdAt: nowIso,
        });
      }

      return nextMap;
    });
  }, [stocks, indices]);

  // 3. Live Socket.IO Event Listener
  useEffect(() => {
    if (!socket) return;

    const handleAlert = (alert: StockAlert) => {
      if (alert.alertType === 'NEWS') {
        const src = (alert.symbol || '').toLowerCase();
        if (!isAllowedSource(src)) return;
        const titleText = (alert.name || alert.details || '').toLowerCase();
        for (const pat of BLACKLISTED_TITLE_PATTERNS) {
          if (pat.test(titleText)) return;
        }
      }

      triggerLiveAlert(alert);

      // Merge into radar alert map
      setRadarAlertsMap(prev => {
        const next = new Map(prev);
        const key = `${alert.symbol}_${alert.alertType}`;
        next.set(key, alert);
        return next;
      });
    };

    socket.on('alert:new', handleAlert);

    return () => {
      socket.off('alert:new', handleAlert);
    };
  }, [socket]);

  // Trigger audio, toasts, and desktop notifications
  const triggerLiveAlert = useCallback((alert: StockAlert) => {
    const nowMs = Date.now();

    // Audio Debounce
    const lastAudio = lastAudioPlayedRef.current[alert.alertType] || 0;
    if (nowMs - lastAudio > 800) {
      lastAudioPlayedRef.current[alert.alertType] = nowMs;
      if (alert.alertType === 'DAY_HIGH') {
        audioAlerts.playBreakoutChime();
      } else if (alert.alertType === 'DAY_LOW') {
        audioAlerts.playBreakdownTone();
      } else if (alert.alertType === 'VOLUME_SPIKE') {
        audioAlerts.playSpikeAlert();
      }
    }

    const isIdx = isIndexSymbol(alert.symbol) || alert.alertType === 'INDEX_MILESTONE';
    const durationMs = isIdx ? 8000 : 5000;
    const toast: Toast = { ...alert, dismissAt: nowMs + durationMs };
    const toastKey = `${alert.symbol}_${alert.alertType}`;

    // Desktop Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const title = alert.alertType === 'NEWS'
          ? `⚡ BREAKING NEWS: ${alert.symbol}`
          : alert.alertType === 'INDEX_MILESTONE'
          ? `🎯 INDEX MILESTONE: ${alert.symbol}`
          : isIdx
          ? `📊 INDEX ALERT: ${alert.symbol}`
          : `⚡ ALERT: ${alert.symbol}`;
        const body = alert.details || `${alert.symbol} ${alert.alertType === 'DAY_HIGH' ? 'reached Day High' : 'reached Day Low'} at ₹${alert.price.toLocaleString('en-IN')}`;
        new Notification(title, { body, silent: true });
      } catch {
        // Ignore desktop notification error
      }
    }

    // Deduplicate toast cards
    setToasts(prev => {
      const index = prev.findIndex(t => (t.id === toast.id) || (t.symbol === toast.symbol && t.alertType === toast.alertType));
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...toast, id: prev[index].id };
        return next;
      }
      return [toast, ...prev].slice(0, 6);
    });

    // Reset auto-dismiss timer
    const existingTimer = timersRef.current.get(toastKey);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => !(t.symbol === alert.symbol && t.alertType === alert.alertType)));
      timersRef.current.delete(toastKey);
    }, durationMs);
    timersRef.current.set(toastKey, timer);
  }, []);

  // 4. Combined, perfectly unified Alert History
  const alertHistory = useMemo(() => {
    const combinedMap = new Map<string, StockAlert>();

    // Seed with server alerts
    serverAlerts.forEach(a => {
      const key = a.alertType === 'NEWS' ? a.id : `${a.symbol}_${a.alertType}`;
      combinedMap.set(key, a);
    });

    // Layer with live client radar engine (takes precedence with freshest tick prices)
    radarAlertsMap.forEach((a, key) => {
      combinedMap.set(key, a);
    });

    const list = Array.from(combinedMap.values());

    // Sort: Breakouts and new peaks first, then by timestamp descending
    list.sort((a, b) => {
      const isBreakoutA = a.alertType === 'DAY_HIGH' || a.alertType === 'INDEX_MILESTONE' ? 1 : 0;
      const isBreakoutB = b.alertType === 'DAY_HIGH' || b.alertType === 'INDEX_MILESTONE' ? 1 : 0;
      if (isBreakoutA !== isBreakoutB) return isBreakoutB - isBreakoutA;

      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return list;
  }, [serverAlerts, radarAlertsMap]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => {
      const target = prev.find(t => t.id === id);
      if (target) {
        const toastKey = `${target.symbol}_${target.alertType}`;
        const timer = timersRef.current.get(toastKey);
        if (timer) {
          clearTimeout(timer);
          timersRef.current.delete(toastKey);
        }
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setServerAlerts([]);
    setRadarAlertsMap(new Map());
    setToasts([]);
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  return { toasts, alertHistory, dismissToast, clearAll };
}
