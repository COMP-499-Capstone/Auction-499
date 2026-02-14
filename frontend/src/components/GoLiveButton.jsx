// frontend/src/components/GoLiveButton.jsx
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function GoLiveButton({ className = "" }) {
  const navigate = useNavigate();
  const { id } = useParams(); // from /listing/:id
  const roomId = React.useMemo(() => `auction-${id}`, [id]);

  function handleGoLive() {
    if (!roomId) return;
    navigate(`/host/${encodeURIComponent(roomId)}`);
  }

  return (
    <button
      type="button"
      onClick={handleGoLive}
      // inline style so it ALWAYS looks like a nice button
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.5rem 0.75rem",
        borderRadius: "9999px",           // pill shape
        backgroundColor: "#2563eb",       // blue-600
        border: "1px solid #1d4ed8",      // blue-700 border
        color: "#ffffff",
        fontSize: "0.875rem",
        fontWeight: 600,
        boxShadow: "0 1px 3px rgba(15,23,42,0.18)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
      className={className}
      title={`Start streaming in room: ${roomId}`}
    >
      Start Live Stream
    </button>
  );
}
