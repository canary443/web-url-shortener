"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Turnstile, turnstileEnabled } from "@/components/turnstile";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRound, setCaptchaRound] = useState(0);

  function consumeCaptcha() {
    // turnstile tokens are single use, remount the widget for the next try
    setCaptchaToken(null);
    setCaptchaRound((round) => round + 1);
  }

  useEffect(() => {
    // oauth failures come back in the url and would otherwise vanish silently
    Promise.resolve().then(() => {
      const params = new URLSearchParams(
        window.location.hash.replace(/^#/, "") || window.location.search
      );
      const description = params.get("error_description") || params.get("error");
      if (description) {
        setError(description.replaceAll("+", " ").toLowerCase());
        window.history.replaceState(null, "", "/login");
      }
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    const sb = supabase();
    const options = captchaToken ? { captchaToken } : undefined;
    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({
        email,
        password,
        options,
      });
      consumeCaptcha();
      if (error) {
        setError(error.message.toLowerCase());
      } else {
        router.push("/dashboard");
      }
    } else {
      const { data, error } = await sb.auth.signUp({ email, password, options });
      consumeCaptcha();
      if (error) {
        setError(error.message.toLowerCase());
      } else {
        void fetch("/api/py/auth/signup-event", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        }).catch(() => undefined);
        if (data.session) {
          router.push("/dashboard");
        } else {
          setNotice("check your email to confirm the account. look in spam if it is not in your inbox.");
        }
      }
    }
    setBusy(false);
  }

  async function github() {
    setError(null);
    await supabase().auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  }

  async function forgotPassword() {
    setError(null);
    setNotice(null);
    if (!email) {
      setError("enter your email above first, then press forgot password.");
      return;
    }
    const { error } = await supabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      ...(captchaToken ? { captchaToken } : {}),
    });
    consumeCaptcha();
    if (error) {
      setError(error.message.toLowerCase());
    } else {
      setNotice("reset link sent. check your inbox.");
    }
  }

  return (
    <div className="rise-seq mx-auto w-full max-w-sm px-5 pt-20 pb-24">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "signin" ? "sign in" : "create account"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "signin"
          ? "your links are waiting."
          : "links for 31 days, with click counts."}
      </p>

      <button
        type="button"
        onClick={github}
        className="mt-8 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-line bg-surface text-sm font-medium text-foreground transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-accent-ink"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        continue with github
      </button>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" aria-hidden />
        or with email
        <span className="h-px flex-1 bg-line" aria-hidden />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="email" className="sr-only">
          email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 rounded-md border border-line bg-surface px-4 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent-ink"
        />
        <label htmlFor="password" className="sr-only">
          password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-md border border-line bg-surface px-4 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent-ink"
        />
        {mode === "signup" && (
          <label className="mt-1 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-muted">
            <input
              type="checkbox"
              required
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-foreground focus-visible:outline-2 focus-visible:outline-accent-ink"
            />
            <span>
              by registering, you agree to the{" "}
              <Link
                href="/terms"
                className="text-foreground underline underline-offset-4"
              >
                terms of service
              </Link>{" "}
              and acknowledge the{" "}
              <Link
                href="/privacy"
                className="text-foreground underline underline-offset-4"
              >
                privacy policy
              </Link>
              .
            </span>
          </label>
        )}
        <Turnstile
          key={captchaRound}
          onToken={setCaptchaToken}
          onExpire={() => setCaptchaToken(null)}
        />
        <button
          type="submit"
          disabled={
            busy ||
            (mode === "signup" && !acceptedTerms) ||
            (turnstileEnabled() && !captchaToken)
          }
          className="mt-1 h-11 cursor-pointer rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-default disabled:opacity-50"
        >
          {busy
            ? "working…"
            : mode === "signin"
              ? "sign in"
              : "create account"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-4 text-sm font-medium text-accent-ink">{notice}</p>
      )}

      {mode === "signin" && (
        <p className="mt-4 text-sm text-muted">
          <button
            type="button"
            onClick={forgotPassword}
            className="cursor-pointer underline-offset-4 hover:text-foreground hover:underline"
          >
            forgot password?
          </button>
        </p>
      )}

      <p className="mt-8 text-sm text-muted">
        {mode === "signin" ? "no account yet?" : "already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setAcceptedTerms(false);
            setError(null);
            setNotice(null);
          }}
          className="cursor-pointer text-foreground underline-offset-4 hover:underline"
        >
          {mode === "signin" ? "create one" : "sign in"}
        </button>
      </p>
    </div>
  );
}
