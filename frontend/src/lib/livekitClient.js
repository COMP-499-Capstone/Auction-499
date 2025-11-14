export async function fetchToken({ baseUrl = "", room, identity, role }) {
  const url = `${baseUrl}/api/livekit/token?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(identity)}&role=${role}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch token");
  const data = await res.json();
  return { token: data.token, url: data.url };
}
