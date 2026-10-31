// Location-name normalization for ad targeting, and a small static
// city -> coordinate table used as a geocoding fallback since no geocoding
// service is configured in this project. This keeps eligibility checks
// cheap (no per-request network calls) at the cost of only recognizing a
// bounded list of major cities — unrecognized city names still work for
// exact-name targeting, they just can't participate in radius targeting.
//
// Extending this table (or swapping it for a real geocoding service) never
// requires touching the eligibility logic in convex/ads.ts.

// Aliases -> canonical display name. Keys are pre-normalized (lowercased,
// diacritics stripped) so lookups are stable regardless of how the
// advertiser typed the city.
const CITY_ALIASES: Record<string, string> = {
  warsaw: 'Warsaw',
  warszawa: 'Warsaw',
  krakow: 'Krakow',
  cracow: 'Krakow',
  wroclaw: 'Wroclaw',
  breslau: 'Wroclaw',
  poznan: 'Poznan',
  gdansk: 'Gdansk',
  danzig: 'Gdansk',
  'new york': 'New York',
  nyc: 'New York',
  'new york city': 'New York',
  london: 'London',
  paris: 'Paris',
  berlin: 'Berlin',
  munich: 'Munich',
  munchen: 'Munich',
  madrid: 'Madrid',
  barcelona: 'Barcelona',
  rome: 'Rome',
  roma: 'Rome',
  milan: 'Milan',
  milano: 'Milan',
  amsterdam: 'Amsterdam',
  lisbon: 'Lisbon',
  lisboa: 'Lisbon',
  vienna: 'Vienna',
  wien: 'Vienna',
  prague: 'Prague',
  praha: 'Prague',
  'los angeles': 'Los Angeles',
  la: 'Los Angeles',
  chicago: 'Chicago',
  toronto: 'Toronto',
  dublin: 'Dublin',
};

export const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Warsaw: { lat: 52.2297, lng: 21.0122 },
  Krakow: { lat: 50.0647, lng: 19.945 },
  Wroclaw: { lat: 51.1079, lng: 17.0385 },
  Poznan: { lat: 52.4064, lng: 16.9252 },
  Gdansk: { lat: 54.352, lng: 18.6466 },
  'New York': { lat: 40.7128, lng: -74.006 },
  London: { lat: 51.5072, lng: -0.1276 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Munich: { lat: 48.1351, lng: 11.582 },
  Madrid: { lat: 40.4168, lng: -3.7038 },
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  Rome: { lat: 41.9028, lng: 12.4964 },
  Milan: { lat: 45.4642, lng: 9.19 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Lisbon: { lat: 38.7223, lng: -9.1393 },
  Vienna: { lat: 48.2082, lng: 16.3738 },
  Prague: { lat: 50.0755, lng: 14.4378 },
  'Los Angeles': { lat: 34.0522, lng: -118.2437 },
  Chicago: { lat: 41.8781, lng: -87.6298 },
  Toronto: { lat: 43.6532, lng: -79.3832 },
  Dublin: { lat: 53.3498, lng: -6.2603 },
};

function stripDiacritics(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

// Normalizes a free-typed location (advertiser input, or a user's IP-derived
// "City, Region, Country" string) down to a canonical city name. Falls back
// to a trimmed, title-cased version of the input for cities outside the
// known table, so targeting still works — it just won't resolve to
// coordinates for radius matching.
export function normalizeLocationName(raw: string): string {
  const firstSegment = raw.split(',')[0]?.trim() ?? raw.trim();
  const key = stripDiacritics(firstSegment).toLowerCase().trim();
  if (CITY_ALIASES[key]) return CITY_ALIASES[key];

  return firstSegment
    .split(/\s+/)
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

export function coordinatesForCity(cityName: string): { lat: number; lng: number } | null {
  return CITY_COORDINATES[cityName] ?? null;
}

// Reverse lookup for prefilling an existing radius-targeting UI (there's no
// real reverse geocoding here — this only recognizes the exact coordinates
// of a city already in CITY_COORDINATES, which is all that's needed since
// targetGeo is always set *from* one of these entries in the first place).
export function cityNameForCoordinates(lat: number, lng: number): string | null {
  for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
    if (coords.lat === lat && coords.lng === lng) return city;
  }
  return null;
}
