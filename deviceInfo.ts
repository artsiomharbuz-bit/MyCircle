// The network details the moderation Information page shows. A Convex
// mutation can't see the requesting socket, so the device reports its own
// public IP and rough location once per app session instead.
//
// Best-effort by design: no network, a blocked lookup or a slow response all
// resolve to an empty result rather than holding up app start.

type NetworkInfo = { ip?: string; location?: string; lat?: number; lng?: number };

const LOOKUP_URL = 'https://ipapi.co/json/';
const TIMEOUT_MS = 6000;

export async function fetchNetworkInfo(): Promise<NetworkInfo> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(LOOKUP_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return {};

    const data = (await response.json()) as {
      ip?: string;
      city?: string;
      region?: string;
      country_name?: string;
      latitude?: number;
      longitude?: number;
    };

    const place = [data.city, data.region, data.country_name].filter(Boolean).join(', ');
    // IP-derived, so only ever city-level accurate — good enough for the
    // GeoScore radius targeting in convex/lib/geo.ts without asking for (or
    // storing) real GPS coordinates. See AGENTS.md section 13/26: never use
    // precise location, never expose it from a public API.
    return {
      ip: data.ip,
      location: place || undefined,
      lat: typeof data.latitude === 'number' ? data.latitude : undefined,
      lng: typeof data.longitude === 'number' ? data.longitude : undefined,
    };
  } catch {
    return {};
  }
}

// Best-effort device locale -> ISO-639-1, used once at signup to seed
// users.language (see users.completeOnboarding). Falls back to English
// rather than leaving language unset, since an unset language degrades
// every language-relevance calculation to the neutral 0.3 score instead of
// getting the user any real personalization.
export function getDeviceLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const primary = locale.split(/[-_]/)[0]?.toLowerCase();
    return primary && primary.length === 2 ? primary : 'en';
  } catch {
    return 'en';
  }
}
