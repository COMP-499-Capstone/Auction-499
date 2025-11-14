import React from "react";
import { Link } from "react-router-dom";

export default function LiveLobby() {
  const [room, setRoom] = React.useState(`auction-${Math.random().toString(36).slice(2,6)}`);
  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: 16 }}>
      <h2>Auctions Live</h2>
      <label>Room name</label>
      <input value={room} onChange={e => setRoom(e.target.value)} style={{ width: "100%", padding: 8, margin: "8px 0" }} />
      <div style={{ display: "flex", gap: 12 }}>
        <Link to={`/host/${encodeURIComponent(room)}`} className="btn">Start Hosting</Link>
        <Link to={`/watch/${encodeURIComponent(room)}`} className="btn">Join as Viewer</Link>
      </div>
      <p style={{ marginTop: 16, opacity: .7 }}>Share the <code>/watch/&lt;room&gt;</code> link with bidders.</p>
    </div>
  );
}
