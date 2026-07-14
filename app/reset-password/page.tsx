"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    // the recovery link from the email opens this page with a session
    const { data } = await supabase().auth.getSession();
    if (!data.session) {
      setError("open this page from the reset link in your email.");
      setBusy(false);
      return;
    }

    const { error } = await supabase().auth.updateUser({ password });
    if (error) {
      setError(error.message.toLowerCase());
      setBusy(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-sm px-5 pt-20 pb-24">
      <h1 className="text-2xl font-semibold tracking-tight">new password</h1>
      <p className="mt-2 text-sm text-muted">
        pick a new password for your account.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        <label htmlFor="new-password" className="sr-only">
          new password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-md border border-line bg-surface px-4 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-1 h-11 cursor-pointer rounded-md bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-default disabled:opacity-50"
        >
          {busy ? "working…" : "save password"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
