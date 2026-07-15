import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "lynka terms of service",
  description: "the rules for using lynka accounts, links and api access.",
};

const sections = [
  {
    title: "using lynka",
    body: [
      "lynka is a free link shortening service provided as is, without charge. by creating a link, an account or an api key you accept these terms. you must be at least 16 years old to create an account.",
      "you may use lynka to create and manage short links, subject to the limits shown on the site and in the api documentation. you are responsible for every link created through your account or api key.",
      "you must provide accurate account information, keep your login details private and use one account per person unless we agree otherwise.",
    ],
  },
  {
    title: "paid upgrades",
    body: [
      "the default plan is free: 5 api requests per minute and 31 day links. higher rate limits or a longer link lifetime are available by individual agreement. contact telegram @aimwork or a@leet-cheats.xyz, agree on the scope and the price, and the new limits are applied to your account.",
      "payment terms, including payment in cryptocurrency, are agreed individually before anything is charged. no payments are collected through this website itself. agreed prices include any applicable taxes.",
      "if you are a consumer in the eu, you get the statutory information before the agreement and the service starts only after the agreement is made. upgraded limits follow the same abuse rules as everything else; an account suspended for abuse is not refunded except where the law requires it.",
    ],
  },
  {
    title: "no abuse",
    body: [
      "do not create extra accounts to avoid rate limits, expiry rules, suspensions or other service controls. automated signup, token sharing, excessive traffic and attempts to disrupt or probe the service are not allowed.",
      "do not shorten links used for phishing, malware, credential theft, spam, scams, illegal content, harassment or any activity that harms people, systems or networks. do not hide a destination in order to mislead someone about where a link goes.",
    ],
  },
  {
    title: "your content stays yours",
    body: [
      "the destinations behind your links are your responsibility. we do not monitor destinations proactively and we are not obliged to. if you believe a lynka link points to illegal or harmful content, report it to the contacts below and it will be reviewed and, where justified, removed promptly.",
    ],
  },
  {
    title: "enforcement",
    body: [
      "we may disable suspicious links, limit api access, suspend an account or delete an account when there is a reasonable indication of abuse, harmful links or an attempt to evade service controls. urgent action may happen without advance notice when needed to protect users or the service.",
      "we may preserve records when required by law or when reasonably necessary to investigate abuse. personal data handling and retention are described in the privacy policy.",
    ],
  },
  {
    title: "availability and liability",
    body: [
      "lynka is provided free of charge and without a promise of uninterrupted availability. links may stop working because they expire, are deleted, violate these terms or the service is unavailable. do not rely on lynka for emergency, safety-critical or permanent storage use. the service may be changed or discontinued; where reasonable, notice is given on the home page.",
      "we are fully liable for intent and gross negligence, and for injury to life, body or health, under statutory law. for slight negligence we are liable only for the breach of essential obligations that make the service possible in the first place, and then only up to the damage that is typical and foreseeable for a free service of this kind. any further liability is excluded. mandatory statutory liability, including under product liability law, stays unaffected.",
      "no warranty is given for fitness for a particular purpose. redirect targets are third party content; we are not responsible for what other websites do.",
    ],
  },
  {
    title: "ending things",
    body: [
      "you can stop using lynka at any time and delete your links and account. we may terminate accounts as described under enforcement. sections that by their nature should survive (liability, disputes) survive termination.",
    ],
  },
  {
    title: "changes, law and disputes",
    body: [
      "we may update these terms; the current version with its date always lives on this page, and material changes are announced on the home page. continued use after a change means acceptance.",
      "german law applies. if you are a consumer, the mandatory consumer protections of your country of residence stay unaffected. we are neither obliged nor willing to participate in dispute resolution proceedings before a consumer arbitration board (sec. 36 vsbg).",
      "if a provision of these terms turns out to be invalid, the rest stays in force.",
    ],
  },
  {
    title: "contact",
    body: [
      "questions, abuse reports and appeals can be sent to telegram @aimwork or a@leet-cheats.xyz.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="rise-seq mx-auto w-full max-w-2xl px-5 pt-16 pb-24">
      <h1 className="text-4xl font-bold sm:text-5xl">
        terms of <em>service</em>
      </h1>
      <p className="mt-4 text-sm text-muted">last updated 2026-07-15</p>
      <p className="mt-2 text-sm text-muted">
        how data is handled is described in the{" "}
        <Link
          href="/privacy"
          className="text-foreground underline underline-offset-4"
        >
          privacy policy
        </Link>
        .
      </p>

      {sections.map((section) => (
        <section key={section.title} className="mt-10">
          <h2 className="text-xl font-bold">{section.title}</h2>
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
