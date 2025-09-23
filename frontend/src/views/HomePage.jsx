import React, {useEffect, useMemo, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import supabase from "../lib/supabaseClient";
import {fetchFeaturedAuctions} from "../controllers/homeController";
import "../styles/HomePage.css";
import MockAuctionCard from "./MockAuctionCard";

export default function HomePage() {
  const nav = useNavigate();

  // filters
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("any");
  const [sort, setSort] = useState("endingSoon");

  // data state
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState([]);
  const [error, setError] = useState("");

  // user menu state
  const [session, setSession] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userBtnRef = useRef(null);
  const userMenuRef = useRef(null);

  // fetch auctions when filters change
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const rows = await fetchFeaturedAuctions({
          query,
          condition: filter,
          sort,
        });
        if (!alive) return;
        setAuctions(rows);
      } catch {
        if (!alive) return;
        setError("Failed to load auctions.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [query, filter, sort]);

  // load session + subscribe to auth changes so menu reflects current state
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({data}) => {
      if (mounted) setSession(data?.session ?? null);
    });

    const {data: sub} = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // close user menu on outside click or Esc
  useEffect(() => {
    const onDocClick = (e) => {
      const btn = userBtnRef.current;
      const menu = userMenuRef.current;
      if (!btn && !menu) return;
      if (btn?.contains(e.target) || menu?.contains(e.target)) return;
      setUserMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setUserMenuOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const display = useMemo(() => auctions, [auctions]);

  const clearFilters = () => {
    setQuery("");
    setFilter("any");
    setSort("endingSoon");
  };

  // user menu actions
  const goSignIn = () => {
    setUserMenuOpen(false);
    nav("/auth");
  };
  const goSignUp = () => {
    setUserMenuOpen(false);
    nav("/signup");
  };
  const goAccount = () => {
    if (!session?.user?.id) return;
    setUserMenuOpen(false);
    nav(`/account/${session.user.id}`);
  };
  const doSignOut = async () => {
    await supabase.auth.signOut();
    setUserMenuOpen(false);
  };

  return (
    <div className="home-shell">
      <div className="home-page">
        <h1 className="hp-title">Auction</h1>

        <header className="hp-topbar">
          <form
            className="hp-search-row"
            onSubmit={(e) => e.preventDefault()}
            aria-label="Search auctions">
            <div className="hp-search-wrap">
              <input
                className="hp-search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items, sellers, or locations…"
                aria-label="Search query"
              />
              {query && (
                <button
                  type="button"
                  className="hp-clear-btn"
                  onClick={() => setQuery("")}
                  aria-label="Clear">
                  ×
                </button>
              )}
            </div>

            <Dropdown
              label="Filter"
              value={filter}
              onChange={setFilter}
              options={[
                {value: "any", label: "Filter: Any"},
                {value: "new", label: "New"},
                {value: "used", label: "Used"},
              ]}
            />

            <Dropdown
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                {value: "endingSoon", label: "Sort: Ending soon"},
                {value: "highest", label: "Price: High → Low"},
                {value: "lowest", label: "Price: Low → High"},
              ]}
            />

            <button
              type="button"
              className="hp-reset-btn"
              onClick={clearFilters}>
              Reset
            </button>
          </form>

          {/* user menu */}
          <div className="hp-user">
            <button
              ref={userBtnRef}
              className="hp-profile-btn"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              title="Account">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                aria-hidden="true">
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path
                  d="M4 20c0-4 4-6 8-6s8 2 8 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            {userMenuOpen && (
              <div className="hp-user-menu" role="menu" ref={userMenuRef}>
                {session ? (
                  <>
                    <button
                      className="hp-user-item"
                      role="menuitem"
                      onClick={goAccount}>
                      My account
                    </button>
                    <button
                      className="hp-user-item danger"
                      role="menuitem"
                      onClick={doSignOut}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="hp-user-item"
                      role="menuitem"
                      onClick={goSignIn}>
                      Sign in
                    </button>
                    <button
                      className="hp-user-item primary"
                      role="menuitem"
                      onClick={goSignUp}>
                      Create account
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <section className="hp-section">
          <h2 className="hp-h2">Featured</h2>

          {loading && (
            <div className="hp-grid">
              {Array.from({length: 6}).map((_, i) => (
                <div key={i} className="hp-card hp-skeleton">
                  <div className="hp-thumb-wrap skeleton-box" />
                  <div className="hp-card-body">
                    <div className="skeleton-line w-60" />
                    <div className="skeleton-line w-40" />
                    <div className="skeleton-line w-80" />
                    <div className="skeleton-line w-50" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <div className="hp-error">{error}</div>}

          {!loading && !error && display.length === 0 && (
            <div className="hp-info">No auctions match your filters.</div>
          )}

          {!loading && !error && display.length > 0 && (
            <div className="hp-grid">
              {display.map((a) => (
                <AuctionCard
                  key={a.id}
                  auction={a}
                  onClick={() => nav(`/auction/${a.id}`)}
                />
              ))}
            </div>
          )}

          {/* mock preview cards while designing */}
          <div className="hp-grid">
            {MOCK_AUCTIONS.map((a) => (
              <MockAuctionCard
                key={a.id}
                auction={a}
                onClick={() => nav(`/auction/${a.id}`)}
              />
            ))}
          </div>
        </section>

        <button
          className="hp-fab"
          onClick={() => nav("/sell")}
          aria-label="Create auction"
          title="Create auction">
          <span className="hp-fab-plus">+</span>
          <span className="hp-fab-label">Sell</span>
        </button>
      </div>
    </div>
  );
}

function AuctionCard({auction, onClick}) {
  const timeLeft = formatTimeLeft(auction.endsAt);
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
            {timeLeft}
          </span>
          <span className="hp-meta">Seller: {auction.seller}</span>
        </div>
      </div>
    </article>
  );
}

/* Custom dropdown (Filter/Sort) */
function Dropdown({label, value, onChange, options}) {
  const [open, setOpen] = useState(false);
  const [kbIndex, setKbIndex] = useState(-1);
  const ref = useRef(null);

  const current = options.find((o) => o.value === value)?.label || label;

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const onKeyDown = (e) => {
    if (
      !open &&
      (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")
    ) {
      e.preventDefault();
      setOpen(true);
      setKbIndex(0);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setKbIndex((i) => Math.min(i + 1, options.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setKbIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[kbIndex];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    }
  };

  return (
    <div className="hp-dd" ref={ref}>
      <button
        type="button"
        className="hp-dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}>
        {current}
        <svg className="hp-dd-caret" viewBox="0 0 24 24" aria-hidden="true">
          <polyline
            points="6 9 12 15 18 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="hp-dd-menu" role="listbox" tabIndex={-1}>
          {options.map((opt, idx) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`hp-dd-item ${idx === kbIndex ? "kb-focus" : ""}`}
              onMouseEnter={() => setKbIndex(idx)}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}>
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* utilities */
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

const MOCK_AUCTIONS = [
  {
    id: "1",
    title: "Vintage Lamp",
    condition: "used",
    currentBid: 85,
    watchers: 12,
    location: "Austin, TX",
    seller: "alice",
    thumbnail: "https://picsum.photos/seed/vintage-lamp/400/300",
    endsAt: Date.now() + 1000 * 60 * 45,
  },
  {
    id: "2",
    title: "Signed Poster",
    condition: "new",
    currentBid: 220,
    watchers: 34,
    location: "Brooklyn, NY",
    seller: "bob",
    thumbnail: "https://picsum.photos/seed/signed-poster/400/300",
    endsAt: Date.now() + 1000 * 60 * 120,
  },
  {
    id: "3",
    title: "Retro Radio",
    condition: "used",
    currentBid: 60,
    watchers: 8,
    location: "Seattle, WA",
    seller: "chris",
    thumbnail: "https://picsum.photos/seed/retro-radio/400/300",
    endsAt: Date.now() + 1000 * 60 * 240,
  },
  {
    id: "4",
    title: "Ceramic Vase",
    condition: "new",
    currentBid: 45,
    watchers: 15,
    location: "Miami, FL",
    seller: "dan",
    thumbnail: "https://picsum.photos/seed/ceramic-vase/400/300",
    endsAt: Date.now() + 1000 * 60 * 360,
  },
  {
    id: "5",
    title: "Leather Jacket",
    condition: "used",
    currentBid: 150,
    watchers: 29,
    location: "Chicago, IL",
    seller: "emily",
    thumbnail: "https://picsum.photos/seed/leather-jacket/400/300",
    endsAt: Date.now() + 1000 * 60 * 600,
  },
  {
    id: "6",
    title: "Antique Clock",
    condition: "used",
    currentBid: 310,
    watchers: 45,
    location: "Portland, OR",
    seller: "frank",
    thumbnail: "https://picsum.photos/seed/antique-clock/400/300",
    endsAt: Date.now() + 1000 * 60 * 900,
  },
];
