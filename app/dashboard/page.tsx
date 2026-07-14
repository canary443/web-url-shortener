"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { accessToken, supabase } from "@/lib/supabase";

type LinkRow = {
  id: string;
  code: string;
  target_url: string;
  created_at: string;
  clicks: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await accessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const res = await fetch("/api/py/links", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      setError("could not load your links. refresh to retry.");
      return;
    }
    const data = await res.json();
    setLinks(data.links);
    setSiteUrl(data.site_url);
  }, [router]);

  useEffect(() => {
    supabase()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
    load();
  }, [load]);

  async function remove(id: string) {
    const token = await accessToken();
    if (!token) return;
    // optimistic removal, the row comes back on failure
    const prev = links;
    setLinks((cur) => cur?.filter((l) => l.id !== id) ?? null);
    const res = await fetch(`/api/py/links/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setLinks(prev ?? null);
      setError("delete failed. try again.");
    }
  }

  async function copy(link: LinkRow) {
    await navigator.clipboard.writeText(`${siteUrl}/${link.code}`);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pt-16 pb-24">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">my links</h1>
          {email && <p className="mt-1 text-sm text-muted">{email}</p>}
        </div>
        <button
          type="button"
          onClick={signOut}
          className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:border-foreground hover:text-foreground"
        >
          sign out
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {error}
        </p>
      )}

      {links === null && !error && (
        <div className="mt-10 space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-surface" />
          ))}
        </div>
      )}

      {links !== null && links.length === 0 && (
        <div className="mt-10 rounded-md border border-line bg-surface p-8 text-center">
          <p className="text-sm text-muted">
            nothing here yet. shorten a link on the home page and it will show
            up in this list.
          </p>
        </div>
      )}

      {links !== null && links.length > 0 && (
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex items-center gap-4 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={`${siteUrl}/${link.code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm text-foreground underline-offset-4 hover:underline"
                >
                  /{link.code}
                </a>
                <p className="mt-0.5 truncate text-sm text-muted">
                  {link.target_url}
                </p>
              </div>
              <span
                className="shrink-0 font-mono text-sm tabular-nums text-muted"
                title="clicks"
              >
                {link.clicks} {link.clicks === 1 ? "click" : "clicks"}
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => copy(link)}
                  className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm text-foreground transition-colors hover:border-foreground"
                >
                  {copiedId === link.id ? "copied" : "copy"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(link.id)}
                  className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-sm text-danger transition-colors hover:border-danger"
                >
                  delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
