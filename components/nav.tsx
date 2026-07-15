"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Logo } from "./logo";

export function Nav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5">
        <Link
          href="/"
          aria-label="lynka home"
          className="rounded-lg p-1 -m-1 focus-visible:outline-2 focus-visible:outline-accent-ink"
        >
          <Logo />
        </Link>

        <div className="flex items-center gap-1">
          {signedIn === null ? (
            <span className="w-16" aria-hidden />
          ) : signedIn ? (
            <Link
              href="/dashboard"
              className="ml-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              my links
            </Link>
          ) : (
            <Link
              href="/login"
              className="ml-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
