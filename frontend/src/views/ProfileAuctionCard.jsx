// src/views/ProfileAuctionCard.jsx
import React, { useEffect, useState } from "react";
import "../styles/HomePage.css";
import {
  getCurrentBidWithUser,
  getThumbnailUrl,
  getBidder,
  sellAuction,
  getStatus,
  createTransaction,
  updateAuction,
  deleteAuction,
} from "../controllers/profileController";
import supabase from "../lib/supabaseClient";

export default function ProfileAuctionCard({
  auction,
  profileId,
  onClick,
  onEdit,   // optional: (auction) => void
  onDelete, // optional: (auctionId) => void
}) {
  // Normalize end time once
  const endMs = auction?.end_time ? new Date(auction.end_time).getTime() : 0;
  const endsSoon = endMs > 0 && endMs - Date.now() <= 60 * 60 * 1000;

  const [currentBid, setCurrentBid] = useState(Number(auction?.starting_price ?? 0));
  const [bidderUsername, setBidderUsername] = useState("");
  const [bidderId, setBidderId] = useState(""); // winner id for transaction
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState(auction?.status ?? "");
  const [isGone, setIsGone] = useState(false); // hide after delete

  // Load initial highest bid and subscribe for new ones
  useEffect(() => {
    if (!auction?.id) return;

    let currentHighest = Number(auction.starting_price ?? 0);

    (async () => {
      try {
        const Bid = await getCurrentBidWithUser(auction.id);
        if (Bid) {
          const amount = Number(Bid.amount ?? Bid.bid_amount ?? 0);
          if (amount > currentHighest) currentHighest = amount;
          setCurrentBid(currentHighest);
          setBidderUsername(Bid.username ?? "");
          setBidderId(Bid.bidder_id ?? Bid.id ?? "");
        }
      } catch (err) {
        console.error("Failed to fetch initial bid and user:", err.message);
      }
    })();

    const channel = supabase
      .channel(`bids-auction-${auction.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `auction_id=eq.${auction.id}` },
        async (payload) => {
          const newBid = payload.new;
          const nextAmount = Number(newBid.bid_amount ?? 0);
          if (nextAmount > currentHighest) {
            currentHighest = nextAmount;
            setCurrentBid(nextAmount);
            setBidderId(newBid.bidder_id);
            const username = await getBidder(newBid.bidder_id);
            setBidderUsername(username || "");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auction?.id, auction?.starting_price]);

  // Initial status (fallback to existing)
  useEffect(() => {
    if (!auction?.id) return;
    (async () => {
      try {
        const s = await getStatus(auction.id);
        setStatus(s || auction.status || "");
      } catch (error) {
        console.error("Failed to get initial status:", error.message);
      }
    })();
  }, [auction?.id]);

  // Thumbnail
  useEffect(() => {
    if (!auction?.id) return;
    (async () => {
      try {
        const thumbnail = await getThumbnailUrl(auction.id);
        setThumbnailUrl(thumbnail || "");
      } catch (err) {
        console.error("Failed to get thumbnail url:", err.message);
      }
    })();
  }, [auction?.id]);

  const handleSell = async () => {
    try {
      // 1) end auction
      await sellAuction(auction.id);
      setStatus("ended");

      // 2) create transaction if we have a buyer and a winning amount
      const price = Number(currentBid);
      if (bidderId && Number.isFinite(price) && price > 0) {
        await createTransaction(auction.id, bidderId, profileId, price);
      }
    } catch (err) {
      console.error("Failed to sell or create transaction:", err.message);
    }
  };

  // ---- EDIT ----
  const handleEdit = async (e) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(auction);
      return;
    }

    // Quick inline prompts for testing; replace with modal as needed.
    try {
      const nextTitle = prompt("New title (leave blank to keep current):", auction.title || "");
      const nextReserve = prompt(
        "New reserve price (leave blank to keep current):",
        auction.reserve_price ?? ""
      );

      const patch = {};
      if (nextTitle !== null && nextTitle.trim() !== "" && nextTitle !== auction.title) {
        patch.title = nextTitle.trim();
      }
      if (nextReserve !== null && nextReserve.trim() !== "") {
        const rp = Number(nextReserve);
        if (!Number.isNaN(rp)) patch.reserve_price = rp;
      }

      if (Object.keys(patch).length === 0) return;

      const updated = await updateAuction(auction.id, patch);
      // Optimistic local update
      if (updated?.title) auction.title = updated.title;
      if (typeof updated?.reserve_price !== "undefined")
        auction.reserve_price = updated.reserve_price;
      // Force a re-render by touching state (no heavy refresh needed)
      setStatus((s) => s);
    } catch (err) {
      alert(err.message || "Failed to update auction.");
    }
  };

  // ---- DELETE ----
  const handleDelete = async (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(auction.id);
      return;
    }
    if (!confirm("Delete this auction? This cannot be undone.")) return;
    try {
      await deleteAuction(auction.id);
      setIsGone(true);
    } catch (err) {
      alert(err.message || "Failed to delete auction.");
    }
  };

  if (isGone) return null;

  return (
    <article
      className="hp-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" ? onClick() : null)}
      aria-label={`Auction ${auction.title}, current bid ${formatMoney(currentBid)}`}
    >
      <div className="hp-thumb-wrap">
        {thumbnailUrl ? (
          <img className="hp-thumb" src={thumbnailUrl} alt={`${auction.title} thumbnail`} />
        ) : (
          <div className="hp-thumb-placeholder">No Image</div>
        )}
      </div>

      <div className="hp-card-body">
        <h3 className="hp-card-title">{auction.title}</h3>

        <div className="hp-row">
          <span className="hp-pill">Start Price: {formatMoney(auction.starting_price)}</span>
          <span className="hp-meta">Reserve Price: {formatMoney(auction.reserve_price)}</span>
        </div>

        <div className="hp-row" style={{ alignItems: "baseline" }}>
          <strong>{formatMoney(currentBid)}</strong>
          <span className="hp-meta" title={bidderUsername || "No bids yet"}>
            Highest bidder: {bidderUsername || "None yet"}
          </span>
        </div>

        <div className="hp-row hp-foot">
          <span className={`hp-time ${endsSoon ? "hp-soon" : ""}`}>{formatTimeLeft(endMs)}</span>
          <span className="hp-meta">Status: {status}</span>
        </div>

        {/* Action bar: Sell / Edit / Delete */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            marginTop: 12,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSell();
            }}
            disabled={status === "ended"}
            aria-label="Sell"
            style={{
              background: status === "ended"
              ? "rgba(59,130,246,0.25)"    // soft blue faded
              : "#aba79e",
              color: "#ffffff",
              fontWeight: 600,
              border: "none",
              borderRadius: 12,
              padding: "10px 18px",
              cursor: status === "ended" ? "not-allowed" : "pointer",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
              transition: "0.2s",
            }}
          >
            {status === "ended" ? "Sold" : "Sell"}
          </button>

          <button
            type="button"
            onClick={handleEdit}
            aria-label="Edit"
            style={{
              background: "rgba(255,255,255,0.6)",   // frosted glass white
              color: "#1f2937",
              fontWeight: 600,
              border: "none",
              borderRadius: 12,
              padding: "10px 18px",
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
              transition: "0.2s",
            }}
          >
            Edit
          </button>

          <button
            type="button"
            onClick={handleDelete}
            aria-label="Delete"
            style={{
             background: "rgba(75,85,99,0.65)",    // soft dark grey
              color: "#fff",
              fontWeight: 600,
              border: "none",
              borderRadius: 12,
              padding: "10px 18px",
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
              transition: "0.2s",
            }}
          >
            Delete
          </button>

        </div>
      </div>
    </article>
  );
}

/* Utilities */
function formatMoney(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);
}

function formatTimeLeft(endMs) {
  const ms = (endMs ?? 0) - Date.now();
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}
