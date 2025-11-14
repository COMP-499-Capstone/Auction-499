import express from "express";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const router = express.Router();

const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://localhost:7880";
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

// sanity check
function requireEnv() {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("LIVEKIT_API_KEY / LIVEKIT_API_SECRET not set");
  }
}

router.get("/token", async (req, res) => {
  try {
    requireEnv();

    const room = (req.query.room || "auction-demo").toString();
    const identity = (req.query.identity || `guest-${Math.random().toString(36).slice(2,8)}`).toString();
    const role = (req.query.role || "viewer").toString(); // "host" | "viewer"

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      ttl: 60 * 10, // 10 minutes
      metadata: JSON.stringify({ role }),
      name: identity,
    });

    at.addGrant({
      room,
      roomJoin: true,
      roomCreate: role === "host",
      canPublish: role === "host",
      canPublishData: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    res.json({ token, url: LIVEKIT_URL });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to mint token" });
  }
});

// list rooms (for lobby UIs)
router.get("/rooms", async (req, res) => {
  try {
    requireEnv();
    const svc = new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, "http"), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    const rooms = await svc.listRooms();
    res.json({ rooms });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to list rooms" });
  }
});

// end room
router.delete("/rooms/:room", async (req, res) => {
  try {
    requireEnv();
    const roomName = req.params.room;
    const svc = new RoomServiceClient(LIVEKIT_URL.replace(/^ws/, "http"), LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
    await svc.deleteRoom(roomName);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed to end room" });
  }
});

export default router;
