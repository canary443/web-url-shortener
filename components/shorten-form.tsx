"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { accessToken } from "@/lib/supabase";
import { Turnstile } from "@/components/turnstile";

type ShortenResult = {
  code: string;
  short_url: string;
  expires_at: string | null;
  owned: boolean;
};

function NotFoundNotice() {
  const params = useSearchParams();
  if (!params.get("notfound")) return null;
  return (
    <p className="mb-6 rounded-xl bg-background/80 px-4 py-3 text-sm text-muted backdrop-blur">
      that link does not exist or has expired.
    </p>
  );
}

export function ShortenForm() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShortenResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [captchaNeeded, setCaptchaNeeded] = useState(false);
  const [captchaRound, setCaptchaRound] = useState(0);

  async function run(captchaToken?: string) {
    if (busy || !url.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setCopied(false);

    try {
      const token = await accessToken();
      const res = await fetch("/api/py/shorten", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(captchaToken ? { "x-captcha-token": captchaToken } : {}),
        },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        setResult({ ...(await res.json()), owned: !!token });
        setUrl("");
        setCaptchaNeeded(false);
      } else if (res.status === 428) {
        // the backend suspects automation, a solved turnstile unblocks it
        setCaptchaNeeded(true);
        setCaptchaRound((round) => round + 1);
        setError("quick human check needed. it takes a second, the link follows right after.");
      } else if (res.status === 429) {
        setError("rate limit reached. wait a bit and try again.");
      } else if (res.status === 422) {
        setError("this url cannot be shortened. check it and try again.");
      } else {
        setError("something broke on our side. try again.");
      }
    } catch {
      setError("network error. check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await run();
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.short_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="w-full">
      <Suspense fallback={null}>
        <NotFoundNotice />
      </Suspense>

      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="url" className="sr-only">
          url to shorten
        </label>
        <input
          id="url"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="paste a long url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-14 w-full min-w-0 appearance-none rounded-xl border border-line bg-background px-5 text-base text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent-ink sm:flex-1 sm:text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-14 cursor-pointer rounded-xl bg-foreground px-8 text-base font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-ink disabled:cursor-default disabled:opacity-50 sm:text-sm"
        >
          {busy ? "working…" : "shorten"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {captchaNeeded && (
        <div className="mt-4 rounded-xl bg-background/80 p-3 backdrop-blur">
          <Turnstile key={captchaRound} onToken={(token) => void run(token)} />
        </div>
      )}

      {result && (
        <div className="rise mt-6 rounded-2xl bg-background p-6 shadow-sm">
          <p className="text-sm text-muted">your short link is ready</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <a
              href={result.short_url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 truncate text-xl font-semibold tracking-tight text-foreground underline-offset-4 hover:underline sm:text-2xl"
            >
              {result.short_url.replace(/^https?:\/\//, "")}
            </a>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 cursor-pointer rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              {copied ? "copied" : "copy link"}
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">
            {result.owned
              ? "lives for 31 days. watch its clicks on the dashboard."
              : "lives for 60 minutes, no clicks counted. sign in for 31 days and stats."}
          </p>
        </div>
      )}
    </div>
  );
}
