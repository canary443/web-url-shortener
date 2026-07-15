import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // private surfaces and the interstitial bring nothing to a search index
      disallow: ["/dashboard", "/settings", "/admin", "/verify", "/api/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
