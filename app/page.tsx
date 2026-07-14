import { ShortenForm } from "@/components/shorten-form";

const facts = [
  {
    term: "free",
    text: "shorten without an account. anonymous links live for one hour.",
  },
  {
    term: "yours",
    text: "sign in and links stay forever. see clicks, manage, delete.",
  },
  {
    term: "open",
    text: "the whole thing is open source. python backend, next.js frontend.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5">
      <section className="pt-24 pb-16 sm:pt-32">
        <p className="mb-6 font-mono text-sm text-muted">
          <span className="text-accent">~</span> paste, shorten, share
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          short links, no noise.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted">
          a small, fast url shortener. no trackers, no popups, no dark
          patterns. just the link.
        </p>

        <div className="mt-10 max-w-2xl">
          <ShortenForm />
        </div>
      </section>

      <section className="border-t border-line py-14">
        <dl className="grid gap-8 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.term}>
              <dt className="font-mono text-sm text-foreground">{f.term}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">
                {f.text}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
