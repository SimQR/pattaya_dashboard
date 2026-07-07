# Pattaya Campaign — Snapshot Dashboard

Standalone Next.js app (deploy on Vercel) to trigger and view Pattaya campaign
snapshots. It is a **thin proxy** in front of the o2ramp staging API: the browser
talks only to this app's own `/api/*` routes, and those routes attach the
`Api-Key` server-side. **The Api-Key never reaches the browser.**

This project is intentionally separate from the o2ramp backend — do not merge them.

## Endpoints (proxied)

| UI action | This app | o2ramp staging |
|-----------|----------|----------------|
| 生成快照 | `POST /api/snapshot` | `POST /api/campaign/snapshot` |
| 快照列表 | `GET /api/snapshot` | `GET /api/campaign/snapshot` |
| 快照明细 | `GET /api/snapshot/:id` | `GET /api/campaign/snapshot/:id` |

## Local run

```bash
npm install
cp .env.local.example .env.local   # then edit values
npm run dev                        # http://localhost:3000
```

## Environment variables

| Var | Purpose |
|-----|---------|
| `CAMPAIGN_API_BASE` | Full base URL incl. `/api/campaign`, e.g. `https://staging.example.com/api/campaign` |
| `STAGING_API_KEY` | The Api-Key from o2ramp `config.json → apiAccessControl`. Server-side only. |
| `DASHBOARD_PASSWORD` | Optional shared password gating the dashboard. Empty = open. |

> Never rename `STAGING_API_KEY` to `NEXT_PUBLIC_*` — that would ship it to the browser.

## Deploy to Vercel

1. Push this folder to its own Git repo.
2. Import it in Vercel as a new project.
3. Set the three env vars above in **Project Settings → Environment Variables**.
4. Deploy. Optionally enable Vercel **Password Protection** for a second gate.

## Security notes

- Snapshot detail rows contain `user_id`, personal deposits and group sales
  (sensitive). Keep `DASHBOARD_PASSWORD` set and/or Vercel Password Protection on.
- `POST /api/snapshot` triggers a full recompute + DB write on staging. It runs
  the same auth gate — do not expose this app publicly without the password.
