/**
 * @module marketHours
 * Utility to determine if the Indian stock market (NSE) is currently open.
 */

/**
 * Checks if the NSE market is currently open based on IST time.
 * Standard hours: Monday - Friday, 09:15 to 15:30 IST.
 * 
 * Note: This does not currently check for public holidays, but it successfully 
 * blocks aggressive polling on weekends and during overnight hours.
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
  
  // Market is closed on weekends
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }
  
  const timeInMinutes = hour * 60 + minute;
  
  // Market opens at 09:15 IST
  const openTime = 9 * 60 + 15;
  
  // Market closes at 15:30 IST
  const closeTime = 15 * 60 + 30;
  
  return timeInMinutes >= openTime && timeInMinutes <= closeTime;
}
