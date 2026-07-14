# handoff

running log of project state for anyone (human or agent) picking up the work.
newest entry on top. update after every 5-10 changes. architecture and rules
live in AGENTS.md, this file is only "what happened and what is next".

## 2026-07-14 18:50 - session end (claude fable 5 -> next agent)

owner is switching agents. state: core product code-complete, live-tested locally
(except chat streaming and sign-in flows), NOT deployed. qa gate green at last run.

new for the successor since the last entry:
- agent workspace extended: STRUCTURE.md (file map + recipes), CODE_REVIEW.md (6 findings logged, 1 high), Plans/Resolutions/ (per-phase outcomes, see RES_CLAUDE_14-07_17-27.md), image prompt rules and session-end protocol in RULES.md
- willow-mcp written (tools/willow-mcp/server.py, mcp stdio + cli mode, registered in .mcp.json) but UNVERIFIED: deps not installed yet, model id "gpt-image-1" unconfirmed

exact next steps, in order:
1. `.venv/bin/pip install -r tools/willow-mcp/requirements.txt`
2. probe image gen cheaply: `.venv/bin/python tools/willow-mcp/server.py --prompt "test render, dark slate abstract minimal" --quality 2k --out /tmp/probe.png` (pace calls, upstream 429s hard, see MEMORY.md willow section)
3. banners per RULES.md image rules (hero 4k + 1-2 section 2k, budget $0.3 on the image key), webp to public/banners/, wire into home hero
4. playwright screenshots: all pages, dark/light, 1440/375, fix visual issues
5. deploy to vercel: import github repo, env vars per SECURITY.md prod list, function region fra1, then VERIFY the /:code rewrite passes the original path to the python function (CODE_REVIEW.md finding 1, high)
6. after deploy: set NEXT_PUBLIC_SITE_URL to the live url, github repo description + live link, readme rewrite via humanizer, github actions ci
7. chat streaming: owner is asking willow support about the real rate limits, until then the fallback chain covers it

owner actions still pending:
- github app callback url https://doaujyzqarexjdeblmjs.supabase.co/auth/v1/callback + enable github provider in supabase dashboard (client id Iv23lico8YsQaHSO6Me8 + secret)
- willow support answer about 429s

## 2026-07-14 18:35

- keys received and stored (.env + SECURITY.md, both gitignored): willow chat key (prod), willow image key (dev only), supabase service role. SECURITY.md is now the key inventory + threat model, added to the agent reading order
- live e2e passed with real db: shorten -> 302 redirect with correct target, missing code -> /?notfound=1, javascript: url -> 422, anon rate limit -> 429 exactly after 10
- gpt-5.6-luna verified via direct api call. willowapi 429s aggressively (way below advertised 300 rpm), owner is contacting their support. chat.py now falls back stream -> plain -> busy message, so the widget degrades gracefully
- security: headers in next.config.ts (nosniff, frame deny, referrer, permissions), injection-hardened chat system prompt, list/delete endpoints rate limited 240/h, supabase advisors clean (one intentional INFO: rate_limits has no policies, service role only)
- accounts: password change on dashboard (account security block), forgot password on login, /reset-password page for email recovery links
- license: agpl-3.0 (LICENSE + package.json + readme section) per owner choice, copyleft to block proprietary reuse
- github: owner created a github app (id 4297736, client id Iv23lico8YsQaHSO6Me8). REMAINING owner actions: set callback url https://doaujyzqarexjdeblmjs.supabase.co/auth/v1/callback in the github app settings, then enable github provider in supabase dashboard with client id + secret
- qa gate green after all changes

## 2026-07-14 18:10

