"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityLog,
  ClicksChart,
  StatPills,
  timeLeft,
} from "@/components/dashboard-overview";
import { accessToken, supabase } from "@/lib/supabase";

type LinkRow = {
  id: string;
  code: string;
  target_url: string;
  created_at: string;
  expires_at: string | null;
  clicks: number;
};

type ApiEvent = {
  action: string;
  code: string | null;
  created_at: string;
};

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden
    >
      <path d="m5 13 4 4 10-10" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M14 5h5v5M19 5l-8 8M19 14v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [events, setEvents] = useState<ApiEvent[] | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "clicks">("newest");
  const [error, setError] = useState<string | null>(null);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    // state updates happen inside promise callbacks, never synchronously in an effect
    accessToken()
      .then(async (token) => {
        if (!token) {
          router.replace("/login");
          return;
        }
        const headers = { authorization: `Bearer ${token}` };
        // links are the page, the activity log only decorates it
        const [linksRes, logsRes] = await Promise.allSettled([
          fetch("/api/py/links", { headers }),
          fetch("/api/py/logs", { headers }),
        ]);
        if (linksRes.status === "rejected" || !linksRes.value.ok) {
          if (linksRes.status === "fulfilled" && linksRes.value.status === 401) {
            router.replace("/login");
            return;
          }
          if (linksRes.status === "fulfilled" && linksRes.value.status === 403) {
            setSuspended(true);
            return;
          }
          setError("could not load your links. refresh to retry.");
          return;
        }
        const data = await linksRes.value.json();
        setLinks(data.links);
        setSiteUrl(data.site_url);
        if (logsRes.status === "fulfilled" && logsRes.value.ok) {
          const logsData = await logsRes.value.json();
          setEvents(logsData.events);
        } else {
          setEvents([]);
        }
      })
      .catch(() => setError("could not load your links. refresh to retry."));
  }, [router]);

  useEffect(() => {
    supabase()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
    };
  }, []);

  async function remove(id: string) {
    // first tap arms the button, the second within 3s deletes
    if (armedId !== id) {
      setArmedId(id);
      if (disarmTimer.current) clearTimeout(disarmTimer.current);
      disarmTimer.current = setTimeout(() => setArmedId(null), 3000);
      return;
    }
    setArmedId(null);
    const token = await accessToken();
    if (!token) return;
    // optimistic removal, the row comes back on failure
    const prev = links;
    setLinks((cur) => cur?.filter((l) => l.id !== id) ?? null);
    const res = await fetch(`/api/py/links/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setLinks(prev ?? null);
      setError("delete failed. try again.");
    }
  }

  async function copy(link: LinkRow) {
    await navigator.clipboard.writeText(`${siteUrl}/${link.code}`);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  const [now] = useState(() => Date.now());
  const filtered = (
    links?.filter(
      (link) =>
        link.code.toLowerCase().includes(query.toLowerCase()) ||
        link.target_url.toLowerCase().includes(query.toLowerCase())
    ) ?? []
  ).sort((a, b) =>
    sortBy === "clicks"
      ? b.clicks - a.clicks
      : Date.parse(b.created_at) - Date.parse(a.created_at)
  );

  if (suspended) {
    // a suspended account sees why, and nothing else works on purpose
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-5">
        <section className="rise relative overflow-hidden rounded-3xl bg-accent-tint px-6 py-12 sm:px-10">
          <p className="text-sm font-medium text-accent-ink">dashboard</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            account <em>suspended</em>
          </h1>
          {email && <p className="mt-3 text-sm text-muted">{email}</p>}
        </section>
        <section className="rise mt-4 rounded-2xl bg-surface p-6 sm:p-8">
          <p className="text-sm leading-relaxed text-muted">
            this account was suspended for breaking the{" "}
            <Link href="/terms" className="text-foreground underline-offset-4 hover:underline">
              terms of service
            </Link>
            . creating links, the dashboard and api keys are disabled while the
            suspension lasts. existing links keep their expiry dates.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            if you believe this is a mistake, contact{" "}
            <a href="https://t.me/aimwork" target="_blank" rel="noreferrer" className="text-foreground underline-offset-4 hover:underline">
              @aimwork
            </a>{" "}
            or{" "}
            <a href="mailto:a@leet-cheats.xyz" className="text-foreground underline-offset-4 hover:underline">
              a@leet-cheats.xyz
            </a>{" "}
            from the email on this account.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-5">
      {/* tinted header band, same language as the home hero */}
      <section className="relative overflow-hidden rounded-3xl bg-accent-tint px-6 py-10 sm:px-10 sm:py-12">
        <div className="rise-seq">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium text-accent-ink">dashboard</p>
            <div className="flex gap-2">
              <Link
                href="/settings"
                className="rounded-xl bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-background hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent-ink"
              >
                settings
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="cursor-pointer rounded-xl bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-background hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent-ink"
              >
                sign out
              </button>
            </div>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            your <em>links</em>
          </h1>
          {email && <p className="mt-3 text-sm text-muted">{email}</p>}
        </div>

        {links === null ? (
          <div className="mt-10 grid gap-2 sm:grid-cols-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[5.5rem] animate-pulse rounded-xl bg-background/60" />
            ))}
          </div>
        ) : (
          <StatPills links={links} />
        )}
      </section>

      {error && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {error}
        </p>
      )}

      {/* main object: the links, full width */}
      <section
        aria-labelledby="all-links-heading"
        className="rise mt-4 rounded-2xl bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-accent-ink">
              manage
            </p>
            <h2 id="all-links-heading" className="mt-1.5 text-lg font-semibold">
              all links
              {links !== null && links.length > 0 && (
                <span className="ml-2 text-sm font-normal text-muted">
                  {links.length}
                </span>
              )}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {links !== null && links.length > 1 && (
              <div
                className="flex rounded-lg border border-line bg-background p-0.5"
                role="group"
                aria-label="sort links"
              >
                {(["newest", "clicks"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSortBy(key)}
                    aria-pressed={sortBy === key}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent-ink ${
                      sortBy === key
                        ? "bg-foreground text-background"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            )}
            {links !== null && links.length > 8 && (
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="filter"
                aria-label="filter links"
                className="h-9 w-36 rounded-lg border border-line bg-background px-3 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent-ink"
              />
            )}
            <Link
              href="/"
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              create link
            </Link>
          </div>
        </div>

        {links === null && !error && (
          <ul className="mt-5 space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-16 animate-pulse rounded-xl bg-background" />
            ))}
          </ul>
        )}

        {links !== null && links.length === 0 && (
          <div className="mt-5 rounded-xl bg-background px-6 py-12 text-center">
            <p className="text-sm text-muted">
              no links yet. paste something long on the home page.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              shorten a url
            </Link>
          </div>
        )}

        {links !== null && links.length > 0 && filtered.length === 0 && (
          <p className="mt-5 rounded-xl bg-background px-4 py-8 text-center text-sm text-muted">
            nothing matches &quot;{query}&quot;.
          </p>
        )}

        {filtered.length > 0 && (
          <ul className="mt-5 space-y-2">
            {filtered.map((link, index) => (
              <li
                key={link.id}
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
                className="rise grid gap-3 rounded-xl bg-background px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {/* the short code is a keycap: press it to copy */}
                    <button
                      type="button"
                      onClick={() => copy(link)}
                      aria-label={`copy short link /${link.code}`}
                      className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border px-3 font-mono text-sm font-semibold shadow-[0_2px_0_rgba(10,11,13,0.08)] transition-[transform,box-shadow,background-color,border-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-accent-ink active:translate-y-0.5 active:shadow-none ${
                        copiedId === link.id
                          ? "border-accent bg-accent-tint text-accent-ink"
                          : "border-line bg-surface hover:border-foreground/25"
                      }`}
                    >
                      /{link.code}
                      <span className={copiedId === link.id ? "text-accent-ink" : "text-muted"}>
                        {copiedId === link.id ? <CheckIcon /> : <CopyIcon />}
                      </span>
                    </button>
                    <a
                      href={`${siteUrl}/${link.code}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`open /${link.code} in a new tab`}
                      className="rounded-md p-1.5 text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent-ink"
                    >
                      <OpenIcon />
                    </a>
                  </div>
                  <p className="mt-1.5 truncate text-sm text-muted" title={link.target_url}>
                    {link.target_url}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted sm:flex-col sm:items-end sm:gap-1.5">
                  <span className="font-medium tabular-nums">
                    <span className="text-sm font-semibold text-foreground">
                      {link.clicks}
                    </span>{" "}
                    {link.clicks === 1 ? "click" : "clicks"}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 ${
                      timeLeft(link.expires_at, now) === "expired"
                        ? "bg-danger/10 text-danger"
                        : "bg-surface"
                    }`}
                  >
                    {timeLeft(link.expires_at, now)}
                  </span>
                </div>
                <div className="flex sm:justify-end">
                  <button
                    type="button"
                    onClick={() => remove(link.id)}
                    aria-label={
                      armedId === link.id
                        ? `confirm deleting /${link.code}`
                        : `delete /${link.code}`
                    }
                    className={`h-9 cursor-pointer rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-danger ${
                      armedId === link.id
                        ? "bg-danger font-medium text-white"
                        : "border border-transparent text-muted hover:border-danger/40 hover:text-danger"
                    }`}
                  >
                    {armedId === link.id ? "sure?" : "delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* insight row */}
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
        {links !== null && <ClicksChart links={links} />}
        <ActivityLog events={events} />
      </div>
    </div>
  );
}
