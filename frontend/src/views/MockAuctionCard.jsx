import React from "react";
import "../styles/HomePage.css";

export default function MockAuctionCard({auction, onClick}) {
  const endsSoon =
    auction.endsAt && auction.endsAt - Date.now() <= 60 * 60 * 1000;

  return (
    <article
      className="hp-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" ? onClick() : null)}
      aria-label={`Auction ${auction.title}, current bid ${formatMoney(
        auction.currentBid
      )}`}>
      <div className="hp-thumb-wrap">
        <img
          className="hp-thumb"
          src={auction.thumbnail}
          alt={`${auction.title} thumbnail`}
        />
      </div>

      <div className="hp-card-body">
        <h3 className="hp-card-title">{auction.title}</h3>

        <div className="hp-row">
          <span className="hp-pill">{auction.condition}</span>
          <span className="hp-meta">{auction.location}</span>
        </div>

        <div className="hp-row">
          <strong>{formatMoney(auction.currentBid)}</strong>
          <span className="hp-meta">{auction.watchers} watching</span>
        </div>

        <div className="hp-row hp-foot">
          <span className={`hp-time ${endsSoon ? "hp-soon" : ""}`}>
            {formatTimeLeft(auction.endsAt)}
          </span>
          <span className="hp-meta">Seller: {auction.seller}</span>
        </div>
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
