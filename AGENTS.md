<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# web-url-shortener

## start here (60 seconds of context)

you are working on a portfolio project of **canary443**: a minimal url shortener
website with an ai support chat. it is the web evolution of their python cli tool
(https://github.com/canary443/cli-url-shortener). the owner switches between ai
agents (claude, gpt, others) mid-project, so these files are the entire context
transfer. everything you need is written down, nothing lives only in chat history.

**reading order, do not skip:**
1. this file - what the project is and how it is built
2. `RULES.md` (local, gitignored) - all owner rules, setup checklist, commit style, definition of done
3. `MEMORY.md` (local, gitignored) - hard-won gotchas, do not re-learn them
4. `Handoff.md` - what is done, what is verified, current blockers, ordered next steps
5. `Plans/` (local, gitignored) - the current implementation plan, newest file wins

**never do:** commit .env or any secret, use long dashes anywhere, write comments
starting with a capital letter, change the repo-local git identity, push without
running `scripts/qa.sh`, redesign the ui away from the design system below.

## the product

- home page: paste a url, get a short link. works without an account
- anonymous links expire after 1 hour, 10 per hour per ip
- signed in users (github oauth or email/password): permanent links, 60 per hour, dashboard with click counts, copy, delete
- `GET /{code}` redirects and counts the click
- floating ai support chat (gpt-5.6-luna) that knows the service and, for signed in users, their recent links. anon 10 msg/h, user 50 msg/h
- free tier everything, no trackers, minimal design

## architecture

one vercel project serves both frontend and backend:

- **frontend**: next.js 16 app router + typescript + tailwind v4. ui only, zero business logic
- **backend**: fastapi in `api/index.py`. vercel builds any `api/*.py` into a python serverless function. underscore paths (`api/_lib/`) are not built as functions, all backend modules live there
- **routing glue** (`next.config.ts` rewrites):
  - `/api/py/:path*` -> fastapi (dev: `http://127.0.0.1:8000`, prod: the `/api/` function)
  - `/:code([a-zA-Z0-9]{4,10})` -> fastapi redirect handler. rewrites run after filesystem routes, so real pages (`/login`, `/dashboard`) always win over short codes
- **db + auth**: supabase (postgres + rls + supabase auth). backend holds the service role key and is the only writer. frontend uses supabase-js with the anon key only for auth flows
- **ai**: willowapi.digital, openai-compatible (`https://willowapi.digital/v1`, bearer auth). chat: `gpt-5.6-luna` streaming. images: gpt image, dev-time only for banners (2k=$0.005, 4k=$0.010)

## file map

- `api/index.py` - all fastapi routes, thin handlers only
- `api/_lib/config.py` - env access + tiny .env loader + tunable constants (ttl, rate limits)
- `api/_lib/db.py` - cached supabase service client
- `api/_lib/codes.py` - short code generation (secrets, 6 chars, no lookalikes)
- `api/_lib/validate.py` - target url validation (see security)
- `api/_lib/ratelimit.py` - wrapper around the `check_rate_limit` rpc
- `api/_lib/auth.py` - user from access token via `GET /auth/v1/user` (signing-agnostic)
- `api/_lib/chat.py` - system prompt + streaming proxy to willowapi
- `app/layout.tsx` - fonts (inter + jetbrains mono), ThemeProvider, Nav, Footer, ChatWidget
- `app/page.tsx` - home: hero + shorten form + three fact cells
- `app/login/page.tsx` - sign in / create account + github oauth
- `app/dashboard/page.tsx` - links list, copy, delete, clicks, sign out
- `components/` - nav, footer, theme-provider, theme-toggle, shorten-form, chat-widget
- `lib/supabase.ts` - browser supabase client singleton + accessToken() helper
- `supabase/migrations/*.sql` - db schema source of truth, already applied to live project
- `tests/` - pytest for pure backend logic
- `scripts/qa.sh` - the qa gate, run before claiming work done
- `tools/willow-mcp/` - (planned) python stdio mcp server for image generation
- `Handoff.md`, `RULES.md`, `MEMORY.md`, `Plans/` - agent files, see start here

## backend endpoints

| method | path | auth | behavior |
|--------|------|------|----------|
| GET | /api/py/health | no | `{"status": "ok"}` |
| POST | /api/py/shorten | optional | body `{url}`. anon: 1h ttl, 10/h per ip. user: permanent, 60/h. returns `{code, short_url, expires_at}`. 422 bad url, 429 limited |
| GET | /api/py/links | required | last 50 links of the user + site_url |
| DELETE | /api/py/links/{id} | required | deletes own link only |
| POST | /api/py/chat | optional | `{messages:[{role,content}]}`. streams plain text. anon 10/h, user 50/h. history cap 12, message cap 2000 chars |
| GET | /{code} | no | 302 to target, expired/missing -> 302 `/?notfound=1`, click counted in background |

## database (supabase)

project id `doaujyzqarexjdeblmjs`, eu-central-1, free tier, url https://doaujyzqarexjdeblmjs.supabase.co

- `links`: id uuid pk, code unique, target_url, user_id nullable fk auth.users, created_at, expires_at nullable (anon links only), clicks bigint
- `rate_limits`: (key, action, window_start) pk, count - fixed window counters
- rpcs (security definer, execute revoked from anon/authenticated):
  - `check_rate_limit(key, action, max, window_seconds) -> bool`
  - `increment_clicks(code)`
  - `cleanup_expired()` + pg_cron hourly job `cleanup-expired-links`
- rls: users select/delete own links only. no insert policy on purpose, inserts go through the backend
- schema changes: apply to live db AND mirror the sql into `supabase/migrations/`

## env vars (.env local, gitignored; .env.example is the template)

| var | used by | status |
|-----|---------|--------|
| NEXT_PUBLIC_SUPABASE_URL | frontend auth + backend | set |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | frontend auth + backend token check | set |
| SUPABASE_SERVICE_ROLE_KEY | backend writes | check Handoff.md |
| WILLOW_API_KEY | chat + willow-mcp | check Handoff.md |
| NEXT_PUBLIC_SITE_URL | short link display + loop guard | localhost, becomes deploy url |

## commands

- `npm run dev` - next (3000) + uvicorn (8000) together
- `.venv/bin/python -m pytest tests/ -q` - backend tests
- `npm run build` / `npm run lint`
- `./scripts/qa.sh` - full gate: pytest, eslint, long dash check, backend boot + health, build. must be green before any push

## design system (locked, do not re-roll)

- direction: institutional minimalism, reference opzero.ru. sparse copy, generous whitespace, thin `--line` borders, almost no motion (single `rise` keyframe 220ms)
- fonts: inter (ui) + jetbrains mono (wordmark `s://`, codes, urls, numbers)
- tokens are css vars in `app/globals.css`, flipped by `.dark`: background, surface, foreground, muted, line, accent, accent-soft, danger. never hardcode hex in components, use `bg-background`, `text-muted`, `border-line` etc
- dark is default (next-themes, class attribute, system detection off). every screen must work in both themes
- green accent = success/live moments only. primary buttons are `bg-foreground text-background`
- accessibility floor: `focus-visible:outline-2 outline-accent`, aria labels on icon buttons, 4.5:1 contrast, reduced motion respected
- inline svg icons (stroke 1.8) only, never emoji
- pending visual work: ai banners (aeza.net style abstract art) in `public/banners/` as webp, hero 4k, sections 2k

## security

- url validation: http/https only, blocks javascript:/data:, localhost, *.local/*.internal, private/loopback/link-local ips, own domain, >2048 chars. bare domains get https://
- backend never fetches target urls, it only redirects browsers
- all secrets server-side. every write endpoint rate limited through the db rpc
- api keys never appear in frontend code or NEXT_PUBLIC_ vars

## state and rules

- current state, verification status and blockers: `Handoff.md` (single source of truth for "where are we")
- complete owner rules, setup checklist, commit cadence, definition of done: `RULES.md` (local)
- repo: https://github.com/canary443/web-url-shortener (public, this is a portfolio piece - code quality is the product)
