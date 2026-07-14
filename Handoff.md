# handoff

running log of project state for anyone (human or agent) picking up the work.
updated after every 5-10 changes.

## 2026-07-14 17:35

- project scaffolded: next.js 16 + typescript + tailwind v4, fastapi skeleton in api/index.py
- rewrites in next.config.ts proxy /api/py/* and /:code to fastapi (dev: port 8000, prod: vercel function)
- npm run dev starts next and uvicorn together
- git identity set to canary443 (repo-local)
- plan: Plans/CLAUDE_14-07_17-27.md
- next: create github repo, then willow-mcp (blocked on WILLOW_API_KEY), supabase setup
