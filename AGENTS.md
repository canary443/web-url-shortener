<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# web-url-shortener

minimal url shortener with ai support chat. next.js frontend, fastapi backend, both deployed as one vercel project. supabase for db and auth.

## architecture

- frontend: next.js app router + typescript + tailwind v4, ui only
- backend: fastapi in api/index.py, all business logic in python (api/_lib modules)
- next.config.ts rewrites proxy /api/py/* and /:code to fastapi (port 8000 in dev, serverless function on vercel)
- db: supabase postgres with rls, auth via supabase auth (github oauth + email/password)
- ai: willowapi.digital (openai-compatible), gpt-5.6-luna for chat, gpt image for banners
- custom mcp server for image generation lives in tools/willow-mcp/

## commands

- npm run dev - next dev + uvicorn together
- npm run build - production build
- pytest - backend tests

## rules

- code comments strictly lowercase
- page copy simple and short, no long dashes anywhere (use short ones)
- design: minimal, opzero.ru direction, dark theme default, full light theme support
- commits: lowercase, short one-liners, no bodies, no trailers, commit often
- update Handoff.md after every 5-10 changes
- plans live in Plans/ (gitignored), see Plans/README.md for the format
- secrets only in .env, never committed
