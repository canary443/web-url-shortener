import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "lynka privacy policy",
  description:
    "what lynka stores, where it lives and how to get it removed. german law, eu data.",
};

const sections = [
  {
    title: "the short version",
    body: [
      "lynka follows german data protection law (dsgvo / gdpr). all data is stored in the eu: the database runs on supabase in frankfurt (eu-central-1).",
      "there are no trackers, no analytics scripts, no ad pixels and no third party embeds on this site.",
    ],
  },
  {
    title: "what we store",
    body: [
      "links: the target url, the short code, creation time and expiry time. for signed in users also a click counter. anonymous links keep no click statistics at all.",
      "accounts: your email address and a password hash, both handled by supabase auth. github sign in shares only the email.",
      "rate limiting: short lived counters keyed by ip address for anonymous requests and by account id for signed in ones. counters are deleted after at most a day.",
      "abuse prevention: when an email account is registered, we store the signup ip address, time and a protected fingerprint of the email for 30 days. this helps identify automated registrations and attempts to avoid account limits. the log is private and is not available through the site or api.",
      "cookies exist only to keep you signed in. no consent banner is needed because there is nothing to consent to.",
    ],
  },
  {
    title: "how long",
    body: [
      "anonymous links are deleted automatically after 60 minutes. signed in and api links are deleted after 31 days. deleting a link in the dashboard removes it immediately.",
    ],
  },
  {
    title: "your rights",
    body: [
      "under the gdpr you can request access to, correction of, or deletion of your data at any time. links you own can be deleted in the dashboard yourself. for account deletion or any other request contact us and it will be handled within the legal deadline. processing needed to prevent abuse is based on our legitimate interest in protecting users and the service.",
    ],
  },
  {
    title: "contact",
    body: [
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
