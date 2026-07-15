import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ShortenForm } from "@/components/shorten-form";

// art assets arrive one by one from the paced image pipeline, cards render
// without their icon until the file exists
const hasIcon = (name: string) =>
  existsSync(join(process.cwd(), "public", "banners", `${name}.webp`));

const strip = [
  "anonymous: 60 minutes",
  "signed in: 31 days",
  "api: 5 rpm, links for 31 days",
  "agpl-3.0 open source",
];

function ArrowCircle() {
  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-foreground transition-transform duration-200 group-hover:translate-x-1"
      aria-hidden
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M4 12h15M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-5">
      {/* hero, aeza-style tinted container */}
      <section id="shorten" className="pt-2">
        <div className="relative overflow-hidden rounded-3xl bg-accent-tint px-6 py-14 sm:px-12 sm:py-20">
          {/* floating hero object, arrives once then drifts */}
          <div
            className="hero-arrive pointer-events-none absolute -right-10 top-1/2 hidden w-[26rem] -translate-y-1/2 lg:block xl:w-[30rem]"
            aria-hidden
          >
            <div className="art-float">
              <Image
                src="/banners/hero.webp"
                alt=""
                width={720}
                height={720}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>

          <div className="rise-seq relative z-10 max-w-2xl">
            <p className="text-sm font-medium text-accent-ink">
              paste, shorten, share
            </p>
            <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-7xl">
              lynka is a <em>tiny</em>
              <br />
              url shortener
            </h1>
            <p className="mt-5 max-w-md text-base text-muted">
              no trackers, no popups, no dark patterns. just the link.
            </p>
            <div className="mt-10 max-w-xl">
              <ShortenForm />
            </div>
          </div>


          {/* facts strip pinned to the container bottom */}
          <ul className="fact-seq relative z-10 mt-12 flex flex-wrap gap-2">
            {strip.map((item) => (
              <li key={item}>
                <span className="fact-pill block rounded-xl bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-1 hover:bg-background hover:shadow-md">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* what you get, aeza services grid */}
      <section className="py-14">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            one field, <em>two</em> ways to use it
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Reveal className="lift group relative overflow-hidden rounded-2xl bg-surface p-8 pb-20">
            <p className="text-2xl font-bold tracking-tight">no account</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted lg:max-w-[17rem] xl:max-w-sm">
              paste a url and get a code, nothing else asked. anonymous links
              live for 60 minutes and keep no click statistics. 10 links per
              hour.
            </p>
            <div
              className="art-float pointer-events-none absolute right-5 bottom-4 w-24 sm:right-8 sm:top-1/2 sm:bottom-auto sm:w-32 sm:-translate-y-1/2 lg:w-24 xl:w-32"
              aria-hidden
            >
              <Image
                src="/banners/icon-anon.webp"
                alt=""
                width={320}
                height={320}
                className="h-auto w-full transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
              />
            </div>
          </Reveal>
          <Reveal delay={80}>
            <Link
              href="/login"
              className="lift group relative block h-full overflow-hidden rounded-2xl bg-surface p-8 pb-20 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              <p className="text-2xl font-bold tracking-tight">signed in</p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted lg:max-w-[17rem] xl:max-w-sm">
                links live for 31 days and count their clicks. copy, watch and
                delete everything from one dashboard. 5 requests per minute,
                github or email to get in.
              </p>
              <div
                className="art-float-2 pointer-events-none absolute right-16 bottom-2 w-24 sm:right-10 sm:top-8 sm:bottom-auto sm:w-28 lg:w-24 xl:w-28"
                aria-hidden
              >
                <Image
                  src="/banners/icon-stats.webp"
                  alt=""
                  width={320}
                  height={320}
                  className="h-auto w-full transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105"
                />
              </div>
              <span className="absolute right-6 bottom-6">
                <ArrowCircle />
              </span>
            </Link>
          </Reveal>
          <Reveal delay={80}>
            <Link
              href="/dashboard"
              className="lift group relative block h-full overflow-hidden rounded-2xl bg-frame focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              {/* soft cyan glow behind the icon so the black card has depth.
                  transform-gpu pins it to its own layer, hover lifts used to
                  make the blur flicker */}
              <div
                className="pointer-events-none absolute -right-10 top-1/2 h-72 w-72 -translate-y-1/2 transform-gpu rounded-full bg-accent/15 blur-3xl"
                aria-hidden
              />
              {hasIcon("icon-dashboard") && (
                <div
                  className="art-float pointer-events-none absolute right-6 top-1/2 w-36 -translate-y-1/2 transform-gpu sm:right-12 sm:w-48 lg:w-36 xl:w-48"
                  aria-hidden
                >
                  <Image
                    src="/banners/icon-dashboard.webp"
                    alt=""
                    width={480}
                    height={480}
                    className="h-auto w-full transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="relative flex h-full min-h-72 flex-col justify-end p-8 pb-20">
                <p className="text-2xl font-bold tracking-tight text-frame-fg">
                  the dashboard
                </p>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-frame-muted">
                  every link you made, its clicks and its time left, in one
                  quiet list.
                </p>
                <span className="absolute right-6 bottom-6">
                  <ArrowCircle />
                </span>
              </div>
            </Link>
          </Reveal>
          <Reveal delay={160} className="lift group relative overflow-hidden rounded-2xl bg-surface p-8 pb-20">
            <p className="text-2xl font-bold tracking-tight">
              nothing watching
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted lg:max-w-[17rem] xl:max-w-sm">
              no trackers, no analytics scripts, no ad pixels. cookies exist
              only to keep you signed in. the source is public under agpl-3.0.
            </p>
            {hasIcon("icon-privacy") && (
              <div
                className="art-float-3 pointer-events-none absolute right-5 bottom-4 w-24 sm:right-8 sm:top-1/2 sm:bottom-auto sm:w-32 sm:-translate-y-1/2 lg:w-24 xl:w-32"
                aria-hidden
              >
                <Image
                  src="/banners/icon-privacy.webp"
                  alt=""
                  width={320}
                  height={320}
                  className="h-auto w-full transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105"
                />
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {/* the api underneath, black banner like the aeza domain card */}
      <section className="pb-14">
        <Reveal className="relative overflow-hidden rounded-3xl bg-frame px-6 py-12 sm:px-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[5fr_7fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-frame-fg sm:text-5xl">
                an api <em>underneath</em>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-frame-muted">
                lynka grew out of a{" "}
                <a
                  href="https://github.com/canary443/cli-url-shortener"
                  target="_blank"
                  rel="noreferrer"
                  className="text-frame-fg underline-offset-4 hover:underline"
                >
                  command line tool
                </a>
                . every account gets one api key: 5 requests per minute, with
                links that live for 31 days and count their clicks.
              </p>
              <Link
                href="/docs"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent"
              >
                read the docs
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <path d="M4 12h15M13 6l6 6-6 6" />
                </svg>
              </Link>
            </div>
            <div className="rounded-2xl border border-frame-line bg-black/40 p-6">
              <p className="font-code text-xs leading-7 text-frame-muted">
                <span className="text-frame-fg">POST /api/py/shorten</span>{" "}
                {"{"}&quot;url&quot;: &quot;https://example.com/a/very/long/path&quot;{"}"}
                <br />
                {"{"}&quot;code&quot;: &quot;x7Kp2m&quot;, &quot;short_url&quot;:
                &quot;https://lynka.xyz/x7Kp2m&quot;{"}"}
                <br />
                <br />
                <span className="text-frame-fg">GET /x7Kp2m</span>
                <br />
                302 <span className="text-accent">-&gt;</span>{" "}
                https://example.com/a/very/long/path
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* closing */}
      <section className="pb-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-surface px-6 py-14 text-center sm:px-12 sm:py-20">
            {/* thin black route lines, drawn on reveal */}
            <svg
              className="route-line pointer-events-none absolute left-0 top-1/2 hidden -translate-y-1/2 text-foreground xl:block"
              width="190"
              height="170"
              viewBox="0 0 190 170"
              fill="none"
              aria-hidden
            >
              <path
                d="M0 24 H66 Q78 24 78 36 V118 Q78 130 90 130 H136"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                pathLength="400"
              />
              <circle cx="146" cy="130" r="5" fill="currentColor" />
            </svg>
            <svg
              className="route-line pointer-events-none absolute right-0 top-1/2 hidden -translate-y-1/2 text-foreground xl:block"
              width="190"
              height="170"
              viewBox="0 0 190 170"
              fill="none"
              aria-hidden
            >
              <path
                d="M190 140 H124 Q112 140 112 128 V52 Q112 40 100 40 H54"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                pathLength="400"
              />
              <circle cx="44" cy="40" r="5" fill="currentColor" />
            </svg>

            <h2 className="relative mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">
              paste something <em>long</em>.
            </h2>
            <div className="relative mt-8 flex flex-col items-center gap-4">
              <a
                href="#shorten"
                className="rounded-xl bg-foreground px-8 py-3.5 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-ink"
              >
                shorten it
              </a>
              <p className="text-sm text-muted">
                questions? contact support by email or telegram.
              </p>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
