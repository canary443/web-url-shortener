import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "lynka api docs",
  description: "how to shorten links with a lynka api key.",
};

const shortenExample = `curl -X POST https://lynka.xyz/api/py/shorten \\
  -H "x-api-key: $LYNKA_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"url": "https://example.com/long"}'

{"code": "x7Kp2m", "short_url": "https://lynka.xyz/x7Kp2m",
 "expires_at": "2026-08-15T12:00:00+00:00"}`;

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-2xl bg-frame p-5 font-code text-xs leading-6 text-frame-fg">
      {children}
    </pre>
  );
}

export default function DocsPage() {
  return (
    <div className="rise-seq mx-auto w-full max-w-3xl px-5 pt-16 pb-24">
      <h1 className="text-4xl font-bold sm:text-5xl">
        api <em>docs</em>
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
        sign in, open api settings in the dashboard and create your key. each
        account has one key. regenerating it invalidates the previous key.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-bold">settings</h2>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-muted">
          <li>5 requests per minute, counted across the whole account</li>
          <li>api links live for 31 days and include click statistics</li>
          <li>send the key in the x-api-key header</li>
          <li>the key is shown once and stored only as a hash</li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          rpm and link lifetime are locked. to request different settings,
          contact telegram{" "}
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

      <section className="mt-12">
        <h2 className="text-xl font-bold">shorten a url</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          POST /api/py/shorten with a json body and your api key. custom expiry
          is unavailable on the default plan.
        </p>
        <Code>{shortenExample}</Code>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          401 means the api key is invalid, 422 means the url was rejected and
          429 means the account rate limit was reached. javascript:, data:,
          localhost and private networks are refused.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">dashboard management</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          listing and deleting links are account dashboard actions and use your
          signed-in browser session. the api key currently creates links only.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold">redirects</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          GET /{"{code}"} answers 302 to the target. expired or unknown codes
          redirect to the home page. api links count clicks.
        </p>
      </section>

      <p className="mt-14 text-sm text-muted">
        see the{" "}
        <Link href="/terms" className="text-foreground underline-offset-4 hover:underline">
          terms of service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-foreground underline-offset-4 hover:underline">
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
