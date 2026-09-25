// Haversine distance + a bounded exponential decay GeoScore, plus a weaker
// normalized-city-name fallback for when coordinates aren't available.
import { GEO } from './rankingConfig';

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// GeoScore = exp(-distance / decayKm), bounded to (0, 1].
export function geoScoreFromDistance(distanceKm: number): number {
  return Math.exp(-distanceKm / GEO.decayKm);
}

export function geoScore(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined
): number {
  if (!a || !b) return 0;
  return geoScoreFromDistance(haversineKm(a, b));
}

// Weak fallback when neither side has coordinates: exact match on a
// normalized city string (see lib/locations.ts) is worth something, a
// mismatch (or missing data) is worth nothing.
export function cityMatchScore(cityA: string | null | undefined, cityB: string | null | undefined): number {
  if (!cityA || !cityB) return 0;
  return cityA === cityB ? 0.6 : 0;
}
