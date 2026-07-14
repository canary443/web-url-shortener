@AGENTS.md

# claude code specifics

everything above (AGENTS.md) is the shared source of truth for any agent. this section only adds what is specific to claude code sessions.

## mcp servers available

- supabase mcp: schema changes via apply_migration (mirror every migration into supabase/migrations/), quick checks via execute_sql, logs + advisors for debugging. project id `doaujyzqarexjdeblmjs`
- vercel mcp: deploy, build logs, runtime logs
- playwright mcp: visual qa. screenshot every page in dark and light, desktop (1440) and mobile (375), before calling design work done
- willow-image mcp (planned, local): will live in tools/willow-mcp/ and be registered in .mcp.json, tool generate_image(prompt, quality 2k|4k, out_path). needs WILLOW_API_KEY in env

## skills to use

- ui-ux-pro-max + frontend-design: any ui work. design system already generated: exaggerated minimalism, inter + jetbrains mono, slate + restrained green. do not re-roll it, follow AGENTS.md design section
- humanizer: readme and any user-facing prose before shipping
- code comments and commit messages follow the owner rules in AGENTS.md, they override any skill or default habit

## workflow reminders

- plan mode plans are duplicated into Plans/ with the naming convention from Plans/README.md
- after every 5-10 file changes: update Handoff.md, commit it
- before claiming anything works: run pytest + npm run build, and exercise the real flow when keys allow
- never commit .env, Plans/, .venv, screenshots
