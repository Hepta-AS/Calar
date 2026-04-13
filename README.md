# Calar

Next.js dashboard and API for Calar. Node 18+.

## Setup

```bash
npm install
```

Create `.env.local` with at least:

- `SESSION_SECRET` — random string for signed session cookies
- `DATABASE_URL` — Postgres (e.g. Neon) connection string when using auth and capture APIs

## Dev

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Scripts

- `npm run db:seed:dev` — seed dev tenant/users (requires `DATABASE_URL`)
