"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { accessToken, supabase } from "@/lib/supabase";

type ApiKeySettings = {
  exists: boolean;
  key_prefix: string | null;
  rpm: number;
  link_ttl_seconds: number;
};

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [siteUrl] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [apiSettings, setApiSettings] = useState<ApiKeySettings | null>(null);
  const [revealedApiKey, setRevealedApiKey] = useState<string | null>(null);
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  const load = useCallback(() => {
    accessToken()
      .then(async (token) => {
        if (!token) {
          router.replace("/login");
          return;
        }
        const res = await fetch("/api/py/api-key", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (res.status === 403) {
          router.replace("/dashboard");
          return;
        }
        if (res.ok) {
          setApiSettings(await res.json());
        } else {
          setApiSettings({
            exists: false,
            key_prefix: null,
            rpm: 5,
            link_ttl_seconds: 31 * 24 * 3600,
          });
        }
      })
      .catch(() => setError("could not load settings. refresh to retry."));
  }, [router]);

  useEffect(() => {
    supabase()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
    load();
  }, [load]);

  async function createApiKey() {
    const token = await accessToken();
    if (!token || apiKeyBusy) return;
    setApiKeyBusy(true);
    setError(null);
    const res = await fetch("/api/py/api-key", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setApiSettings(data);
      setRevealedApiKey(data.api_key);
    } else if (res.status === 503) {
      setError("api keys are not ready yet. the database migration is pending.");
    } else {
      setError("could not create the api key. try again.");
    }
    setApiKeyBusy(false);
  }

  async function copyApiKey() {
    if (!revealedApiKey) return;
    await navigator.clipboard.writeText(revealedApiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwBusy) return;
    setPwBusy(true);
    setPwError(null);
    setPwMessage(null);
    const { error } = await supabase().auth.updateUser({
      password: newPassword,
    });
    if (error) {
      setPwError(error.message.toLowerCase());
    } else {
      setPwMessage("password updated.");
      setNewPassword("");
    }
    setPwBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-5">
      <section className="relative overflow-hidden rounded-3xl bg-accent-tint px-6 py-10 sm:px-10">
        <div className="rise-seq">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium text-accent-ink">settings</p>
            <Link
              href="/dashboard"
              className="rounded-xl bg-background/80 px-4 py-2 text-sm font-medium backdrop-blur transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-background hover:shadow-md focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              back to links
            </Link>
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            api and <em>account</em>
          </h1>
          {email && <p className="mt-3 text-sm text-muted">{email}</p>}
        </div>
      </section>

      {error && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="api-heading" className="rise rounded-2xl bg-surface p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase text-accent-ink">api</p>
          <h2 id="api-heading" className="mt-1.5 text-lg font-semibold">
            api access
          </h2>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {[`${apiSettings?.rpm ?? 5} rpm`, "31 day links"].map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-xs text-muted"
                title="locked setting"
              >
                <LockIcon />
                {label}
              </span>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-background p-3.5">
            {revealedApiKey ? (
              <>
                <p className="break-all font-mono text-xs leading-5">{revealedApiKey}</p>
                <p className="mt-2 text-xs text-danger">
                  save it now. the full key cannot be shown again.
                </p>
              </>
            ) : (
              <p className="font-mono text-sm text-muted">
                {apiSettings === null
                  ? "loading..."
                  : apiSettings.exists
                    ? `${apiSettings.key_prefix}...`
                    : "no key created"}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={createApiKey}
              disabled={apiKeyBusy}
              className="cursor-pointer rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              {apiKeyBusy ? "working..." : apiSettings?.exists ? "regenerate key" : "create api key"}
            </button>
            {revealedApiKey && (
              <button
                type="button"
                onClick={copyApiKey}
                className="cursor-pointer rounded-lg border border-line bg-background px-4 py-2 text-sm font-medium transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-accent-ink"
              >
                {apiKeyCopied ? "copied" : "copy key"}
              </button>
            )}
          </div>

          <pre className="mt-4 overflow-x-auto rounded-xl bg-frame p-4 font-code text-[11px] leading-5 text-frame-fg">
            {`curl -X POST ${siteUrl || "https://lynka.xyz"}/api/py/shorten \\
  -H "x-api-key: $LYNKA_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"url": "https://example.com/long"}'`}
          </pre>
          <p className="mt-3 text-xs leading-relaxed text-muted">
            regenerating invalidates the previous key immediately. see the{" "}
            <Link href="/docs" className="text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent-ink">
              api docs
            </Link>
            . for a higher rate limit contact{" "}
            <a href="https://t.me/aimwork" target="_blank" rel="noreferrer" className="text-foreground underline-offset-4 hover:underline">
              @aimwork
            </a>{" "}
            or{" "}
            <a href="mailto:a@leet-cheats.xyz" className="text-foreground underline-offset-4 hover:underline">
              a@leet-cheats.xyz
            </a>
            .
          </p>
        </section>

        <section aria-labelledby="security-heading" className="rise rounded-2xl bg-surface p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase text-accent-ink">account</p>
          <h2 id="security-heading" className="mt-1.5 text-lg font-semibold">
            security
          </h2>
          <form onSubmit={changePassword} className="mt-4 flex flex-col gap-2">
            <label htmlFor="account-password" className="sr-only">
              new password
            </label>
            <input
              id="account-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 rounded-lg border border-line bg-background px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent-ink"
            />
            <button
              type="submit"
              disabled={pwBusy}
              className="h-10 cursor-pointer rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              {pwBusy ? "working..." : "change password"}
            </button>
          </form>
          {(pwError || pwMessage) && (
            <p
              role={pwError ? "alert" : undefined}
              className={`mt-2 text-sm ${pwError ? "text-danger" : "text-accent-ink"}`}
            >
              {pwError ?? pwMessage}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
