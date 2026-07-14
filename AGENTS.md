<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# web-url-shortener

minimal url shortener with ai support chat. portfolio project of canary443, web evolution of https://github.com/canary443/cli-url-shortener (python cli). one public repo, one vercel deployment.

## architecture (read this first)

one vercel project serves both frontend and backend:

- frontend: next.js 16 app router + typescript + tailwind v4. ui only, zero business logic
- backend: fastapi in `api/index.py`. vercel builds any `api/*.py` into a python serverless function. files/dirs starting with `_` inside `api/` are NOT built as functions, so all backend modules live in `api/_lib/`
- routing glue: `next.config.ts` rewrites
  - `/api/py/:path*` -> fastapi (dev: `http://127.0.0.1:8000`, prod: the `/api/` function)
  - `/:code([a-zA-Z0-9]{4,10})` -> fastapi redirect handler. rewrites run after filesystem routes, so real pages (`/login`, `/dashboard`) always win over short codes
- db + auth: supabase (postgres with rls, supabase auth). backend uses the service role key and is the only writer. frontend uses supabase-js with the anon key only for auth (sign in/up/oauth/session)
- ai: willowapi.digital, openai-compatible api (`https://willowapi.digital/v1`). chat model `gpt-5.6-luna` (streaming), image model gpt image (used only at dev time for banners, 2k=$0.005, 4k=$0.010 per image)

## file map

- `api/index.py` - all fastapi routes, thin handlers only
- `api/_lib/config.py` - env access + tiny .env loader + all tunable constants (ttl, rate limits)
- `api/_lib/db.py` - cached supabase service client
- `api/_lib/codes.py` - short code generation (secrets, 6 chars, no lookalike chars)
- `api/_lib/validate.py` - target url validation (see security section)
- `api/_lib/ratelimit.py` - wrapper around the `check_rate_limit` rpc
- `api/_lib/auth.py` - resolves user from a supabase access token via `GET /auth/v1/user` (works regardless of jwt signing config)
- `api/_lib/chat.py` - system prompt + streaming proxy to willowapi
- `app/layout.tsx` - fonts (inter + jetbrains mono via next/font), ThemeProvider, Nav, Footer, ChatWidget
- `app/page.tsx` - home: hero + shorten form + three fact cells
- `app/login/page.tsx` - sign in / create account + github oauth (client component)
- `app/dashboard/page.tsx` - user links: list, copy, delete, clicks, sign out
- `components/` - nav, footer, theme-provider, theme-toggle, shorten-form, chat-widget
- `lib/supabase.ts` - browser supabase client singleton + accessToken() helper
- `supabase/migrations/*.sql` - source of truth for db schema, already applied to the live project
- `tests/` - pytest for pure backend logic (validation, codes)
- `Plans/` - gitignored, agent plans, see Plans/README.md for naming and format
- `Handoff.md` - running state log, newest entry on top

## backend endpoints

| method | path | auth | what it does |
|--------|------|------|--------------|
| GET | /api/py/health | no | `{"status": "ok"}` |
| POST | /api/py/shorten | optional | body `{url}`. anon: 1h ttl, 10/h per ip. signed in: permanent, 60/h. returns `{code, short_url, expires_at}`. 422 bad url, 429 rate limited |
| GET | /api/py/links | required | last 50 links of the user + site_url |
| DELETE | /api/py/links/{id} | required | deletes own link only (checks user_id) |
| POST | /api/py/chat | optional | body `{messages:[{role,content}]}`. streams plain text. anon 10/h, user 50/h. history capped at 12 messages, content at 2000 chars |
| GET | /{code} | no | 302 to target, expired/missing -> 302 to `/?notfound=1`, click counted in background task |

## database (supabase)

project id: `doaujyzqarexjdeblmjs`, region eu-central-1, free tier. url: https://doaujyzqarexjdeblmjs.supabase.co

- `links`: id uuid pk, code text unique, target_url text, user_id uuid nullable fk auth.users, created_at, expires_at nullable (set only for anonymous links), clicks bigint
- `rate_limits`: (key, action, window_start) pk, count. fixed window counters
- rpcs (security definer, execute revoked from anon/authenticated, backend only):
  - `check_rate_limit(p_key, p_action, p_max, p_window_seconds) -> bool` - atomic upsert + count check
  - `increment_clicks(p_code)` - called after redirects
  - `cleanup_expired()` - deletes expired links + rate limit rows older than a day
