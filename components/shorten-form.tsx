"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { accessToken } from "@/lib/supabase";

type ShortenResult = {
  code: string;
  short_url: string;
  expires_at: string | null;
};

function NotFoundNotice() {
  const params = useSearchParams();
  if (!params.get("notfound")) return null;
  return (
    <p className="mb-6 rounded-md border border-line bg-surface px-4 py-3 text-sm text-muted">
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
        },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        setResult(await res.json());
        setUrl("");
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
          className="h-12 flex-1 rounded-md border border-line bg-surface px-4 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="h-12 cursor-pointer rounded-md bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-default disabled:opacity-50"
        >
          {busy ? "working…" : "shorten"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="rise mt-6 rounded-md border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-accent"
                aria-hidden
              />
              <a
                href={result.short_url}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-sm text-foreground underline-offset-4 hover:underline"
              >
                {result.short_url.replace(/^https?:\/\//, "")}
              </a>
            </div>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm text-foreground transition-colors hover:border-foreground"
            >
              {copied ? "copied" : "copy"}
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">
            {result.expires_at
              ? "this link lives for one hour. sign in to keep links forever."
              : "this link is yours, it will not expire."}
          </p>
        </div>
      )}
    </div>
  );
}
