export interface StockData {
  symbol: string;
  name: string;
  price: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  change: number;
  changePercent: number;
  volume: number;
  indexName: 'NIFTY50' | 'NIFTY500';
  lastUpdated: string;
  atDayHigh: boolean;
  atDayLow: boolean;
  sector: string;
  averageVolume: number;
  relativeVolume: number;
  volumeSpike: boolean;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  marketCap: number;
}

export interface StockAlert {
  id: string;
  symbol: string;
  name: string;
  /** Type of price alert */
  alertType: 'DAY_HIGH' | 'DAY_LOW' | 'VOLUME_SPIKE' | 'NEWS';
  price: number;
  createdAt: string;
}

export interface FilterOptions {
  index: 'ALL' | 'NIFTY50' | 'NIFTY500';
  priceMin: number;
  priceMax: number;
  volumeMin: number;
  search: string;
}

export type SortField = 'symbol' | 'name' | 'price' | 'change' | 'changePercent' | 'dayHigh' | 'dayLow' | 'volume';
export type SortOrder = 'asc' | 'desc';
