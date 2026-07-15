import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "lynka terms of service",
  description: "the rules for using lynka accounts, links and api access.",
};

const sections = [
  {
    title: "using lynka",
    body: [
      "you may use lynka to create and manage short links, subject to the limits shown on the site and in the api documentation. you are responsible for every link created through your account or api key.",
      "you must provide accurate account information, keep your login details private and use one account per person unless we agree otherwise.",
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
    title: "enforcement",
    body: [
      "we may disable suspicious links, limit api access, suspend an account or delete an account when there is a reasonable indication of abuse, harmful links or an attempt to evade service controls. urgent action may happen without advance notice when needed to protect users or the service.",
      "we may preserve records when required by law or when reasonably necessary to investigate abuse. personal data handling and retention are described in the privacy policy.",
    ],
  },
  {
    title: "availability",
    body: [
      "lynka is provided without a promise of uninterrupted availability. links may stop working because they expire, are deleted, violate these terms or the service is unavailable. do not rely on lynka for emergency, safety-critical or permanent storage use.",
    ],
  },
  {
    title: "contact",
    body: [
      "questions, reports and appeals can be sent to telegram @aimwork or a@leet-cheats.xyz.",
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
