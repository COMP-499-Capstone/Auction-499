// frontend/src/views/HostLive.jsx
import React from "react";
import { useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { fetchToken } from "../lib/livekitClient";

export default function HostLive() {
  const { roomId } = useParams();
  const [state, setState] = React.useState({ token: null, url: null });
  const [err, setErr] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const identity = React.useMemo(
    () => `host-${Math.random().toString(36).slice(2, 7)}`,
    []
  );

  // ✅ use your API base URL from .env
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  const fallbackUrl = import.meta.env.VITE_LIVEKIT_URL || "ws://localhost:7880";

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const data = await fetchToken({
          baseUrl,          // ✅ pass baseUrl so it calls https://api.auctionflow.it.com
          room: roomId,
          identity,
          role: "host",
        });

        if (!cancelled) {
          setState(data);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setErr(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId, identity, baseUrl]); // baseUrl is static from env, this is fine

  if (loading) {
    return <div style={{ padding: 20 }}>Connecting host to LiveKit…</div>;
  }

  if (err) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Error connecting to LiveKit:
        <br />
        {err}
      </div>
    );
  }

  if (!state.token) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        No token received from server.
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={state.token}
      serverUrl={state.url || fallbackUrl}
      connect
      video
      audio
      data-lk-theme="default"
      style={{ height: "100vh" }}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}
