/**
 * @module marketHours
 * Checks if the Indian stock market (NSE) is currently open based on IST time.
 * Standard hours: Monday - Friday, 09:15 to 15:30 IST.
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

  // Market is closed on weekends
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }

  const timeInMinutes = hour * 60 + minute;
  const openTime = 9 * 60 + 15;   // 09:15 IST
  const closeTime = 15 * 60 + 30; // 15:30 IST

  return timeInMinutes >= openTime && timeInMinutes <= closeTime;
}
