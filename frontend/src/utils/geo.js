// src/utils/geo.js
export function getBrowserLocation({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout }
    );
  });
}

// Haversine great-circle distance in miles
export function distanceMiles(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.7613; // earth radius in miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}
