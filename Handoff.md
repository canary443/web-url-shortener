# handoff

running log of project state for anyone (human or agent) picking up the work.
updated after every 5-10 changes.

## 2026-07-14 17:50

- supabase project created: doaujyzqarexjdeblmjs (eu-central-1, free tier), migrations applied (links, rate_limits, rpcs, pg_cron cleanup), sql mirrored in supabase/migrations/
- backend done: shorten, redirect, links list/delete, streaming support chat (gpt-5.6-luna via willowapi), rate limits via check_rate_limit rpc, url validation, 16 pytest tests green
- frontend done: home + shorten form, login (github oauth + email), dashboard, chat widget, dark/light themes, design per ui-ux-pro-max (inter + jetbrains mono, slate + green accent)
- .env has supabase url + anon key. still missing: SUPABASE_SERVICE_ROLE_KEY (user copies from dashboard), WILLOW_API_KEY (user provides)
- github oauth provider not configured yet in supabase (user creates the oauth app, callback https://doaujyzqarexjdeblmjs.supabase.co/auth/v1/callback)
- next: local e2e qa, willow-mcp + banners, deploy to vercel

## 2026-07-14 17:35

- project scaffolded: next.js 16 + typescript + tailwind v4, fastapi skeleton in api/index.py
- rewrites in next.config.ts proxy /api/py/* and /:code to fastapi (dev: port 8000, prod: vercel function)
- npm run dev starts next and uvicorn together
- git identity set to canary443 (repo-local)
- plan: Plans/CLAUDE_14-07_17-27.md
- next: create github repo, then willow-mcp (blocked on WILLOW_API_KEY), supabase setup
