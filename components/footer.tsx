import Link from "next/link";
import { Logo } from "./logo";

const columns = [
  {
    title: "product",
    links: [
      { label: "shorten", href: "/" },
      { label: "dashboard", href: "/dashboard" },
      { label: "sign in", href: "/login" },
      { label: "api docs", href: "/docs" },
    ],
  },
  {
    title: "source",
    links: [
      {
        label: "github",
        href: "https://github.com/canary443/web-url-shortener",
        external: true,
      },
      {
        label: "cli ancestor",
        href: "https://github.com/canary443/cli-url-shortener",
        external: true,
      },
      {
        label: "agpl-3.0 license",
        href: "https://github.com/canary443/web-url-shortener/blob/main/LICENSE",
        external: true,
      },
    ],
  },
  {
    title: "support",
    links: [
      { label: "telegram @aimwork", href: "https://t.me/aimwork", external: true },
      { label: "a@leet-cheats.xyz", href: "mailto:a@leet-cheats.xyz", external: true },
      { label: "privacy policy", href: "/privacy" },
      { label: "terms of service", href: "/terms" },
    ],
  },
];

const linkClass =
  "text-sm text-foreground underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-accent-ink";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Logo size="lg" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            a small url shortener. no trackers, no analytics scripts, no
            popups. the whole thing is open source.
          </p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm text-muted">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) =>
                "external" in link && link.external ? (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className={linkClass}
                    >
                      {link.label}
                    </a>
                  </li>
                ) : (
                  <li key={link.label}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
