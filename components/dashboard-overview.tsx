"use client";

import { useEffect, useState } from "react";

type LinkSummary = {
  id: string;
  code: string;
  expires_at: string | null;
  clicks: number;
};

type ApiEvent = {
  action: string;
  code: string | null;
  created_at: string;
};

export function timeLeft(expiresAt: string | null, now: number): string {
  // rows created before the 31-day policy have no expiry until the migration runs
  if (!expiresAt) return "no expiry";
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "expired";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 48) return `${hours}h left`;
  return `${Math.round(hours / 24)}d left`;
}

function eventTime(createdAt: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function CountUp({ target }: { target: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 0 : 700;
    let raf = 0;
    const start = performance.now();
    const tick = (time: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return <>{value}</>;
}

export function StatPills({ links }: { links: LinkSummary[] }) {
  const [now] = useState(() => Date.now());
  const nextExpiry = links
    .map((link) => link.expires_at)
    .filter((value): value is string => Boolean(value))
    .filter((value) => new Date(value).getTime() > now)
    .sort()[0];
  const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0);
  const stats: [string, React.ReactNode][] = [
    ["links", <CountUp key="links" target={links.length} />],
    ["total clicks", <CountUp key="clicks" target={totalClicks} />],
    ["next expiry", nextExpiry ? timeLeft(nextExpiry, now) : "none"],
  ];

  return (
    <ul className="fact-seq relative z-10 mt-10 grid gap-2 sm:grid-cols-3">
      {stats.map(([label, value]) => (
        <li key={label}>
          <span className="fact-pill block rounded-xl bg-background/80 px-5 py-4 backdrop-blur transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:bg-background hover:shadow-md">
            <span className="block text-xs font-medium text-muted">{label}</span>
            <span className="mt-1.5 block text-3xl font-bold tabular-nums">
              {value}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ClicksChart({ links }: { links: LinkSummary[] }) {
  const chart = [...links]
    .filter((link) => link.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 8);
  const maxClicks = Math.max(1, ...chart.map((link) => link.clicks));

  return (
    <section aria-labelledby="clicks-heading" className="rounded-2xl bg-surface p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-accent-ink">
            performance
          </p>
          <h2 id="clicks-heading" className="mt-1.5 text-lg font-semibold">
            clicks per link
          </h2>
        </div>
        {chart.length > 0 && <span className="text-xs text-muted">top {chart.length}</span>}
      </div>

      {chart.length === 0 ? (
        <p className="mt-5 rounded-xl bg-background p-4 text-sm leading-relaxed text-muted">
          click data appears here once someone opens one of your links.
        </p>
      ) : (
        <div
          className="mt-5 space-y-2.5"
          role="img"
          aria-label="clicks per link bar chart"
        >
          {chart.map((link) => (
            <div
              key={link.id}
              className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-2.5"
            >
              <span className="truncate font-mono text-xs">/{link.code}</span>
              <div className="h-5 overflow-hidden rounded-sm bg-background">
                <div
                  className="h-full min-w-px origin-left bg-accent-ink transition-[width] duration-500"
                  style={{ width: `${(link.clicks / maxClicks) * 100}%` }}
                />
              </div>
              <span className="text-right text-sm font-semibold tabular-nums">
                {link.clicks}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ActivityLog({ events }: { events: ApiEvent[] | null }) {
  return (
    <section aria-labelledby="activity-heading" className="rounded-2xl bg-surface p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase text-accent-ink">api</p>
      <h2 id="activity-heading" className="mt-1.5 text-lg font-semibold">
        recent activity
      </h2>

      {events === null ? (
        <div className="mt-5 h-28 animate-pulse rounded-xl bg-background" aria-hidden />
      ) : events.length === 0 ? (
        <div className="mt-5 rounded-xl bg-background p-4">
          <p className="text-sm text-muted">no api activity yet.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            calls made with your account token or api key will show up here.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-1.5">
          {events.slice(0, 6).map((event, index) => (
            <li
              key={`${event.created_at}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{event.action}</p>
                {event.code && (
                  <p className="truncate font-mono text-xs text-muted">
                    /{event.code}
                  </p>
                )}
              </div>
              <time
                className="shrink-0 text-xs text-muted"
                dateTime={event.created_at}
              >
                {eventTime(event.created_at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
