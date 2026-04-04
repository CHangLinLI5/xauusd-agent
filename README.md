# GoldBias — XAUUSD AI Trading Assistant

Real-time XAU/USD (gold spot) market analysis platform with AI-powered trading insights, live price streaming, and professional risk management tools.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 19 + TypeScript + TailwindCSS 4 |
| Routing | wouter |
| State / API | tRPC + React Query |
| Real-time | Socket.IO (WebSocket) + SSE |
| Backend | Express + tRPC + Node.js 22 |
| Database | PostgreSQL (Neon Serverless) + Drizzle ORM |
| AI | Custom LLM API (OpenAI-compatible) |
| Market Data | Twelve Data WebSocket + REST API |
| Deployment | Render (Blueprint) / Docker |

## Features

- **Real-time Gold Price** — WebSocket streaming from Twelve Data with REST fallback
- **AI Chat Assistant** — SSE-based streaming chat with market-aware system prompt
- **Daily Bias Analysis** — Automated bullish/bearish/ranging bias with key levels
- **Trading Plan Generator** — AI-generated daily trading plans with PDF export
- **Chart Analysis** — Upload and AI-analyze chart screenshots
- **News Feed** — Google News RSS aggregation for gold-related news
- **Risk Control Dashboard** — Position sizing, max loss, and session tracking
- **Email + OAuth Authentication** — Secure session management with JWT

## Prerequisites

- **Node.js** >= 22.13.0
- **pnpm** >= 10.4.1
- **PostgreSQL** database (Neon recommended)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/CHangLinLI5/xauusd-agent.git
cd xauusd-agent
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values. See [.env.example](.env.example) for all available variables and their descriptions.

### 4. Set up the database

```bash
pnpm db:push
```

### 5. Start development server

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

### 6. Build for production

```bash
pnpm build
pnpm start
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build client (Vite) and server (esbuild) |
| `pnpm start` | Start production server |
| `pnpm check` | TypeScript type checking |
| `pnpm format` | Format code with Prettier |
| `pnpm test` | Run tests with Vitest |
| `pnpm db:push` | Generate and run database migrations |

## Deployment

### Render (recommended)

This project includes a `render.yaml` Blueprint for one-click deployment on [Render](https://render.com).

1. Fork this repository
2. Connect your GitHub account to Render
3. Create a new Blueprint Instance pointing to this repo
4. Configure the required environment variables in the Render dashboard

### Docker

```bash
docker build -t xauusd-agent .
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e DATABASE_URL=your_database_url \
  -e JWT_SECRET=your_secret \
  -e TWELVE_DATA_API_KEY=your_key \
  xauusd-agent
```

## Project Structure

```
├── client/              # Frontend (Vite + React)
│   ├── src/
│   │   ├── components/  # UI components (shadcn/ui based)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── pages/       # Route pages
│   │   ├── lib/         # Utilities (tRPC client, etc.)
│   │   └── contexts/    # React contexts
│   └── public/          # Static assets
├── server/              # Backend (Express + tRPC)
│   ├── _core/           # Core infrastructure (auth, SDK, env, vite)
│   ├── routers.ts       # tRPC router definitions
│   ├── marketData.ts    # Twelve Data market data service
│   ├── tdWebSocket.ts   # Twelve Data WebSocket client
│   ├── wsServer.ts      # Socket.IO real-time push
│   ├── streamChat.ts    # SSE chat streaming endpoint
│   ├── newsService.ts   # Google News RSS aggregation
│   └── db.ts            # Database access layer
├── shared/              # Shared types and constants
├── drizzle/             # Database schema and migrations
├── render.yaml          # Render deployment blueprint
├── Dockerfile           # Docker build configuration
└── package.json
```

## Environment Variables

See [.env.example](.env.example) for the complete list with descriptions.

**Required for production:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for session JWT signing |
| `TWELVE_DATA_API_KEY` | Twelve Data API key for market data |
| `CUSTOM_LLM_API_URL` | Custom LLM API endpoint |
| `CUSTOM_LLM_API_KEY` | Custom LLM API key |

## Data Sources

- **Real-time Price**: [Twelve Data WebSocket API](https://twelvedata.com/docs#websocket) — XAU/USD spot price
- **K-line / OHLC**: [Twelve Data REST API](https://twelvedata.com/docs#time-series) — 1min, 15min, 1day, 1week intervals
- **News**: Google News RSS — Gold and precious metals news
- **Economic Calendar**: Dynamically generated based on known schedules

## Security Notes

- All API keys must be provided via environment variables; never commit secrets to the repository
- JWT session tokens use HS256 signing; `JWT_SECRET` is enforced in production
- Socket.IO CORS is controlled via `ALLOWED_ORIGINS` environment variable
- Email passwords are hashed with bcrypt (10 rounds)
- Session cookies use `HttpOnly`, `Secure` (HTTPS), and `SameSite` attributes

## License

MIT