- agent workspace upgraded: RULES.md (all owner rules + session protocol + definition of done) and MEMORY.md (gotchas) created, both local/gitignored. AGENTS.md rewritten with a "start here" onboarding block, reading order and never-do list
- qa gate added: scripts/qa.sh (pytest, eslint, long dash check, backend boot + health, build). it is the definition of done, currently green
- fixed 3 react-hooks/set-state-in-effect lint errors the gate caught (theme-toggle now css-driven dual icons, chat widget lazy state init from sessionStorage, dashboard load moved setstate into promise callbacks)
- new commit cadence in RULES.md: default lowercase one-liners, every 2nd-4th commit a normal Capitalized one with the model co-author trailer
- turbopack root pinned in next.config.ts (stray lockfile in home dir confused workspace detection)
- still blocked on: SUPABASE_SERVICE_ROLE_KEY, WILLOW_API_KEY (owner offered the willow key in chat), github oauth app. next: e2e qa + willow-mcp + banners + deploy per the 17:55 entry

## 2026-07-14 17:55

state: core product is code-complete and pushed. nothing deployed yet.

done in this session:
- scaffold: next.js 16 + ts + tailwind v4, fastapi hybrid (api/index.py + api/_lib/), rewrites in next.config.ts, npm run dev runs both servers
- supabase: project doaujyzqarexjdeblmjs (eu-central-1, free), migrations applied and mirrored in supabase/migrations/ (links, rate_limits, check_rate_limit/increment_clicks/cleanup_expired rpcs, pg_cron hourly cleanup, rls)
- backend endpoints: shorten (anon 1h ttl + 10/h per ip, user permanent + 60/h), redirect with click counting, links list/delete, streaming chat proxy to gpt-5.6-luna (willowapi), health. full endpoint table in AGENTS.md
- frontend: home (hero + shorten form + facts), login (email/password + github oauth button), dashboard (list/copy/delete/clicks/sign out), floating support chat widget, dark/light themes (dark default), inter + jetbrains mono
- tests: 16 pytest tests green (url validation, code generation). npm run build passes
- repo: https://github.com/canary443/web-url-shortener, all commits authored by canary443, pushed through "updated handoff" (bcac6da)
- ui-ux-pro-max skill updated to v2.11.0 mid-session

verified so far:
- pytest green, next build green, uvicorn boots, /api/py/health answers
- NOT yet verified live: shorten/redirect/dashboard/chat flows (blocked, see below), sql rpcs against live db (rate limit counting, click increment)

blockers waiting on the owner:
1. SUPABASE_SERVICE_ROLE_KEY into .env (dashboard -> project settings -> api keys). until then any backend db write fails locally
2. WILLOW_API_KEY into .env (https://willowapi.digital/dashboard). needed for chat replies and banner generation
3. github oauth app: create at github -> settings -> developer settings -> oauth apps, homepage = deployment url, callback = https://doaujyzqarexjdeblmjs.supabase.co/auth/v1/callback. then supabase dashboard -> authentication -> providers -> github, paste client id + secret

next steps in order:
1. when service key arrives: local e2e qa (shorten -> redirect -> click count, ttl, rate limit 429, auth flows, chat stream) + playwright screenshots dark/light desktop/mobile
2. willow-mcp: python stdio mcp server in tools/willow-mcp/ (official mcp sdk), tool generate_image(prompt, quality 2k|4k, out_path), register in .mcp.json. verify real willowapi image endpoint shape first (docs are a js spa, /v1/models confirmed openai-compatible)
3. banners: hero 4k + section 2k, aeza-style abstract art, convert to webp, put in public/banners/, wire into home page
4. deploy: vercel project from the github repo (auto-deploys), env vars from .env plus NEXT_PUBLIC_SITE_URL = deployment url, function region fra1 (db is eu-central-1). verify prod rewrite /:code -> python function actually preserves the original path, adjust if not
5. ship: readme rewrite with humanizer skill, github repo description + live link, github actions ci (pytest + next build), final prod qa

## 2026-07-14 17:35

- project scaffolded: next.js 16 + typescript + tailwind v4, fastapi skeleton in api/index.py
- rewrites in next.config.ts proxy /api/py/* and /:code to fastapi (dev: port 8000, prod: vercel function)
- npm run dev starts next and uvicorn together
- git identity set to canary443 (repo-local)
- plan: Plans/CLAUDE_14-07_17-27.md
- next: create github repo, then willow-mcp (blocked on WILLOW_API_KEY), supabase setup
