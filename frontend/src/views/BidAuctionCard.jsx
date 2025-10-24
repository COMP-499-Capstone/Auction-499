// src/views/BidAuctionCard.jsx
import React, { useState, useEffect } from "react";
import "../styles/HomePage.css";
import {
  getCurrentBidWithUser,
  getThumbnailUrl,
  getBidder,
  getStatus,
  raiseBid,
} from "../controllers/profileController";
import supabase from "../lib/supabaseClient";
import { zipToCity } from "../utils/zipLookup";
import {
  getWatchCount,
  isUserWatching,
  toggleWatch,
  subscribeWatchCount,
} from "../controllers/watchController";

export default function BidAuctionCard({
  auction,
  profileId,                // current viewer's profile id (null/undefined if signed out)
  onClick,
  onUnwatch,
  onUnwatchRevert,
}) {
  const endMs = auction?.end_time ? new Date(auction.end_time).getTime() : 0;
  const endsSoon = endMs > 0 && endMs - Date.now() <= 60 * 60 * 1000;

  const [currentBid, setCurrentBid] = useState(Number(auction?.starting_price ?? 0));
  const [newBid, setNewBid] = useState("");
  const [bidderUsername, setBidderUsername] = useState("");
  const [highestBidderId, setHighestBidderId] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [status, setStatus] = useState(auction?.status ?? "");

  // Watchers
  const [watchCount, setWatchCount] = useState(Number(auction?.watchers ?? 0));
  const [watching, setWatching] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);

  // Seller: name + id (we may only have the name for home feed, or only id for bids tab; fetch missing pieces)
  const [sellerName, setSellerName] = useState(auction?.seller || auction?.seller_username || "");
  const [sellerId, setSellerId] = useState(auction?.seller_id || null);

  useEffect(() => {
    // If we don’t have sellerId, fetch it from auctions; then fetch name if still missing.
    (async () => {
      if (!auction?.id) return;

      try {
        let sId = sellerId;
        if (!sId) {
          const { data, error } = await supabase
            .from("auctions")
            .select("seller_id")
            .eq("id", auction.id)
            .maybeSingle();
          if (!error && data?.seller_id) {
            sId = data.seller_id;
            setSellerId(sId);
          }
        }

        if (!sellerName && sId) {
          const { data: prof, error: pErr } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", sId)
            .maybeSingle();
          if (!pErr && prof?.username) setSellerName(prof.username);
        }
      } catch {
        /* non-fatal */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auction?.id]); // run once per auction

  // Location label
  const [locLabel, setLocLabel] = useState("");
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = (auction?.location ?? "").toString().trim();
      if (!raw) return !cancelled && setLocLabel("");
      if (!/^\d{5}$/.test(raw)) return !cancelled && setLocLabel(raw);
      const label = await zipToCity(raw);
      !cancelled && setLocLabel(label || `ZIP ${raw}`);
    })();
    return () => { cancelled = true; };
  }, [auction?.location]);

  // Highest bid init + realtime
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
          setHighestBidderId(Bid.id ?? null);
          setBidderUsername(Bid.username ?? "");
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
          const nextAmount = Number(payload.new?.bid_amount ?? 0);
          if (nextAmount > currentHighest) {
            currentHighest = nextAmount;
            setCurrentBid(nextAmount);
            setHighestBidderId(payload.new?.bidder_id ?? null);
            const uname = await getBidder(payload.new?.bidder_id);
            setBidderUsername(uname || "");
          }
        }
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [auction?.id, auction?.starting_price]);

  // Status init + realtime
  useEffect(() => {
    if (!auction?.id) return;
    (async () => {
      try {
        const s = await getStatus(auction.id);
        setStatus(s || auction.status || "");
      } catch (error) {
        console.error("Failed to set initial status:", error.message);
      }
    })();

    const channel = supabase
      .channel(`status-auction-${auction.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auction.id}` },
        (payload) => setStatus(payload.new.status)
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [auction?.id, auction?.status]);

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

  // Watches
  useEffect(() => {
    if (!auction?.id) return;
    let unsub = null;
    (async () => {
      try {
        const [count, mine] = await Promise.all([
          getWatchCount(auction.id),
          isUserWatching(auction.id, profileId),
        ]);
        setWatchCount(count ?? 0);
        setWatching(mine);
      } catch (e) {
        console.warn("watch init failed:", e.message);
      }
      unsub = subscribeWatchCount(auction.id, async () => {
        try {
          const c = await getWatchCount(auction.id);
          setWatchCount(c ?? 0);
        } catch {}
      });
    })();
    return () => { if (unsub) unsub(); };
  }, [auction?.id, profileId]);

  const onToggleWatch = async (e) => {
    e.stopPropagation();
    if (!profileId) return alert("Please sign in to watch auctions.");
    if (watchBusy) return;
    setWatchBusy(true);

    const prev = watching;
    if (prev && onUnwatch) onUnwatch(auction.id);      // optimistic removal in “Watching” tab
    setWatching(!prev);
    setWatchCount((c) => c + (prev ? -1 : 1));

    try {
      const now = await toggleWatch(auction.id, profileId);
      setWatching(now);
    } catch (err) {
      setWatching(prev);
      setWatchCount((c) => c + (prev ? 1 : -1));
      if (prev && onUnwatchRevert) onUnwatchRevert(auction);
      alert(err.message || "Failed to update watch.");
    } finally {
      setWatchBusy(false);
    }
  };

  const Bid = async (amount) => {
    try {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return;
      await raiseBid(auction.id, n, profileId);
      setNewBid("");
    } catch (err) {
      console.error("Failed to raise bid:", err.message);
    }
  };

  // Derived flags
  const iAmHighest = !!profileId && highestBidderId === profileId;
  const iAmSeller  = !!profileId && !!sellerId && profileId === sellerId;
  const signedOut  = !profileId;
  const ended      = status === "ended";
  const canBid     = !signedOut && !iAmSeller && !iAmHighest && !ended;

  // Outcome banner (only for signed-in, non-seller viewers)
  const outcome = ended && !!profileId && !iAmSeller
    ? (iAmHighest ? "won" : "lost")
    : null;

  return (
    <article
      className="hp-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" ? onClick() : null)}
      aria-label={`Auction ${auction.title}, current bid ${formatMoney(currentBid)}`}
    >
      <div className="hp-thumb-wrap" style={{ position: "relative" }}>
        {thumbnailUrl ? (
          <img className="hp-thumb" src={thumbnailUrl} alt={`${auction.title} thumbnail`} />
        ) : (
          <div className="hp-thumb-placeholder">No Image</div>
        )}

        {/* Outcome banner over image */}
        {outcome && (
          <div
            aria-live="polite"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                fontWeight: 800,
                fontSize: 18,
                letterSpacing: 0.5,
                color: "#ffffff",
                background: outcome === "won"
                  ? "rgba(16, 185, 129, 0.92)"   // green
                  : "rgba(239, 68, 68, 0.92)",   // red
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                textTransform: "uppercase",
              }}
            >
              {outcome === "won" ? "You Won" : "You Lost"}
            </div>
          </div>
        )}

        {/* Seller badge (top-left) — light pill so it's always visible */}
        {sellerName && (
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              borderRadius: 999,
              padding: "6px 10px",
              fontSize: 12,
              lineHeight: 1,
              userSelect: "none",
              backdropFilter: "saturate(120%) blur(2px)",
              maxWidth: "70%",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontWeight: 600,
            }}
            title={`Seller: ${sellerName}`}
            aria-label={`Seller ${sellerName}`}
          >
            {sellerName}
          </div>
        )}

        {/* Watch overlay (top-right) */}
        <button
          onClick={onToggleWatch}
          title={!profileId ? "Sign in to watch" : watching ? "Unwatch" : "Watch"}
          aria-pressed={watching}
          disabled={watchBusy}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 12,
            lineHeight: 1,
            border: "none",
            cursor: watchBusy ? "not-allowed" : "pointer",
            userSelect: "none",
            backdropFilter: "saturate(120%) blur(2px)",
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, color: "#fff" }}>
            <path
              fill="currentColor"
              d="M12 5c-5.5 0-9.5 4.5-10 7 0 .2.2.5.5.5.3 0 .4-.2.5-.3C4.2 9.3 7.7 7 12 7s7.8 2.3 9 5.2c.1.3.3.3.5.3s.5-.3.5-.5c-.6-2.5-4.5-7-10-7z"
            />
            <path fill="currentColor" d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
          </svg>
          <span aria-live="polite">{watchCount}</span>
        </button>
      </div>

      <div className="hp-card-body">
        <h3 className="hp-card-title">{auction.title}</h3>

        {/* Location + Reserve */}
        <div className="hp-row">
          <span className="hp-pill">{locLabel ? `📍 ${locLabel}` : "📍 Unknown"}</span>
          <span className="hp-meta">Reserve Price: {formatMoney(auction.reserve_price)}</span>
        </div>

        {/* Current bid (left) + start price (right) */}
        <div className="hp-row" style={{ alignItems: "flex-start", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontWeight: 700, marginBottom: 2 }}>Current bid:</span>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{formatMoney(currentBid)}</span>
            {bidderUsername && (
              <span className="hp-meta" style={{ marginTop: 2 }}>
                Highest bidder: {bidderUsername}
              </span>
            )}
          </div>
          <span className="hp-meta" style={{ marginLeft: "auto" }}>
            Start: {formatMoney(auction.starting_price)}
          </span>
        </div>

        <div className="hp-row hp-foot">
          <span className={`hp-time ${endsSoon ? "hp-soon" : ""}`}>{formatTimeLeft(endMs)}</span>
          <span className="hp-meta">Status: {status}</span>
        </div>

        {/* Bid input state machine */}
        {iAmHighest ? (
          <div
            className="hp-pill"
            style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", fontWeight: 600 }}
            title="You currently hold the top bid"
          >
            Your current bid: {formatMoney(currentBid)}
          </div>
        ) : signedOut ? (
          <div
            className="hp-pill"
            style={{ background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", fontWeight: 600 }}
          >
            Sign in to place a bid
          </div>
        ) : iAmSeller ? (
          <div
            className="hp-pill"
            style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", fontWeight: 600 }}
            title="Sellers cannot bid on their own auctions"
          >
            You’re the seller
          </div>
        ) : (
          <input
            type="number"
            value={newBid}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            onChange={(e) => setNewBid(e.target.value)}
            placeholder="Enter bid"
            min="0"
            step="0.01"
          />
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canBid) Bid(newBid);
          }}
          disabled={!canBid}
          title={
            status === "ended"
              ? "Auction ended"
              : signedOut
              ? "Sign in to bid"
              : iAmSeller
              ? "You can’t bid on your own auction"
              : iAmHighest
              ? "You already have the highest bid"
              : "Place a higher bid"
          }
        >
          {status === "ended" ? "Sold" : signedOut ? "Sign in to bid" : iAmSeller ? "Owner" : iAmHighest ? "Raise" : "Raise"}
        </button>
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
