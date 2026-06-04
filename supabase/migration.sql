-- ============================================
-- Nifty Stock Screener — Supabase Migration
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Paste & Run)

-- 1. Stocks table — stores latest snapshot of each stock
CREATE TABLE IF NOT EXISTS stocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  previous_close NUMERIC(12,2) NOT NULL DEFAULT 0,
  open_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  day_high NUMERIC(12,2) NOT NULL DEFAULT 0,
  day_low NUMERIC(12,2) NOT NULL DEFAULT 0,
  change NUMERIC(12,2) NOT NULL DEFAULT 0,
  change_percent NUMERIC(8,2) NOT NULL DEFAULT 0,
  volume BIGINT NOT NULL DEFAULT 0,
  index_name TEXT NOT NULL DEFAULT 'NIFTY50',
  at_day_high BOOLEAN DEFAULT FALSE,
  at_day_low BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_index ON stocks(index_name);
CREATE INDEX IF NOT EXISTS idx_stocks_price ON stocks(price);
CREATE INDEX IF NOT EXISTS idx_stocks_volume ON stocks(volume);
CREATE INDEX IF NOT EXISTS idx_stocks_change_percent ON stocks(change_percent);

-- 2. Alerts table — stores day high/low hit alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  alert_type TEXT NOT NULL CHECK (alert_type IN ('DAY_HIGH', 'DAY_LOW')),
  price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for alert queries
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);

-- 3. Auto-cleanup: Delete alerts older than 7 days (optional cron via Supabase)
-- You can set up a Supabase Edge Function or pg_cron for this:
-- DELETE FROM alerts WHERE created_at < NOW() - INTERVAL '7 days';

-- 4. Enable Row Level Security (RLS) — allow public read access (no auth)
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read/write (since we have no auth)
CREATE POLICY "Allow public read on stocks" ON stocks FOR SELECT USING (true);
CREATE POLICY "Allow public insert on stocks" ON stocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on stocks" ON stocks FOR UPDATE USING (true);

CREATE POLICY "Allow public read on alerts" ON alerts FOR SELECT USING (true);
CREATE POLICY "Allow public insert on alerts" ON alerts FOR INSERT WITH CHECK (true);