- pg_cron job `cleanup-expired-links` runs cleanup_expired() hourly
- rls: users select/delete own links only. no insert policy on purpose - inserts go through the backend with service role

## env vars (.env, gitignored; .env.example is the template)

| var | used by | where to get |
|-----|---------|--------------|
| NEXT_PUBLIC_SUPABASE_URL | frontend + backend | already set |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | frontend auth + backend token check | already set |
| SUPABASE_SERVICE_ROLE_KEY | backend db writes | supabase dashboard -> project settings -> api keys. MISSING, user must paste |
| WILLOW_API_KEY | chat proxy + willow-mcp | https://willowapi.digital/dashboard. MISSING, user must paste |
| NEXT_PUBLIC_SITE_URL | short link display + loop guard | http://localhost:3000 locally, deployment url on vercel |

## commands

- `npm run dev` - next (3000) + uvicorn (8000) via concurrently. python deps: `.venv/bin/pip install -r requirements-dev.txt` (local venv `.venv`, python 3.14)
- `.venv/bin/python -m pytest tests/ -q` - backend tests, must stay green
- `npm run build` - production build, must pass before any push
- `npm run lint` - eslint

## design system (do not drift from this)

- direction: institutional minimalism (reference opzero.ru). sparse copy, generous whitespace, thin `--line` borders, grid sections, almost no motion (single `rise` keyframe, 220ms)
- fonts: inter (ui) + jetbrains mono (wordmark `s://`, short codes, urls, numbers/data)
- tokens live in `app/globals.css` as css vars, flipped by `.dark` class: background, surface, foreground, muted, line, accent, accent-soft, danger. never hardcode hex in components, use `bg-background`, `text-muted`, `border-line`, etc
- dark is the default theme (next-themes, class attribute, system detection off). every screen must look right in both themes
- green accent is reserved for success/live moments only (created link, status dot, active chat). primary buttons are `bg-foreground text-background`
- accessibility floor: visible focus (focus-visible:outline-2 outline-accent), aria labels on icon buttons, 4.5:1 contrast, prefers-reduced-motion respected in globals.css
- svg icons only (inline, stroke 1.8), never emoji

## security rules

- url validation (`api/_lib/validate.py`): http/https only, blocks javascript:/data:, localhost, *.local/*.internal, private/loopback/link-local ips, own domain (loop), >2048 chars. bare domains get https:// prefixed
- all secrets server-side only. the only NEXT_PUBLIC_ vars are the supabase url/anon key (public by design)
- every write endpoint is rate limited through the db rpc
- backend never fetches target urls, it only redirects browsers to them

## project rules (non-negotiable, set by the owner)

- code comments strictly lowercase, in every language
- page copy simple and short. no long dashes (—) anywhere: code, copy, docs, commits. use short ones (-)
- commits: author canary443 (repo-local git config already set: name canary443, email 145488867+canary443@users.noreply.github.com). message style: lowercase, short one-liner ("implemented redirect route", "fixed rate limit window"), no bodies, no trailers, no co-authored-by. commit often, push after meaningful chunks
- update Handoff.md after every 5-10 changes (newest entry on top, timestamped)
- keep AGENTS.md (this file) and CLAUDE.md current when architecture or rules change
- plans go to Plans/ (gitignored) named `AGENT_DD-MM_HH-MM.md`, see Plans/README.md
- readme must be written in plain human language (humanizer skill), keep it simple

## current state and blockers (2026-07-14)

done: scaffold, supabase project + schema, full backend, home/login/dashboard/chat ui, 16 pytest tests green, repo live at https://github.com/canary443/web-url-shortener

blocked on user input:
1. SUPABASE_SERVICE_ROLE_KEY -> .env (until then backend writes fail locally)
2. WILLOW_API_KEY -> .env (chat + banner generation)
3. github oauth app (github settings -> developer settings -> oauth apps -> new, callback url `https://doaujyzqarexjdeblmjs.supabase.co/auth/v1/callback`), then enable the github provider in supabase auth settings with the client id/secret

not started yet: willow-mcp server (`tools/willow-mcp/`, python, official `mcp` sdk, registered in `.mcp.json`), ai banners in `public/banners/` (webp), vercel deployment, final readme, github actions ci (pytest + build)
