"use client";

import { useEffect, useRef, useState } from "react";
import { accessToken } from "@/lib/supabase";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "support-chat";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // history survives navigation within the tab
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      // corrupted storage is not worth crashing over
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);

    try {
      const token = await accessToken();
      const res = await fetch("/api/py/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const fallback =
          res.status === 429
            ? "rate limit reached. give it an hour."
            : "support is having a moment. try again in a minute.";
        setMessages([...history, { role: "assistant", content: fallback }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: reply }]);
      }
    } catch {
      setMessages([
        ...history,
        { role: "assistant", content: "network error. try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "close support chat" : "open support chat"}
        aria-expanded={open}
        className="fixed right-5 bottom-5 z-50 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-foreground shadow-lg transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-accent"
      >
        {open ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M21 12a8 8 0 0 1-8 8H4.5l1.8-2.7A8 8 0 1 1 21 12Z" />
            <path d="M8.5 10.5h7M8.5 13.5h4.5" />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="support chat"
          className="rise fixed right-5 bottom-20 z-50 flex h-[26rem] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-line bg-background shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <p className="text-sm font-medium">support</p>
            <p className="ml-auto font-mono text-xs text-muted">gpt-5.6-luna</p>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-muted">
                ask anything about the service. how links work, limits,
                accounts.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-md bg-foreground px-3 py-2 text-sm text-background"
                    : "mr-8 rounded-md border border-line bg-surface px-3 py-2 text-sm text-foreground"
                }
              >
                {m.content || <span className="text-muted">thinking…</span>}
              </div>
            ))}
          </div>

          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <label htmlFor="chat-input" className="sr-only">
              message
            </label>
            <input
              id="chat-input"
              type="text"
              value={input}
              maxLength={2000}
              onChange={(e) => setInput(e.target.value)}
              placeholder="type a message"
              className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="h-10 shrink-0 cursor-pointer rounded-md bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-default disabled:opacity-50"
            >
              send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
