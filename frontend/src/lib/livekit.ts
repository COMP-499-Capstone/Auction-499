import { Room } from "livekit-client";

export async function connectToRoom(room: string, identity: string) {
  const tokenRes = await fetch(
    `${import.meta.env.VITE_TOKEN_ENDPOINT}?room=${encodeURIComponent(room)}&identity=${encodeURIComponent(identity)}`
  );
  if (!tokenRes.ok) throw new Error("Failed to fetch token");
  const { url, token } = await tokenRes.json();

  const lkUrl = url || import.meta.env.VITE_LIVEKIT_URL;
  const lkRoom = new Room();
  await lkRoom.connect(lkUrl, token);
  await lkRoom.localParticipant.enableCameraAndMicrophone();
  return lkRoom;
}