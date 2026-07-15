"use client";

import { useEffect, useRef } from "react";

// explicit-render cloudflare turnstile widget. renders nothing when the
// site key env is missing, so local dev without keys keeps working
type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  action?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: TurnstileOptions) => string;
      remove: (id: string) => void;
    };
    __turnstileReady?: Promise<void>;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function turnstileEnabled(): boolean {
  return SITE_KEY.length > 0;
}

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!window.__turnstileReady) {
    window.__turnstileReady = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("turnstile script failed"));
      document.head.appendChild(script);
    });
  }
  return window.__turnstileReady;
}

export function Turnstile({
  onToken,
  onExpire,
}: {
  onToken: (token: string) => void;
  onExpire?: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !holder.current) return;
    let widgetId: string | null = null;
    let gone = false;

    loadScript()
      .then(() => {
        if (gone || !holder.current || !window.turnstile) return;
        widgetId = window.turnstile.render(holder.current, {
          sitekey: SITE_KEY,
          callback: onToken,
          "expired-callback": onExpire,
          action: "turnstile-spin-v2",
          theme: "light",
          size: "flexible",
        });
      })
      .catch(() => undefined);

    return () => {
      gone = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
    // the callbacks are stable enough per mount, remounting is handled by key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={holder} className="min-h-16" />;
}
