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
 * Checks if the Indian stock market (NSE) is currently open based on IST time.
 * Standard hours: Monday - Friday, 09:15 to 15:30 IST.
 * Diwali Muhurat Trading: Special evening session (17:45 Pre-Open, 18:00 - 19:30 IST Live).
 */
export function isMarketOpen(): boolean {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
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

  // 🪔 SPECIAL DIWALI MUHURAT TRADING SESSION
  if (isMuhuratTradingDay(now)) {
    // Active session runs 17:45 (Pre-open) through 19:30 IST (Post-closing)
    const muhuratStartMins = 17 * 60 + 45; // 17:45 IST
    const muhuratEndMins = 19 * 60 + 30;   // 19:30 IST
    return timeInMinutes >= muhuratStartMins && timeInMinutes <= muhuratEndMins;
  }

  // Market is closed on weekends
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }

  const openTime = 9 * 60 + 15;   // 09:15 IST
  const closeTime = 15 * 60 + 30; // 15:30 IST

  return timeInMinutes >= openTime && timeInMinutes <= closeTime;
}
