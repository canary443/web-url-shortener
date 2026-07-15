import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// human gate for the app pages: first visit gets a turnstile interstitial,
// a signed day-long cookie skips it afterwards. short codes and /api/py are
// deliberately outside the matcher, redirects and api clients never see it
const COOKIE = "lynka_human";

// search engines must be able to index the public pages, so known crawlers
// skip the gate. user agents are spoofable, but this gate is a nuisance
// filter for casual bots, not a security boundary (the real limits live in
// the backend rate limiting and the shorten captcha)
const CRAWLER_RE =
  /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandex(bot|images)|applebot|petalbot|ia_archiver/i;

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function passIsValid(
  value: string | undefined,
  secret: string
): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig) return false;
  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(exp));
  return hex(mac) === sig;
}

export async function proxy(request: NextRequest) {
  const secret = process.env.TURNSTILE_SECRET ?? "";
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  // both keys present switch the gate on, otherwise the site works as before
  if (!secret || !siteKey) return NextResponse.next();

  const agent = request.headers.get("user-agent") ?? "";
  if (CRAWLER_RE.test(agent)) return NextResponse.next();

  const pass = request.cookies.get(COOKIE)?.value;
  if (await passIsValid(pass, secret)) return NextResponse.next();

  const url = request.nextUrl.clone();
  const target = url.pathname + url.search;
  url.pathname = "/verify";
  url.search = "";
  if (target !== "/") url.searchParams.set("to", target);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard",
    "/settings",
    "/admin",
    "/docs",
    "/privacy",
    "/terms",
    "/reset-password",
  ],
};
