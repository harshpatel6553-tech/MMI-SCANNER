/**
 * @module marketHours
 * Utility to determine if the Indian stock market (NSE) is currently open.
 * Includes full support for standard weekday trading and Diwali Muhurat Trading.
 */

/**
 * Checks if today is a designated Diwali Muhurat Trading day.
 * Matches Nov 8, 2026 (Diwali Muhurat 2026) or via environment variable.
 */
export function isMuhuratTradingDay(date = new Date()): boolean {
  if (process.env.MUHURAT_TRADING === 'true') return true;
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const istDate = formatter.format(date); // e.g. "2026-11-08"
  
  const muhuratDates = new Set([
    '2026-11-08', // Diwali Muhurat 2026
    '2026-11-01',
    '2025-10-20',
    '2024-11-01',
  ]);
  
  return muhuratDates.has(istDate);
}

/**
 * Checks if the NSE market is currently in an active live trading session based on IST time.
 * - Standard hours: Monday - Friday, 09:15 to 15:30 IST.
 * - Diwali Muhurat Trading: Special evening session (17:45 Pre-Open, 18:00 - 19:30 IST Live).
 */
export function isMarketOpen(): boolean {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  let weekday = '';
  let hour = 0;
  let minute = 0;
  
  for (const part of parts) {
    if (part.type === 'weekday') weekday = part.value;
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
  }
  
  const timeInMinutes = hour * 60 + minute;

  // 🪔 SPECIAL DIWALI MUHURAT TRADING SESSION (14:20 - 15:30 IST & 17:45 - 19:30 IST)
  if (isMuhuratTradingDay(now)) {
    const isSlot1 = timeInMinutes >= (14 * 60 + 20) && timeInMinutes <= (15 * 60 + 30);
    const isSlot2 = timeInMinutes >= (17 * 60 + 45) && timeInMinutes <= (19 * 60 + 30);
    return isSlot1 || isSlot2;
  }
  
  // Market is closed on weekends for regular trading
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }
  
  // Standard market hours: 09:15 to 15:30 IST
  const openTime = 9 * 60 + 15;
  const closeTime = 15 * 60 + 30;
  
  return timeInMinutes >= openTime && timeInMinutes <= closeTime;
}

/**
 * Determines if the backend should actively poll stock quotes from data providers.
 * Active whenever the market is officially open, plus all afternoon on Muhurat Trading days (14:00 - 20:30 IST)
 * to warm the cache, detect pre-open volume, and stream live session ticks with zero delay.
 */
export function shouldPollMarket(): boolean {
  const now = new Date();
  
  if (isMarketOpen()) return true;
  
  if (isMuhuratTradingDay(now)) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(now);
    let hour = 0;
    let minute = 0;
    for (const part of parts) {
      if (part.type === 'hour') hour = parseInt(part.value, 10);
      if (part.type === 'minute') minute = parseInt(part.value, 10);
    }
    const timeInMinutes = hour * 60 + minute;
    // Keep backend active from 14:00 to 20:30 IST on Muhurat day
    return timeInMinutes >= 14 * 60 && timeInMinutes <= 20 * 60 + 30;
  }
  
  return false;
}
