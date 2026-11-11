import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSocketContext } from '../context/SocketContext';
import type { StockAlert, StockData } from '../types';
import { audioAlerts } from '../utils/audioAlerts';

export interface Toast extends StockAlert {
  dismissAt: number;
}

function isIndexSymbol(symbol: string): boolean {
  const s = (symbol || '').toUpperCase();
  return (
    s.includes('NIFTY') ||
    s.includes('BANKNIFTY') ||
    s.includes('SENSEX') ||
    s.includes('INDIA VIX') ||
    s.includes('INDEX')
  );
}

function isAllowedNewsSource(source?: string): boolean {
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

export function useAlerts(stocks?: StockData[]) {
  const { socket } = useSocketContext();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [serverAlerts, setServerAlerts] = useState<StockAlert[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem('mmi_server_alerts_cache');
        if (cached) {
          const list = JSON.parse(cached);
          return Array.isArray(list) ? list.filter((a: any) => a.alertType !== 'SMART_MONEY') : [];
        }
      }
    } catch {}
    return [];
  });
  const [radarAlerts, setRadarAlerts] = useState<Map<string, StockAlert>>(new Map());

  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSoundPlayedRef = useRef<Record<string, number>>({});
  
  // Tracking symbol alert state to avoid repetitive spam while guaranteeing fresh pop-ups
  const symbolAlertState = useRef<Map<string, {
    lastHighPrice?: number;
    lastLowPrice?: number;
    lastHighTime?: number;
    lastLowTime?: number;
    lastSpikeTime?: number;
    lastToastedRVol?: number;
  }>>(new Map());

  // Set of keys that already toasted in this session
  const alertedToastKeysRef = useRef<Set<string>>(new Set());

  // Permanent timestamp tracking to persist "Clear All" across 5s poll cycles
  const clearedBeforeTimestampRef = useRef<number>(0);

  // Hydration state: suppresses burst barrage on initial page load, then surfaces top fresh breakouts
  const [isHydrated, setIsHydrated] = useState(false);
  const initialFetchDoneRef = useRef(false);

  // Unified Toast Queue & Enqueue System for Alert Panel & Pop-Up synchronization
  const toastQueueRef = useRef<StockAlert[]>([]);
  const isQueuePumpingRef = useRef(false);
  const toastedTimestampsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsHydrated(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Request browser desktop notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── Trigger Toast Pop-up & Audio Chime ────────────────────────
  const triggerLiveAlert = useCallback((alert: StockAlert) => {
    const nowMs = Date.now();

    // 1. Audio Debounce (minimum 500ms between audio alerts)
    const lastAudio = lastSoundPlayedRef.current[alert.alertType] || 0;
    if (nowMs - lastAudio > 500) {
      lastSoundPlayedRef.current[alert.alertType] = nowMs;
      if (alert.alertType === 'DAY_HIGH') {
        audioAlerts.playBreakoutChime();
      } else if (alert.alertType === 'DAY_LOW') {
        audioAlerts.playBreakdownTone();
      } else if (alert.alertType === 'VOLUME_SPIKE') {
        audioAlerts.playSpikeAlert();
      } else if (alert.alertType === 'NEWS') {
        audioAlerts.playSpikeAlert();
      } else if (alert.alertType === 'FNO_OI') {
        audioAlerts.playBreakoutChime();
      }
    }

    const isIdx = isIndexSymbol(alert.symbol) || alert.alertType === 'INDEX_MILESTONE';
    const durationMs = isIdx ? 7500 : 6000;
    const toast: Toast = { ...alert, dismissAt: nowMs + durationMs };
    const toastKey = `${alert.symbol}_${alert.alertType}`;

    // 2. Desktop Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const title = isIdx
          ? `🎯 INDEX ALERT: ${alert.symbol}`
          : alert.alertType === 'DAY_HIGH'
          ? `🚀 DAY HIGH BREAK: ${alert.symbol}`
          : alert.alertType === 'DAY_LOW'
          ? `🔻 DAY LOW BREAK: ${alert.symbol}`
          : alert.alertType === 'VOLUME_SPIKE'
          ? `⚡ VOLUME SPIKE: ${alert.symbol}`
          : alert.alertType === 'NEWS'
          ? `📰 BREAKING NEWS: ${alert.symbol}`
          : alert.alertType === 'SMART_MONEY'
          ? `💎 SMART MONEY: ${alert.symbol}`
          : `⚡ ${alert.symbol}`;
        const body = alert.details || (
          alert.alertType === 'DAY_HIGH'
            ? `${alert.symbol} cleared Day High at ₹${alert.price.toLocaleString('en-IN')}`
            : alert.alertType === 'DAY_LOW'
            ? `${alert.symbol} touched Day Low at ₹${alert.price.toLocaleString('en-IN')}`
            : alert.alertType === 'VOLUME_SPIKE'
            ? `${alert.symbol} volume surge detected at ₹${alert.price.toLocaleString('en-IN')}`
            : alert.alertType === 'NEWS'
            ? (alert.name || 'Institutional market news wire')
            : alert.alertType === 'SMART_MONEY'
            ? `${alert.symbol} institutional flow activity`
            : `${alert.symbol} alert at ₹${alert.price.toLocaleString('en-IN')}`
        );
        new Notification(title, { body, silent: true });
      } catch {
        // Desktop notification error ignored
      }
    }

    // 3. Add to Pop-up Toast list (Maximum 3 visible simultaneously)
    setToasts(prev => {
      const idx = prev.findIndex(t => (t.id === toast.id) || (t.symbol === toast.symbol && t.alertType === toast.alertType));
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...toast, id: prev[idx].id };
        return copy;
      }
      return [toast, ...prev].slice(0, 3);
    });

    // 4. Auto-dismiss timer
    const prevTimer = toastTimersRef.current.get(toastKey);
    if (prevTimer) clearTimeout(prevTimer);
    const newTimer = setTimeout(() => {
      setToasts(prev => prev.filter(t => !(t.symbol === alert.symbol && t.alertType === alert.alertType)));
      toastTimersRef.current.delete(toastKey);
    }, durationMs);
    toastTimersRef.current.set(toastKey, newTimer);
  }, []);

  // ── Unified Toast Queue & Enqueue System (Guarantees every panel alert pops up) ──
  const pumpToastQueue = useCallback(() => {
    if (isQueuePumpingRef.current) return;
    if (toastQueueRef.current.length === 0) return;

    isQueuePumpingRef.current = true;
    const nextAlert = toastQueueRef.current.shift();
    if (nextAlert) {
      triggerLiveAlert(nextAlert);
    }

    if (toastQueueRef.current.length > 0) {
      setTimeout(() => {
        isQueuePumpingRef.current = false;
        pumpToastQueue();
      }, 1200);
    } else {
      isQueuePumpingRef.current = false;
    }
  }, [triggerLiveAlert]);

  const enqueueToast = useCallback((alert: StockAlert, force: boolean = false) => {
    if (!alert || alert.alertType === 'SMART_MONEY') return;
    if (alert.alertType === 'DAY_HIGH' && !((alert.changePercent ?? 0) > 0.05 && (alert.change ?? 0) > 0)) {
      return;
    }
    if (alert.alertType === 'DAY_LOW' && !((alert.changePercent ?? 0) < -0.05 && (alert.change ?? 0) < 0)) {
      return;
    }
    if (alert.alertType === 'VOLUME_SPIKE') {
      const match = alert.details?.match(/([\d.]+)x/);
      const rvol = match ? parseFloat(match[1]) : 0;
      const absMove = Math.abs(alert.changePercent ?? 0);
      if (rvol < 3.5 || absMove < 1.5) {
        return;
      }
    }
    const key = (alert.alertType === 'NEWS' || alert.alertType === 'FNO_OI')
      ? alert.id
      : `${alert.symbol}_${alert.alertType}`;

    const nowMs = Date.now();
    const lastToasted = toastedTimestampsRef.current.get(key) || 0;
    const cooldown = alert.alertType === 'NEWS' ? 10000 : 20000;

    if (!force && (nowMs - lastToasted < cooldown)) {
      return;
    }

    toastedTimestampsRef.current.set(key, nowMs);

    // Limit maximum backlog queue to 8 items to avoid stale notifications
    if (toastQueueRef.current.length < 8) {
      toastQueueRef.current.push(alert);
      pumpToastQueue();
    }
  }, [pumpToastQueue]);

  // ── 1. Initial REST fetch and background 5s refresh for server alerts ──
  useEffect(() => {
    let isMounted = true;

    const fetchServerAlerts = async () => {
      try {
        let alertsData: StockAlert[] = [];
        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'https://35.226.242.164.sslip.io';
        const baseUrl = socketUrl.endsWith('/') ? socketUrl.slice(0, -1) : socketUrl;
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        // Fetch alerts directly without wasting roundtrips on 404s
        const alertsUrl = isLocal ? '/api/stocks/alerts?limit=300' : `${baseUrl}/api/stocks/alerts?limit=300`;
        try {
          let res = await fetch(alertsUrl).catch(() => null);
          if (!res || !res.ok) {
            const fallback = alertsUrl.startsWith('http') ? '/api/stocks/alerts?limit=300' : `${baseUrl}/api/stocks/alerts?limit=300`;
            res = await fetch(fallback).catch(() => null);
          }
          if (res && res.ok) {
            const result = await res.json();
            if (result?.success && Array.isArray(result.data)) {
              alertsData = result.data;
            }
          }
        } catch {
          // silent fallback
        }

        // Also fetch live F&O OI alerts
        try {
          const fnoUrl = isLocal ? '/api/fno/oi-alerts' : `${baseUrl}/api/fno/oi-alerts`;
          let fnoRes = await fetch(fnoUrl).catch(() => null);
          if (!fnoRes || !fnoRes.ok) {
            const fallback = fnoUrl.startsWith('http') ? '/api/fno/oi-alerts' : `${baseUrl}/api/fno/oi-alerts`;
            fnoRes = await fetch(fallback).catch(() => null);
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
          // Ignore F&O fetch errors
        }

        // Also fetch recent breaking news alerts to populate the NEWS tab immediately
        try {
          const newsUrl = isLocal ? `/api/news?_t=${Date.now()}` : `${baseUrl}/api/news?_t=${Date.now()}`;
          let newsRes = await fetch(newsUrl).catch(() => null);
          if (!newsRes || !newsRes.ok) {
            const fallback = newsUrl.startsWith('http') ? `/api/news?_t=${Date.now()}` : `${baseUrl}/api/news?_t=${Date.now()}`;
            newsRes = await fetch(fallback).catch(() => null);
          }
          if (newsRes && newsRes.ok) {
            const newsJson = await newsRes.json();
            if (newsJson?.success && Array.isArray(newsJson.data)) {
              const mappedNews: StockAlert[] = newsJson.data
                .filter((item: any) => isAllowedNewsSource(item.source))
                .slice(0, 30)
                .map((n: any) => ({
                  id: `news-${n.id}`,
                  symbol: n.source.startsWith('@') ? n.source : `@${n.source}`,
                  name: n.title,
                  alertType: 'NEWS',
                  price: 0,
                  details: 'Institutional News Wire',
                  createdAt: n.pubDate || new Date().toISOString(),
                }));

              const existingIds = new Set(alertsData.map(a => a.id));
              mappedNews.forEach(nw => {
                if (!existingIds.has(nw.id)) {
                  alertsData.push(nw);
                }
              });
            }
          }
        } catch {
          // Ignore news fetch errors
        }

        if (!isMounted) return;

        // Deduplicate server alerts preserving individual F&O strikes and News items (Strictly Stocks, F&O and News)
        const dedupedMap = new Map<string, StockAlert>();
        alertsData.forEach(a => {
          if (a.alertType === 'SMART_MONEY') return;
          if (clearedBeforeTimestampRef.current && new Date(a.createdAt).getTime() <= clearedBeforeTimestampRef.current) {
            return;
          }
          if (a.alertType === 'NEWS' || a.alertType === 'FNO_OI') {
            dedupedMap.set(a.id, a);
          } else {
            const key = `${a.symbol}_${a.alertType}`;
            const existing = dedupedMap.get(key);
            if (!existing || new Date(a.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
              dedupedMap.set(key, a);
            }
          }
        });

        const freshList = Array.from(dedupedMap.values());
        setServerAlerts(freshList);

        // Synchronize server alerts with pop-up toasts
        const isFirstLoad = !initialFetchDoneRef.current;
        initialFetchDoneRef.current = true;

        if (isFirstLoad) {
          // Seed older alerts so we don't dump hundreds of historical items
          freshList.forEach(a => {
            const key = (a.alertType === 'NEWS' || a.alertType === 'FNO_OI') ? a.id : `${a.symbol}_${a.alertType}`;
            toastedTimestampsRef.current.set(key, Date.now() - 15000);
          });

          // Enqueue top 3 active breakouts with high/low so user gets immediate alerts
          const activeHighLows = freshList
            .filter(a => (a.alertType === 'DAY_HIGH' || a.alertType === 'DAY_LOW') && a.price > 0)
            .sort((a, b) => {
              const timeA = new Date(a.createdAt).getTime() || 0;
              const timeB = new Date(b.createdAt).getTime() || 0;
              return timeB - timeA;
            });

          activeHighLows.slice(0, 3).forEach(a => {
            const key = `${a.symbol}_${a.alertType}`;
            toastedTimestampsRef.current.delete(key);
            enqueueToast(a, true);
          });
        } else {
          // On 5-second polling cycles:
          // Any new alert that arrives at the server gets enqueued for a pop-up toast!
          freshList.forEach(a => {
            const key = (a.alertType === 'NEWS' || a.alertType === 'FNO_OI') ? a.id : `${a.symbol}_${a.alertType}`;
            const isUnseen = !toastedTimestampsRef.current.has(key);
            const alertTime = new Date(a.createdAt).getTime();
            const isRecent = !alertTime || (Date.now() - alertTime < 3 * 60 * 1000);

            if (isUnseen && isRecent) {
              enqueueToast(a);
            }
          });
        }

        try {
          if (typeof window !== 'undefined' && freshList.length > 0) {
            sessionStorage.setItem('mmi_server_alerts_cache', JSON.stringify(freshList.slice(0, 200)));
          }
        } catch {
          // sessionStorage full or disabled
        }
      } catch {
        // Fallback silently
      }
    };

    fetchServerAlerts();
    const interval = setInterval(fetchServerAlerts, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // ── 2. Real-Time Radar Scanner: Detects Day High & Day Low as soon as hit ──
  useEffect(() => {
    if (!stocks || stocks.length === 0) return;

    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();
    const pendingToasts: StockAlert[] = [];

    setRadarAlerts(prevMap => {
      const nextMap = new Map(prevMap);

      for (const s of stocks) {
        if (!s || s.price <= 0 || s.dayHigh <= 0 || s.dayLow <= 0) continue;
        if (s.dayHigh <= s.dayLow) continue;

        // CRITICAL: Reject stale quotes from previous month/session (e.g. October 30th quotes)
        if (s.lastUpdated && s.lastUpdated.includes('2026-10-')) continue;

        const spread = s.dayHigh - s.dayLow;
        if (spread <= 0.05) continue;

        const distHighPct = Math.max(0, ((s.dayHigh - s.price) / s.dayHigh) * 100);
        const distLowPct = Math.max(0, ((s.price - s.dayLow) / s.dayLow) * 100);

        // ══════════════════════════════════════════════════════════════════════
        // STRICT POSITIVE/NEGATIVE MOMENTUM FILTER:
        // - A Day High alert MUST have positive change (changePercent > 0.05% and change > 0).
        // - A Day Low alert MUST have negative change (changePercent < -0.05% and change < 0).
        // ══════════════════════════════════════════════════════════════════════
        const isGaining = (s.changePercent ?? 0) > 0.05 && (s.change ?? 0) > 0;
        const isDeclining = (s.changePercent ?? 0) < -0.05 && (s.change ?? 0) < 0;

        const isBreakoutHigh = s.price >= s.dayHigh || s.atDayHigh === true;
        const isDayHighHit = isGaining && (isBreakoutHigh || distHighPct <= 0.15);

        const isBreakdownLow = s.price <= s.dayLow || s.atDayLow === true;
        const isDayLowHit = isDeclining && (isBreakdownLow || distLowPct <= 0.15);

        // Timestamp hygiene: if stock timestamp is older than 10 mins, stamp with current time
        const quoteTime = s.lastUpdated ? new Date(s.lastUpdated).getTime() : 0;
        const quoteAgeMs = Math.abs(nowMs - quoteTime);
        const freshTimestamp = (quoteTime > 0 && quoteAgeMs < 10 * 60 * 1000) ? s.lastUpdated! : nowIso;

        const symState = symbolAlertState.current.get(s.symbol) || {};

        // 🚀 DAY HIGH ALERT: Add to Panel
        if (isDayHighHit) {
          const highKey = `${s.symbol}_DAY_HIGH`;
          const existingAlert = prevMap.get(highKey);
          const alertObj: StockAlert = {
            id: `dh-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_HIGH',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: isBreakoutHigh
              ? `Cleared previous Day High · New Session Peak at ₹${s.price.toFixed(2)}`
              : `At Day High Level · Within ${distHighPct.toFixed(2)}% of High (₹${s.dayHigh.toFixed(2)})`,
            createdAt: existingAlert?.createdAt || freshTimestamp,
          };
          nextMap.set(highKey, alertObj);

          // Pop-up Toast Trigger Logic
          const hasPushedPeak = symState.lastHighPrice === undefined || s.price > symState.lastHighPrice;

          if (isHydrated && (isBreakoutHigh || hasPushedPeak)) {
            symState.lastHighPrice = s.price;
            pendingToasts.push(alertObj);
          } else if (!symState.lastHighPrice) {
            symState.lastHighPrice = s.price;
          }
        }

        // 🔻 DAY LOW ALERT: Add to Panel
        if (isDayLowHit) {
          const lowKey = `${s.symbol}_DAY_LOW`;
          const existingAlert = prevMap.get(lowKey);
          const alertObj: StockAlert = {
            id: `dl-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'DAY_LOW',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: isBreakdownLow
              ? `Broke Day Low level · New Session Low at ₹${s.price.toFixed(2)}`
              : `At Day Low Level · Within ${distLowPct.toFixed(2)}% of Low (₹${s.dayLow.toFixed(2)})`,
            createdAt: existingAlert?.createdAt || freshTimestamp,
          };
          nextMap.set(lowKey, alertObj);

          // Pop-up Toast Trigger Logic
          const hasPushedTrough = symState.lastLowPrice === undefined || s.price < symState.lastLowPrice;

          if (isHydrated && (isBreakdownLow || hasPushedTrough)) {
            symState.lastLowPrice = s.price;
            pendingToasts.push(alertObj);
          } else if (!symState.lastLowPrice) {
            symState.lastLowPrice = s.price;
          }
        }

        // ⚡ VOLUME SURGE ALERT: True institutional surge (Requires >= 3.5x velocity & >= 1.5% move)
        const rVol = s.relativeVolume ?? 0;
        const absMove = Math.abs(s.changePercent ?? 0);
        const isTrueSpike = rVol >= 3.5 && absMove >= 1.5;
        if (isTrueSpike) {
          const spikeKey = `${s.symbol}_VOLUME_SPIKE`;
          const existingAlert = prevMap.get(spikeKey);
          const alertObj: StockAlert = {
            id: `vs-${s.symbol}`,
            symbol: s.symbol,
            name: s.name,
            alertType: 'VOLUME_SPIKE',
            price: s.price,
            change: s.change,
            changePercent: s.changePercent,
            details: `Volume Surge: ${rVol.toFixed(1)}x institutional velocity`,
            createdAt: existingAlert?.createdAt || freshTimestamp,
          };
          nextMap.set(spikeKey, alertObj);

          // Pop-up Toast Trigger Logic for Volume Surges:
          // Strictly reserved for explosive moves (>= 4.0x surge & >= 2.0% move), with high-watermark deduplication
          const lastToastedRVol = symState.lastToastedRVol ?? 0;
          if (isHydrated && rVol >= 4.0 && absMove >= 2.0 && (rVol >= lastToastedRVol + 1.5)) {
            symState.lastToastedRVol = rVol;
            pendingToasts.push(alertObj);
          }
        }

        symbolAlertState.current.set(s.symbol, symState);
      }

      return nextMap;
    });

    // Enqueue all candidate alerts (enqueueToast manages 20s cooldown and smooth staggered queue)
    pendingToasts.forEach(t => enqueueToast(t));
  }, [stocks, isHydrated, enqueueToast]);

  // ── 3. Live Socket.IO Alerts Listener (handles Server-Broadcasted Alerts & News) ──
  useEffect(() => {
    if (!socket) return;

    const handleServerAlert = (alert: StockAlert) => {
      if (alert.alertType === 'SMART_MONEY') return;

      if (alert.alertType === 'NEWS') {
        const src = (alert.symbol || '').toLowerCase();
        if (!isAllowedNewsSource(src)) return;
        const titleText = (alert.name || alert.details || '').toLowerCase();
        for (const pat of BLACKLISTED_TITLE_PATTERNS) {
          if (pat.test(titleText)) return;
        }
      }

      setServerAlerts(prev => {
        const copy = [...prev];
        const key = alert.alertType === 'NEWS' ? alert.id : `${alert.symbol}_${alert.alertType}`;
        const existingIdx = copy.findIndex(a => (a.alertType === 'NEWS' ? a.id === key : `${a.symbol}_${a.alertType}` === key));
        if (existingIdx >= 0) {
          copy[existingIdx] = alert;
        } else {
          copy.unshift(alert);
        }
        return copy.slice(0, 500);
      });

      // Synchronize directly with toast queue!
      enqueueToast(alert);
    };

    socket.on('alert:new', handleServerAlert);

    return () => {
      socket.off('alert:new', handleServerAlert);
    };
  }, [socket, enqueueToast]);

  // ── 4. Unified, deduplicated Alert History for Alert Panel ──
  const alertHistory = useMemo(() => {
    const combinedMap = new Map<string, StockAlert>();

    // Layer server alerts (Strictly STOCKS, F&O and News — no institutional inflow)
    serverAlerts.forEach(a => {
      if (a.alertType === 'SMART_MONEY') return;
      if (clearedBeforeTimestampRef.current && new Date(a.createdAt).getTime() <= clearedBeforeTimestampRef.current) {
        return;
      }
      const key = (a.alertType === 'NEWS' || a.alertType === 'FNO_OI')
        ? a.id
        : `${a.symbol}_${a.alertType}`;
      combinedMap.set(key, a);
    });

    // Layer active stock & index radar alerts (takes precedence for live Day High / Day Low prices)
    radarAlerts.forEach((a, key) => {
      if (clearedBeforeTimestampRef.current && new Date(a.createdAt).getTime() <= clearedBeforeTimestampRef.current) {
        return;
      }
      const existing = combinedMap.get(key);
      if (existing) {
        combinedMap.set(key, {
          ...a,
          id: existing.id || a.id,
          createdAt: existing.createdAt || a.createdAt,
        });
      } else {
        combinedMap.set(key, a);
      }
    });

    const list = Array.from(combinedMap.values()).filter(a => {
      if (a.alertType === 'DAY_HIGH') {
        return (a.changePercent ?? 0) > 0.05 && (a.change ?? 0) > 0;
      }
      if (a.alertType === 'DAY_LOW') {
        return (a.changePercent ?? 0) < -0.05 && (a.change ?? 0) < 0;
      }
      if (a.alertType === 'VOLUME_SPIKE') {
        const match = a.details?.match(/([\d.]+)x/);
        const rvol = match ? parseFloat(match[1]) : 0;
        const absMove = Math.abs(a.changePercent ?? 0);
        return rvol >= 3.5 && absMove >= 1.5;
      }
      return true;
    });

    // Sort: Fresh breakouts and peaks first, then by timestamp descending
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });

    return list;
  }, [serverAlerts, radarAlerts]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => {
      const target = prev.find(t => t.id === id);
      if (target) {
        const toastKey = `${target.symbol}_${target.alertType}`;
        const timer = toastTimersRef.current.get(toastKey);
        if (timer) {
          clearTimeout(timer);
          toastTimersRef.current.delete(toastKey);
        }
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    clearedBeforeTimestampRef.current = Date.now();
    setServerAlerts([]);
    setRadarAlerts(new Map());
    setToasts([]);
    toastQueueRef.current = [];
    toastedTimestampsRef.current.clear();
    toastTimersRef.current.forEach(t => clearTimeout(t));
    toastTimersRef.current.clear();
  }, []);

  return { toasts, alertHistory, dismissToast, clearAll };
}
