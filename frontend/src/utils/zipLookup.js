// src/utils/zipLookup.js
// One fetch → two helpers: city label + coordinates.
// Caches in-memory and in localStorage.

const infoCache = new Map(); // zip -> { city, state, lat, lng }

async function fetchZipInfo(zip) {
  const z = String(zip || "").trim();
  if (!/^\d{5}$/.test(z)) return null;

  // memory cache
  if (infoCache.has(z)) return infoCache.get(z);

  // localStorage cache
  try {
    const raw = localStorage.getItem(`zipinfo:${z}`);
    if (raw) {
      const obj = JSON.parse(raw);
      infoCache.set(z, obj);
      return obj;
    }
  } catch {}

  // fetch from Zippopotam
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${z}`);
    if (!res.ok) throw new Error("ZIP not found");
    const data = await res.json();

    const place = data?.places?.[0];
    const city = place?.["place name"] || null;
    const state =
      place?.["state abbreviation"] || place?.state || null;
    // Zippopotam gives lat/lng as strings
    const lat = place?.latitude ? Number(place.latitude) : null;
    const lng = place?.longitude ? Number(place.longitude) : null;

    const obj = city && state ? { city, state, lat, lng } : null;
    if (obj) {
      infoCache.set(z, obj);
      try {
        localStorage.setItem(`zipinfo:${z}`, JSON.stringify(obj));
      } catch {}
    }
    return obj;
  } catch {
    return null;
  }
}

/** Returns "City, ST" string or null */
export async function zipToCity(zip) {
  const info = await fetchZipInfo(zip);
  return info ? `${info.city}, ${info.state}` : null;
}

/** Returns {lat, lng} or null */
export async function zipToCoords(zip) {
  const info = await fetchZipInfo(zip);
  return info && Number.isFinite(info.lat) && Number.isFinite(info.lng)
    ? { lat: info.lat, lng: info.lng }
    : null;
}
