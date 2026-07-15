"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Turnstile, turnstileEnabled } from "@/components/turnstile";

// interstitial the proxy sends first-time visitors to. one solved turnstile
// mints a signed day-long cookie and the visitor bounces back where they went
function safeTarget(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function VerifyInner() {
  const params = useSearchParams();
  const [failed, setFailed] = useState(false);

  async function redeem(token: string) {
    setFailed(false);
    try {
      const res = await fetch("/api/py/auth/verify-human", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      window.location.replace(safeTarget(params.get("to")));
    } catch {
      setFailed(true);
    }
  }

  // nothing to solve when the feature is off, just go home
  useEffect(() => {
    if (!turnstileEnabled()) window.location.replace("/");
  }, []);
  if (!turnstileEnabled()) return null;

  return (
    <div className="rise-seq mx-auto w-full max-w-sm px-5 pt-24 pb-24 text-center">
      <p className="text-sm font-medium text-accent-ink">one quick check</p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">
        are you <em>human</em>?
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        lynka keeps bots away from the app pages. solve the check once and you
        are set for the day. short links themselves never ask.
      </p>
      <div className="mt-8 flex justify-center">
        <div className="w-full max-w-xs">
          <Turnstile onToken={(token) => void redeem(token)} />
        </div>
      </div>
      {failed && (
        <p role="alert" className="mt-4 text-sm text-danger">
          that did not go through. reload the page and try again.
        </p>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
