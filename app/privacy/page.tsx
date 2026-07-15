import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "lynka privacy policy",
  description:
    "what lynka stores, on what legal basis, where it lives and how to get it removed. german law, eu data.",
};

const sections = [
  {
    title: "the short version",
    body: [
      "lynka follows the eu general data protection regulation (gdpr) and german data protection law (bdsg). the database and authentication run on supabase in frankfurt, germany (aws eu-central-1).",
      "there are no trackers, no analytics scripts, no ad pixels, no fingerprinting and no third party embeds on this site. we collect the minimum needed to run a link shortener and to keep it from being abused.",
    ],
  },
  {
    title: "who is responsible",
    body: [
      "the controller for this service is the operator of lynka, reachable at a@leet-cheats.xyz or telegram @aimwork. contact us for anything in this policy, including exercising your rights. we answer within the statutory deadlines (usually one month).",
    ],
  },
  {
    title: "what we store and why",
    body: [
      "links: the target url, the short code, creation time, expiry time and, for signed in users, a click counter. legal basis: performance of the service you request (art. 6(1)(b) gdpr). anonymous links keep no click statistics and are not connected to your identity by us.",
      "accounts: your email address and a password hash, both handled by supabase auth. github sign in shares only your email address with us. legal basis: art. 6(1)(b) gdpr.",
      "api keys: stored only as a cryptographic hash. the full key is shown to you once and cannot be read by us afterwards. a private log of your own api actions (action, short code, time) is kept for your dashboard. legal basis: art. 6(1)(b) gdpr.",
      "rate limiting: short lived counters keyed by ip address for anonymous requests and by account id for signed in ones. legal basis: our legitimate interest in keeping the service available (art. 6(1)(f) gdpr).",
      "abuse prevention: when an account is registered, we store the signup ip address, time and a keyed fingerprint of the email (not the email itself) for 30 days. this identifies automated registrations and attempts to evade limits. legal basis: art. 6(1)(f) gdpr, the legitimate interest of protecting users and the service. you can object to this processing (see your rights).",
      "cookies: only strictly necessary session cookies that keep you signed in. no consent banner is required for these (sec. 25(2) ttdsg), and there is nothing else to consent to.",
    ],
  },
  {
    title: "how long",
    body: [
      "anonymous links: deleted automatically after 60 minutes. signed in and api links: deleted after 31 days. deleting a link in the dashboard removes it immediately.",
      "rate limit counters: at most 1 day. signup abuse records: 30 days. api activity log: 30 days. account data: until you delete the account or ask us to.",
    ],
  },
  {
    title: "who processes data for us",
    body: [
      "supabase (database and authentication), hosted in frankfurt, germany. vercel (website hosting and delivery), which processes technical request data such as ip addresses in short lived server logs; depending on where you connect from, vercel may process such data outside the eu under the eu standard contractual clauses. we have data processing agreements with both providers.",
      "we never sell data, never share it for advertising and never transfer it to anyone else unless the law requires it.",
    ],
  },
  {
    title: "your rights",
    body: [
      "under art. 15 to 21 gdpr you can request access to your data, correction, deletion, restriction of processing, a portable copy, and you can object to processing based on legitimate interest.",
      "links you own can be deleted in the dashboard yourself, and your password can be changed there too. for account deletion or any other request contact us; identity is verified through the account email.",
      "you also have the right to complain to a data protection supervisory authority (art. 77 gdpr), for example the authority of the german state you live in.",
    ],
  },
  {
    title: "security and automated decisions",
    body: [
      "connections are encrypted with tls. passwords and api keys are stored only as hashes. database access is restricted with row level security, and the frontend never receives service credentials.",
      "there is no profiling and no automated decision making with legal effect (art. 22 gdpr). redirects and rate limits apply the same technical rules to everyone.",
    ],
  },
  {
    title: "changes and contact",
    body: [
      "if this policy changes, the new version appears on this page with an updated date. material changes are announced on the home page.",
      "telegram @aimwork or a@leet-cheats.xyz. the same contacts work for support and for raising your api rate limit.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="rise-seq mx-auto w-full max-w-2xl px-5 pt-16 pb-24">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        privacy <em>policy</em>
      </h1>
      <p className="mt-4 text-sm text-muted">last updated 2026-07-15</p>
      <p className="mt-2 text-sm text-muted">
        service use is also governed by the{" "}
        <Link
          href="/terms"
          className="text-foreground underline underline-offset-4"
        >
          terms of service
        </Link>
        .
      </p>

      {sections.map((section) => (
        <section key={section.title} className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">{section.title}</h2>
          {section.body.map((paragraph) => (
            <p
              key={paragraph.slice(0, 24)}
              className="mt-3 text-sm leading-relaxed text-muted"
            >
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
