// leaked password check via the haveibeenpwned range api (k-anonymity):
// only the first 5 chars of the sha-1 leave the browser, never the password.
// this replaces the supabase dashboard toggle that needs a pro plan.
// fails open: an unreachable hibp must never block a signup
export async function passwordIsPwned(password: string): Promise<boolean> {
  try {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-1", data);
    const hash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}
