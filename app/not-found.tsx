import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "page not found - lynka",
  description: "this page does not exist.",
};

// same pattern as the home page: the card renders fine before the art exists
const hasArt = () =>
  existsSync(join(process.cwd(), "public", "banners", "icon-404.webp"));

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-2 sm:px-5">
      <section className="relative overflow-hidden rounded-3xl bg-accent-tint px-6 py-16 sm:px-12 sm:py-24">
        {hasArt() && (
          <div
            className="hero-arrive pointer-events-none absolute -right-6 top-1/2 hidden w-80 -translate-y-1/2 md:block xl:w-96"
            aria-hidden
          >
            <div className="art-float">
              <Image
                src="/banners/icon-404.webp"
                alt=""
                width={640}
                height={640}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        )}

        <div className="rise-seq relative z-10 max-w-xl">
          <p className="text-sm font-medium text-accent-ink">nothing here</p>
          <h1 className="mt-6 text-6xl font-bold tracking-tight sm:text-8xl">
            4<em>0</em>4
          </h1>
          <p className="mt-5 max-w-md text-base text-muted">
            this page does not exist. if you followed a short link, it may have
            expired or been deleted.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-12 items-center rounded-xl bg-foreground px-7 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              shorten a link
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center rounded-xl bg-background/80 px-7 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              open the dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
