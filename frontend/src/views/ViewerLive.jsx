// frontend/src/views/ViewerLive.jsx
import React from "react";
import { useParams } from "react-router-dom";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";
import { fetchToken } from "../lib/livekitClient";

export default function ViewerLive() {
  const { roomId } = useParams();
  const [state, setState] = React.useState({ token: null, url: null });
  const [err, setErr] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  const identity = React.useMemo(
    () => `viewer-${Math.random().toString(36).slice(2, 7)}`,
    []
  );

  const fallbackUrl = import.meta.env.VITE_LIVEKIT_URL || "wss://live.auctionflow.it.com";

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const baseUrl = import.meta.env.VITE_API_BASE_URL;

        const data = await fetchToken({
          baseUrl,
          room: roomId,
          identity,
          role: "viewer",
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
  }, [roomId, identity]);

  if (loading) {
    return <div style={{ padding: 20 }}>Connecting viewer to LiveKit…</div>;
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
      // viewers don’t need to publish by default
      data-lk-theme="default"
      style={{ height: "100vh" }}
    >
      <VideoConference />
    </LiveKitRoom>
  );
}
