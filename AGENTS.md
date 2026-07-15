<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# web-url-shortener

## start here (60 seconds of context)

you are working on a portfolio project of **canary443**: a minimal url shortener
website (brand: **lynka**) with account dashboards and api access. it is the web
evolution of their python cli tool
(https://github.com/canary443/cli-url-shortener). the owner switches between ai
agents (claude, gpt, others) mid-project, so these files are the entire context
transfer. everything you need is written down, nothing lives only in chat history.

**reading order, do not skip:**
1. this file - what the project is and how it is built
2. `RULES.md` (local, gitignored) - all owner rules, session protocol, commit style, definition of done
3. `SECURITY.md` (local, gitignored) - live keys, budgets, threat model, security rules
4. `STRUCTURE.md` (local, gitignored) - file-by-file map and recipes for common changes
5. `MEMORY.md` (local, gitignored) - hard-won gotchas, do not re-learn them
6. `Handoff.md` - what is done, what is verified, current blockers, ordered next steps
7. `Plans/` (local, gitignored) - current plan + `Plans/Resolutions/` phase outcome logs
8. `CODE_REVIEW.md` (local, gitignored) - open review findings, check before touching flagged areas

**never do:** commit .env or any secret, use long dashes anywhere, write comments
starting with a capital letter, change the repo-local git identity, push without
running `scripts/qa.sh`, redesign the ui away from the design system below.

## the product

- home page: paste a url, get a short link. works without an account
- anonymous links live 60 minutes, 10 per hour per ip, no click statistics
- signed in users (github oauth or email/password): links live 31 days with
  click counts, 5 shortens per minute, dashboard with copy, delete, stats
- `GET /{code}` redirects and counts the click (signed-in links only)
- one api key per account, shown once and stored as a hash. regenerating
  invalidates the old key. settings are locked at 5 rpm and 31-day links,
  higher limits go through the support contacts
- pages: `/` home, `/login`, `/dashboard`, `/docs` (api), `/privacy`, `/terms`,
  `/reset-password`
- support contacts (public): telegram @aimwork, a@leet-cheats.xyz
- free tier everything, no trackers, minimal design

## architecture

one vercel project serves both frontend and backend:

- **frontend**: next.js 16 app router + typescript + tailwind v4. ui only, zero business logic
- **backend**: fastapi in `api/index.py`. vercel builds any `api/*.py` into a python serverless function. underscore paths (`api/_lib/`) are not built as functions, all backend modules live there
- **routing glue** (`next.config.ts` rewrites):
  - `/api/py/:path*` -> fastapi (dev: `http://127.0.0.1:8000`, prod: the `/api/` function)
  - `/:code([a-zA-Z0-9]{4,10})` -> fastapi redirect handler. rewrites run after filesystem routes, so real pages (`/login`, `/dashboard`) always win over short codes
- **db + auth**: supabase (postgres + rls + supabase auth). backend holds the service role key and is the only writer. frontend uses supabase-js with the anon key only for auth flows
- **images**: willowapi.digital, dev-time only for static banners (gpt-image-2, 2k=$0.005, 4k=$0.010). no runtime image generation

## file map

- `api/index.py` - all fastapi routes, thin handlers only
- `api/_lib/config.py` - env access + tiny .env loader + tunable constants (ttl, rate limits)
- `api/_lib/db.py` - cached supabase service client
- `api/_lib/codes.py` - short code generation (secrets, 6 chars, no lookalikes)
- `api/_lib/validate.py` - target url validation (see security)
- `api/_lib/ratelimit.py` - `allow` wraps the `check_rate_limit` rpc, `allow_read` fails open for read endpoints
- `api/_lib/auth.py` - user from access token via `GET /auth/v1/user` (signing-agnostic)
- `api/_lib/api_keys.py` - api key generation, sha-256 hashing, owner lookup, per-account settings
- `api/_lib/link_policy.py` - who gets which link ttl and who collects clicks
- `api/_lib/abuse.py` - keyed email fingerprint for signup abuse events
- `app/layout.tsx` - fonts, Nav and Footer
- `app/page.tsx` - home: tinted hero + shorten form + feature grid + api banner
- `app/login/page.tsx` - sign in / create account (terms checkbox, spam notice) + github oauth
- `app/dashboard/page.tsx` - overview band, links list with copy chips, api access, security
- `app/docs/`, `app/privacy/`, `app/terms/` - api docs and legal pages
- `app/reset-password/page.tsx` - sets a new password from the email recovery link
- `app/icon.svg` + `app/favicon.ico` - keycap "l" favicon
- `components/` - nav, footer, logo (keycap tiles), shorten form, reveal, dashboard-overview
- `lib/supabase.ts` - browser supabase client singleton + accessToken() helper
- `supabase/migrations/*.sql` - db schema source of truth (apply status: Handoff.md)
- `tests/` - pytest: pure logic + route-level degradation contracts (fastapi TestClient)
- `scripts/qa.sh` - the qa gate, run before claiming work done
- `tools/willow-mcp/` - python stdio mcp server + cli for image generation, registered in .mcp.json
- `PROMPTS.md` - final art prompts and the magenta chroma-key workflow
- `Handoff.md`, `RULES.md`, `MEMORY.md`, `SECURITY.md`, `STRUCTURE.md`, `CODE_REVIEW.md`, `Plans/` - agent files, see start here

## backend endpoints

| method | path | auth | behavior |
|--------|------|------|----------|
| GET | /api/py/health | no | `{"status": "ok"}` |
| POST | /api/py/shorten | optional | body `{url}`. anon: 60 min ttl, 10/h per ip. user token: 31 days, 5/min. `x-api-key`: 31 days, key rpm. `expires_in` is locked -> 422. returns `{code, short_url, expires_at}`. 401 bad key, 422 bad url, 429 limited, 503 keys not migrated |
| GET | /api/py/api-key | required | key prefix + locked settings, 503 until the api_keys migration runs |
| POST | /api/py/api-key | required | creates or regenerates the key, returns it once. 5/h |
| GET | /api/py/links | required | last 50 links of the user + site_url |
| DELETE | /api/py/links/{id} | required | deletes own link only |
| GET | /api/py/logs | required | last 20 api events of the caller, `[]` until migrated |
| POST | /api/py/auth/signup-event | no | best-effort signup abuse telemetry (ip + keyed email fingerprint), 5/h per ip |
| GET | /{code} | no | 302 to target, expired/missing -> 302 `/?notfound=1`, click counted in background for signed-in links |

read endpoints rate limit through `allow_read` (fails open on db hiccups), write
endpoints stay strict. shorten/delete log into `api_events` via background tasks
and tolerate the table not existing yet.

## database (supabase)

project id `doaujyzqarexjdeblmjs`, eu-central-1, free tier, url https://doaujyzqarexjdeblmjs.supabase.co

- `links`: id uuid pk, code unique, target_url, user_id nullable fk auth.users, created_at, expires_at, clicks bigint
- `rate_limits`: (key, action, window_start) pk, count - fixed window counters
- `api_keys`: user_id pk, key_hash unique, key_prefix, rpm, link_ttl_seconds, timestamps. service role only
- `api_events`: per-user api activity for the dashboard log. service role only
- `signup_events`: ip + keyed email fingerprint, 30 day retention. service role only
- `keepalive_events`: one row per day from pg_cron, keeps the free project warm
- rpcs (security definer, execute revoked from anon/authenticated):
  - `check_rate_limit(key, action, max, window_seconds) -> bool`
  - `increment_clicks(code)` (counts signed-in links only)
  - `cleanup_expired()` + pg_cron jobs: hourly cleanup, daily `lynka-daily-keepalive` at 07:00 utc
- rls: users select/delete own links only. no insert policy on purpose, inserts go through the backend
- schema changes: apply to live db AND mirror the sql into `supabase/migrations/`

## env vars (.env local, gitignored; .env.example is the template)

| var | used by | status |
|-----|---------|--------|
| NEXT_PUBLIC_SUPABASE_URL | frontend auth + backend | set |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | frontend auth + backend token check | set |
| SUPABASE_SERVICE_ROLE_KEY | backend writes | set, goes to prod env too |
| WILLOW_IMAGE_API_KEY | willow-mcp image generation, dev only, never deployed | set |
| WILLOW_IMAGE_MULLVAD_EXITS | optional mullvad relay names for willow-mcp | optional |
| NEXT_PUBLIC_SITE_URL | short link display + loop guard | localhost, becomes deploy url |

## commands

- `npm run dev` - next (3000) + uvicorn (8000) together (concurrently -k, venv python, a dead backend kills the whole command loudly)
- `.venv/bin/python -m pytest tests/ -q` - backend tests
- `npm run build` / `npm run lint`
- `./scripts/qa.sh` - full gate: pytest, eslint, long dash check, backend boot + health, build. must be green before any push

## design system (locked, do not re-roll)

- direction: light only, follows aeza.net closely. dark mode is intentionally gone
- palette (css vars in `app/globals.css`): white page, `#f4f4f5` surface cards,
  `#ddfbff` tinted hero containers, cyan accents (`#35c6f4` fills, `#076e99`
  readable ink), `#08090c` black media frames for artwork and code examples
- fonts: inter (ui, aeza uses it live), geist mono (codes, urls, numbers),
  fira code (terminal blocks via the `font-code` utility). inputs stay sans
- logo: keycap letter tiles built in code (`components/logo.tsx`), hover wave
- motion: staggered entrances (`rise-seq`, `fact-seq`), hover lifts, keycap
  presses. 150-300ms, `prefers-reduced-motion` respected
- primary buttons are `bg-foreground text-background` (black). cyan is for
  eyebrows, highlights and positive moments. never hardcode hex in components,
  use `bg-background`, `text-muted`, `border-line` etc
- accessibility floor: `focus-visible:outline-2 outline-accent-ink`, aria
  labels on icon buttons, 4.5:1 contrast, no horizontal scroll at 375
- inline svg icons (stroke 1.8) only, never emoji
- static artwork: webp in `public/banners/`, generated dev-time via willow-mcp.
  prompts and the magenta chroma-key cutout workflow live in `PROMPTS.md`

## security

- url validation: http/https only, blocks javascript:/data:, localhost, *.local/*.internal, private/loopback/link-local ips, own domain, >2048 chars. bare domains get https://
- backend never fetches target urls, it only redirects browsers
- all secrets server-side. every write endpoint rate limited through the db rpc
- api keys: shown once, stored as sha-256 hashes, replaced atomically on regenerate. never in frontend code or NEXT_PUBLIC_ vars
- signup abuse telemetry stores a keyed hash of the email, never the plaintext
- security headers in next.config.ts (nosniff, frame deny, referrer, permissions)

## state and rules

- current state, verification status and blockers: `Handoff.md` (single source of truth for "where are we")
- complete owner rules, setup checklist, commit cadence, definition of done: `RULES.md` (local)
- repo: https://github.com/canary443/web-url-shortener (public, this is a portfolio piece - code quality is the product)
