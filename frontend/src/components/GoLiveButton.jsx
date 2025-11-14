// frontend/src/components/GoLiveButton.jsx
import React from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function GoLiveButton({ className = "" }) {
  const navigate = useNavigate();
  const { id } = useParams(); // from /auction/:id
  const roomId = React.useMemo(() => `auction-${id}`, [id]);

  function handleGoLive() {
    navigate(`/host/${encodeURIComponent(roomId)}`);
  }

  return (
    <button
      onClick={handleGoLive}
      className={className || "bg-red-600 text-white px-4 py-2 rounded-lg"}
      title={`Start streaming in room: ${roomId}`}
    >
      Go Live (Start Stream)
    </button>
  );
}
