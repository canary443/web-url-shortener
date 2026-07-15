# lynka

a tiny url shortener, live at [lynka.xyz](https://lynka.xyz). paste a long url,
get a short one. no trackers, no popups.

web evolution of my [cli shortener](https://github.com/canary443/cli-url-shortener).

## what it does

- anonymous shortening: 60 minute links, 10 per hour, nothing asked
- accounts (github or email): links live 31 days, click counts, a dashboard
- api access: one key per account, 5 requests per minute, docs at [/docs](https://lynka.xyz/docs)
- admin panel for moderation: suspensions with optional email notice, link removal
- bot defense: cloudflare turnstile on sign in and sign up, and a captcha
  demanded from anonymous traffic that looks automated (datacenter ips,
  bursts across the service)

## how it works

one vercel project serves both halves:

- frontend: next.js 16 app router + tailwind v4, ui only
- backend: fastapi in `api/index.py`, built by vercel as a python function.
  the logic lives in `api/_lib/` modules
- rewrites glue them together: `/api/py/*` goes to fastapi, `/{code}` hits the
  redirect handler after real pages get a chance to match
- supabase holds postgres and auth. the backend is the only writer, the
  browser talks to supabase just for auth flows
- rate limits are fixed windows counted in postgres, pg_cron deletes expired
  links every hour

## api in one line

```bash
curl -X POST https://lynka.xyz/api/py/shorten \
  -H "x-api-key: $KEY" \
  -H "content-type: application/json" \
  -d '{"url": "https://example.com/long"}'
```

no key? the same endpoint works anonymously with tighter limits.

## run it locally

```bash
npm install
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env   # fill in the supabase keys
npm run dev            # next on :3000, fastapi on :8000
```

tests and the full quality gate:

```bash
.venv/bin/python -m pytest tests/ -q
./scripts/qa.sh
```

## license

agpl-3.0. use it, fork it, learn from it, but keep it open source.
