"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { accessToken } from "@/lib/supabase";

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  links: number;
};

type AdminLink = {
  id: string;
  code: string;
  target_url: string;
  user_id: string | null;
  created_at: string;
  expires_at: string | null;
  clicks: number;
};

function shortDate(value: string | null): string {
  if (!value) return "never";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isBanned(user: AdminUser): boolean {
  return Boolean(user.banned_until && new Date(user.banned_until) > new Date());
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [links, setLinks] = useState<AdminLink[] | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [suspendDays, setSuspendDays] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDelete, setSuspendDelete] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [armedLinkId, setArmedLinkId] = useState<string | null>(null);

  const authed = useCallback(async () => {
    const token = await accessToken();
    if (!token) {
      router.replace("/login");
      return null;
    }
    return { authorization: `Bearer ${token}` };
  }, [router]);

  const loadUsers = useCallback(async () => {
    const headers = await authed();
    if (!headers) return;
    const res = await fetch("/api/py/admin/users", { headers });
    if (res.status === 403) {
      router.replace("/dashboard");
      return;
    }
    if (!res.ok) {
      setError("could not load users. refresh to retry.");
      return;
    }
    setUsers((await res.json()).users);
  }, [authed, router]);

  const loadLinks = useCallback(
    async (q: string) => {
      const headers = await authed();
      if (!headers) return;
      const res = await fetch(
        `/api/py/admin/links?q=${encodeURIComponent(q)}`,
        { headers }
      );
      if (!res.ok) {
        if (res.status === 422) setError("search supports letters, digits and ._:/- only");
        return;
      }
      const data = await res.json();
      setLinks(data.links);
      setSiteUrl(data.site_url);
    },
    [authed]
  );

  useEffect(() => {
    // state updates happen inside promise callbacks, never synchronously in an effect
    Promise.resolve().then(() => {
      loadUsers();
      loadLinks("");
    });
  }, [loadUsers, loadLinks]);

  async function suspend(user: AdminUser) {
    const headers = await authed();
    if (!headers || busyId) return;
    setBusyId(user.id);
    setError(null);
    const days = suspendDays.trim() === "" ? null : Number(suspendDays);
    const res = await fetch(`/api/py/admin/users/${user.id}/suspend`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        days,
        reason: suspendReason.trim(),
        delete_links: suspendDelete,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setNotice(
        `${user.email ?? user.id} suspended${
          data.deleted_links ? `, ${data.deleted_links} links deleted` : ""
        }${data.email_queued ? ", email queued" : ", email skipped (smtp not set)"}`
      );
      setSuspendingId(null);
      setSuspendDays("");
      setSuspendReason("");
      setSuspendDelete(false);
      await loadUsers();
      await loadLinks(query);
    } else {
      setError("suspend failed. try again.");
    }
    setBusyId(null);
  }

  async function unsuspend(user: AdminUser) {
    const headers = await authed();
    if (!headers || busyId) return;
    setBusyId(user.id);
    setError(null);
    const res = await fetch(`/api/py/admin/users/${user.id}/unsuspend`, {
      method: "POST",
      headers,
    });
    if (res.ok) {
      setNotice(`${user.email ?? user.id} is active again`);
      await loadUsers();
    } else {
      setError("unsuspend failed. try again.");
    }
    setBusyId(null);
  }

  async function removeLink(link: AdminLink) {
    if (armedLinkId !== link.id) {
      setArmedLinkId(link.id);
      setTimeout(() => setArmedLinkId(null), 3000);
      return;
    }
    setArmedLinkId(null);
    const headers = await authed();
    if (!headers) return;
    const prev = links;
    setLinks((cur) => cur?.filter((l) => l.id !== link.id) ?? null);
    const res = await fetch(`/api/py/admin/links/${link.id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      setLinks(prev ?? null);
      setError("delete failed. try again.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-5">
      <section className="relative overflow-hidden rounded-3xl bg-accent-tint px-6 py-10 sm:px-10">
        <div className="rise-seq">
          <p className="text-sm font-medium text-accent-ink">admin</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            control <em>room</em>
          </h1>
          <p className="mt-3 text-sm text-muted">
            suspensions ban sign in and api keys. deleting links kills their
            redirects immediately.
          </p>
        </div>
      </section>

      {(error || notice) && (
        <p
          role={error ? "alert" : undefined}
          className={`mt-6 text-sm ${error ? "text-danger" : "text-accent-ink"}`}
        >
          {error ?? notice}
        </p>
      )}

      <section aria-labelledby="admin-users" className="rise mt-4 rounded-2xl bg-surface p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase text-accent-ink">people</p>
        <h2 id="admin-users" className="mt-1.5 text-lg font-semibold">
          users
          {users !== null && (
            <span className="ml-2 text-sm font-normal text-muted">{users.length}</span>
          )}
        </h2>

        {users === null ? (
          <ul className="mt-5 space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-16 animate-pulse rounded-xl bg-background" />
            ))}
          </ul>
        ) : (
          <ul className="mt-5 space-y-2">
            {users.map((user) => (
              <li key={user.id} className="rounded-xl bg-background px-4 py-3.5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{user.email ?? user.id}</p>
                    <p className="mt-1 text-xs text-muted">
                      joined {shortDate(user.created_at)} · last seen {shortDate(user.last_sign_in_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted sm:flex-col sm:items-end sm:gap-1.5">
                    <span className="tabular-nums">
                      <span className="text-sm font-semibold text-foreground">{user.links}</span>{" "}
                      {user.links === 1 ? "link" : "links"}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 ${
                        isBanned(user) ? "bg-danger/10 text-danger" : "bg-surface"
                      }`}
                    >
                      {isBanned(user) ? `banned until ${shortDate(user.banned_until)}` : "active"}
                    </span>
                  </div>
                  <div className="flex gap-2 sm:justify-end">
                    {isBanned(user) ? (
                      <button
                        type="button"
                        onClick={() => unsuspend(user)}
                        disabled={busyId === user.id}
                        className="h-9 cursor-pointer rounded-lg border border-line px-3 text-sm transition-colors hover:border-foreground disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent-ink"
                      >
                        {busyId === user.id ? "working..." : "unsuspend"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setSuspendingId(suspendingId === user.id ? null : user.id)
                        }
                        className="h-9 cursor-pointer rounded-lg border border-transparent px-3 text-sm text-muted transition-colors hover:border-danger/40 hover:text-danger focus-visible:outline-2 focus-visible:outline-danger"
                      >
                        suspend
                      </button>
                    )}
                  </div>
                </div>

                {suspendingId === user.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={suspendDays}
                      onChange={(e) => setSuspendDays(e.target.value)}
                      placeholder="days (empty = forever)"
                      aria-label="suspension length in days"
                      className="h-9 w-44 rounded-lg border border-line bg-background px-3 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent-ink"
                    />
                    <input
                      type="text"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="reason (goes into the email)"
                      aria-label="suspension reason"
                      className="h-9 min-w-52 flex-1 rounded-lg border border-line bg-background px-3 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent-ink"
                    />
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <input
                        type="checkbox"
                        checked={suspendDelete}
                        onChange={(e) => setSuspendDelete(e.target.checked)}
                        className="h-4 w-4 accent-current"
                      />
                      delete their links
                    </label>
                    <button
                      type="button"
                      onClick={() => suspend(user)}
                      disabled={busyId === user.id}
                      className="h-9 cursor-pointer rounded-lg bg-danger px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-danger"
                    >
                      {busyId === user.id ? "working..." : "confirm suspend"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="admin-links" className="rise mt-4 rounded-2xl bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-accent-ink">content</p>
            <h2 id="admin-links" className="mt-1.5 text-lg font-semibold">
              links
            </h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              loadLinks(query.trim());
            }}
            className="flex items-center gap-2"
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="code or target"
              aria-label="search links"
              className="h-9 w-48 rounded-lg border border-line bg-background px-3 text-sm placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent-ink"
            />
            <button
              type="submit"
              className="h-9 cursor-pointer rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-accent-ink"
            >
              search
            </button>
          </form>
        </div>

        {links === null ? (
          <ul className="mt-5 space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-16 animate-pulse rounded-xl bg-background" />
            ))}
          </ul>
        ) : links.length === 0 ? (
          <p className="mt-5 rounded-xl bg-background px-4 py-8 text-center text-sm text-muted">
            nothing matches.
          </p>
        ) : (
          <ul className="mt-5 space-y-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="grid gap-3 rounded-xl bg-background px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-5"
              >
                <div className="min-w-0">
                  <a
                    href={`${siteUrl}/${link.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-accent-ink"
                  >
                    /{link.code}
                  </a>
                  <p className="mt-1 truncate text-sm text-muted" title={link.target_url}>
                    {link.target_url}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-muted">
                    {link.user_id ?? "anonymous"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted sm:flex-col sm:items-end sm:gap-1.5">
                  <span className="tabular-nums">
                    <span className="text-sm font-semibold text-foreground">{link.clicks}</span>{" "}
                    {link.clicks === 1 ? "click" : "clicks"}
                  </span>
                  <span>{shortDate(link.created_at)}</span>
                </div>
                <div className="flex sm:justify-end">
                  <button
                    type="button"
                    onClick={() => removeLink(link)}
                    aria-label={
                      armedLinkId === link.id
                        ? `confirm deleting /${link.code}`
                        : `delete /${link.code}`
                    }
                    className={`h-9 cursor-pointer rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-danger ${
                      armedLinkId === link.id
                        ? "bg-danger font-medium text-white"
                        : "border border-transparent text-muted hover:border-danger/40 hover:text-danger"
                    }`}
                  >
                    {armedLinkId === link.id ? "sure?" : "delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
