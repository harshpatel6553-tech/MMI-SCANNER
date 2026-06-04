# 📊 Nifty Screener — Real-Time Stock Scanner

A premium, real-time stock screener for **Nifty 50** and **Nifty 500** stocks, built with React, Express, Socket.IO, and TypeScript.

![Stack](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Stack](https://img.shields.io/badge/Express-4-000000?logo=express)
![Stack](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io)
![Stack](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Stack](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)

## ✨ Features

- **Live Stock Data Table** — Symbol, Price, Day High, Day Low, Change %, Volume
- **Real-Time Updates** — Prices refresh every 5 seconds via WebSocket (Socket.IO)
- **Smart Filters** — Filter by index (Nifty 50/500), price range, and volume
- **Day High/Low Detection** — Automatic detection when a stock hits its day high or low
- **Toast Notifications** — Slide-in alerts when stocks hit day high/low
- **Instant Search** — Search by stock symbol or company name with fuzzy matching
- **Premium Dark UI** — Trading terminal aesthetic with glassmorphism and animations

## 🛠️ Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **Supabase** account (free tier works) — [supabase.com](https://supabase.com/)

## 📦 Setup Instructions

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Supabase

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Go to **SQL Editor** → **New Query**
3. Paste and run the contents of `supabase/migration.sql`
4. Go to **Settings** → **API** and copy:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### 3. Configure Environment Variables

```bash
# Server environment
cp .env.example server/.env
# Edit server/.env with your Supabase credentials:
#   SUPABASE_URL=https://your-project-id.supabase.co
#   SUPABASE_ANON_KEY=your-anon-key

# Client environment  
echo "VITE_SOCKET_URL=http://localhost:5000" > client/.env
```

### 4. Run in Development Mode

Open **two terminals**:

```bash
# Terminal 1 — Start the backend server
cd server
npm run dev
# → Server running on http://localhost:5000

# Terminal 2 — Start the frontend dev server
cd client
npm run dev
# → Client running on http://localhost:5173
```

Open **http://localhost:5173** in your browser. 🎉

## 🏗️ Architecture

```
client/ (React + Vite + TypeScript)
├── src/
│   ├── components/    # UI components (Header, StockTable, Filters, etc.)
│   ├── hooks/         # Custom React hooks (useStocks, useAlerts, useSocket)
│   ├── context/       # Socket.IO context provider
│   ├── types/         # TypeScript interfaces
│   └── utils/         # Formatting utilities

server/ (Express + TypeScript)
├── src/
│   ├── config/        # Supabase client setup
│   ├── data/          # Nifty 50/500 stock symbol lists
│   ├── models/        # (reserved for future use)
│   ├── routes/        # REST API endpoints
│   ├── services/      # Stock fetching + alert detection
│   ├── sockets/       # Socket.IO event handlers
│   ├── types/         # TypeScript interfaces
│   └── utils/         # Logger utility
```

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stocks` | Get all stocks (supports query filters) |
| GET | `/api/stocks/:symbol` | Get single stock by symbol |
| GET | `/api/alerts` | Get recent alerts |

### Query Parameters for `/api/stocks`

| Param | Type | Description |
|-------|------|-------------|
| `index` | string | Filter by index: `NIFTY50`, `NIFTY500`, or `ALL` |
| `priceMin` | number | Minimum price |
| `priceMax` | number | Maximum price |
| `volumeMin` | number | Minimum volume |
| `search` | string | Search by symbol or name |
| `sort` | string | Sort field: `symbol`, `price`, `change`, `changePercent`, `volume` |
| `order` | string | Sort order: `asc` or `desc` |

## 🔄 Socket.IO Events

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `stocks:update` | `StockData[]` | Updated stock data |
| `alert:new` | `StockAlert` | New day high/low alert |
| `connection:status` | `{ connected, stockCount, lastUpdate }` | Connection info |

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `subscribe:index` | `'NIFTY50' \| 'NIFTY500' \| 'ALL'` | Subscribe to index updates |

## 📝 Data Source

Stock data is fetched via the [yahoo-finance2](https://www.npmjs.com/package/yahoo-finance2) npm package, which uses unofficial Yahoo Finance endpoints. NSE stocks use the `.NS` suffix (e.g., `RELIANCE.NS`).

> **Note**: This is not professional-grade real-time data. There may be slight delays. For production use, consider official NSE data vendors.

## 🎨 UI Design

The UI follows a **premium dark trading terminal aesthetic**:
- Deep navy background with glassmorphism cards
- Neon green for positive values, coral red for negative
- Electric cyan accents
- Row flash animations on price changes
- Pulse glow indicators for day high/low stocks
- Toast notifications for alerts
- Inter font with tabular numbers

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` on server start | Check Supabase URL and API key in `.env` |
| No stock data appearing | Server may still be fetching first batch (wait 10s) |
| Yahoo Finance rate limiting | Reduce poll frequency in `.env` |
| Socket.IO not connecting | Ensure server is running on port 5000 |
| CORS errors | Check that client origin is allowed in server CORS config |

## 📄 License

MIT
