import React from "react";
import "../styles/HomePage.css";
import { useState, useEffect } from "react";
import { getCurrentBidWithUser, getThumbnailUrl, getBidder, sellAuction, getStatus, createTransaction } from "../controllers/profileController";
import supabase from "../lib/supabaseClient";

export default function ProfileAuctionCard({auction, profileId, onClick}) {
  const endsSoon =
    auction.end_time && auction.end_time - Date.now() <= 60 * 60 * 1000;

    const [currentBid, setCurrentBid] = useState("");
    const [bidderUsername, setBidderUsername] = useState("");
    const [bidderId, setBidderId] = useState("");
    const [thumbnailUrl, setThumbnailUrl] = useState("");
    const [status, setStatus] = useState("");

    // this loads then listens for more
    useEffect(() => {
        if (!auction.id) return;
        let currentHighest = 0;

        (async() => {
          try {
            const Bid = await getCurrentBidWithUser(auction.id);
            if (Bid) {
              currentHighest = Bid.amount;
              setCurrentBid(Bid.amount);
              setBidderUsername(Bid.username);
              setBidderId(Bid.id);
            }
          } catch (err) {
            console.error("Failed to fetch inital bid and user:", err.message);
          }
        })();

        // listener for incoming bids
        const channel = supabase
        .channel(`bids-auction-${auction.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bids",
            filter: `auction_id=eq.${auction.id}`,
          },
          async (payload) => {
            const newBid = payload.new;
            const username = await getBidder(newBid.bidder_id);

            if (newBid.bid_amount > currentHighest) {
              currentHighest = newBid.bid_amount;
              setCurrentBid(newBid.bid_amount);
              setBidderUsername(username);
            }
          }
        )
        .subscribe();
        return () => {
          supabase.removeChannel(channel);
        };
    }, [auction.id]);

    // set status initially 
    useEffect(() => {
      const initialStatus = async () => {
        try {
          const status = await getStatus(auction.id);
          setStatus(status);
        } catch (error) {
          console.error("failed to get initial status:", error.message);
        }
      };

      if (auction.id) initialStatus();
    }, [auction.id]);

    // sets thumbail for auction post
    useEffect(() => {
        const getThumbnail = async () => {
        try {
            const thumbnail = await getThumbnailUrl(auction.id);
            setThumbnailUrl(thumbnail);
        } catch (err) {
            console.error("failed to get thumbnail url:", err.message);
        }
    };

    if (auction.id) getThumbnail();
    console.log("url:", thumbnailUrl);
    }, [auction.id]);

    const handleSell = async () => {
      // changes status
      try {
        await sellAuction(auction.id);
        setStatus("ended");
      } catch (err) {
        console.error("Failed to sell Item", err.message);
      }

      // makes transaction payment so it shows up in transactions section
      try {
        await createTransaction(auction.id, bidderId, profileId, currentBid);
      } catch (err) {
        console.error("Failed to create transaction:", err.message);
      }
    }
 
  return (
    <article
      className="hp-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" ? onClick() : null)}
      aria-label={`Auction ${auction.title}, current bid ${formatMoney(
        currentBid
      )}`}>
      <div className="hp-thumb-wrap">
        {thumbnailUrl ? (
        <img
          className="hp-thumb"
          src={thumbnailUrl}
          alt={`${auction.title} thumbnail`}
        /> 
        ) : (
          <div className="hp-thumb-placeholder"> No Image</div>
        )}
      </div>

      <div className="hp-card-body">
        <h3 className="hp-card-title">{auction.title}</h3>

        <div className="hp-row">
          <span className="hp-pill">Start Price: {auction.starting_price}</span>
          <span className="hp-meta">Reserve Price: {auction.reserve_price}</span>
        </div>

        <div className="hp-row">
          <strong>{formatMoney(currentBid)}</strong> 
          <span className="hp-meta">Highest bidder: {bidderUsername}</span> 
        </div>

        <div className="hp-row hp-foot">
          <span className={`hp-time ${endsSoon ? "hp-soon" : ""}`}>
            {formatTimeLeft(auction.endsAt)}
          </span>
          <span className="hp-meta">Status: {status}</span>
        </div>
        <button onClick={(e) => {
          e.stopPropagation();
          handleSell();
        }}
        disabled={status === "ended"}
        >
          {status === "ended" ? "Sold" : "Sell"}
        </button>
      </div>
    </article>
  );
}

/* Utilities */
function formatMoney(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n ?? 0);
}

function formatTimeLeft(endsAtMs) {
  const ms = (endsAtMs ?? 0) - Date.now();
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}
