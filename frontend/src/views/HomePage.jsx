// src/views/HomePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import { fetchFeaturedAuctions, fetchUsername } from "../controllers/homeController";
import BidAuctionCard from "./BidAuctionCard";
import { zipToCoords } from "../utils/zipLookup";
import { getBrowserLocation, distanceMiles } from "../utils/geo";
import "../styles/HomePage.css";

export default function HomePage() {
  const nav = useNavigate();

  // filters
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("any"); // any | new | used | nearby
  const [sort, setSort] = useState("endingSoon"); // endingSoon | highest | lowest
  const [radius, setRadius] = useState(50); // miles for "nearby"

  // geolocation
  const [userLoc, setUserLoc] = useState(null); // {lat,lng}

  // data state
  const [loading, setLoading] = useState(true);
  const [auctions, setAuctions] = useState([]);
  const [error, setError] = useState("");
  const [username, setUsername] = useState(null);

  // cache for ZIP -> {lat,lng}
  const [zipCoordCache, setZipCoordCache] = useState({}); // { "93060": {lat, lng} }

  // user menu state
  const [session, setSession] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userBtnRef = useRef(null);
  const userMenuRef = useRef(null);

  // Ensure profile exists so username lookups succeed
  async function ensureProfile(user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (error) return;
    if (!data) {
      const fallback =
        user.user_metadata?.username ||
        user.email?.split("@")[0] ||
        `user_${user.id.slice(0, 6)}`;
      await supabase
        .from("profiles")
        .insert([{ id: user.id, username: fallback, role: "user" }]);
    }
  }

  // fetch auctions when filters change
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const rows = await fetchFeaturedAuctions({ query, condition: filter, sort });
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

  // If user chooses "Near me", ask for location (once).
  useEffect(() => {
    let cancelled = false;
    if (filter !== "nearby" || userLoc) return;

    (async () => {
      try {
        const loc = await getBrowserLocation();
        if (!cancelled) setUserLoc(loc);
      } catch (err) {
        console.warn("Location permission denied or failed:", err?.message);
        if (!cancelled) {
          alert("We couldn’t access your location. Showing all items instead.");
          setFilter("any");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, userLoc]);

  // When "nearby" and auctions change, prefetch coords for any ZIPs we don't have yet.
  useEffect(() => {
    let cancelled = false;
    if (filter !== "nearby") return;

    (async () => {
      const zips = new Set(
        auctions
          .map((a) => (a.location || "").toString().trim())
          .filter((z) => /^\d{5}$/.test(z))
      );

      const missing = [...zips].filter((z) => !zipCoordCache[z]);
      if (missing.length === 0) return;

      const entries = await Promise.all(
        missing.map(async (z) => [z, await zipToCoords(z)])
      );

      if (!cancelled) {
        setZipCoordCache((prev) => {
          const next = { ...prev };
          for (const [z, coord] of entries) {
            if (coord) next[z] = coord;
          }
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filter, auctions, zipCoordCache]);

  // load session + react to auth changes
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data?.session ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // when session changes, ensure profile exists and then fetch username
  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) {
        setUsername(null);
        return;
      }
      try {
        await ensureProfile(session.user);
        const name = await fetchUsername(uid);
        setUsername(name || session.user.email?.split("@")[0] || "User");
      } catch {
        setUsername(session?.user?.email?.split("@")[0] || "User");
      }
    })();
  }, [session?.user?.id]);

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

  // Prepare display list. If "nearby", filter in-memory by ZIP distance using cached coords.
  const display = useMemo(() => {
    let list = auctions;

    if (filter === "nearby" && userLoc) {
      const filtered = [];
      for (const a of auctions) {
        const raw = (a.location || "").toString().trim();
        if (!/^\d{5}$/.test(raw)) continue; // only ZIPs are filterable
        const zipCoord = zipCoordCache[raw];
        if (!zipCoord) continue; // coordinates not loaded yet
        const d = distanceMiles(userLoc, zipCoord);
        if (d <= radius) filtered.push({ ...a, _distance: d });
      }
      // Sort nearby list by distance, then by soonest ending (if available).
      filtered.sort((x, y) => {
        const d = (x._distance ?? 0) - (y._distance ?? 0);
        if (d !== 0) return d;
        return (x.endsAt ?? 0) - (y.endsAt ?? 0);
      });
      list = filtered;
    }

    return list;
  }, [auctions, filter, userLoc, radius, zipCoordCache]);

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
    nav(`/profile/${session.user.id}`);
  };
  const doSignOut = async () => {
    await supabase.auth.signOut();
    setUserMenuOpen(false);
  };

  return (
    <div className="home-shell">
      <div className="home-page" style={{ paddingTop: 8 }}>
        {/* Title */}
        <h1
          className="hp-title"
          style={{
            fontSize: 44,
            fontWeight: 800,
            textAlign: "center",
            marginTop: 8,
            marginBottom: 20,
            letterSpacing: "-0.5px",
            color: "#0f172a",
          }}
        >
          Auction
        </h1>

        {/* Minimal welcome banner (no CTA buttons) */}
        {session?.user && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 14,
              background: "linear-gradient(135deg, #ffffff, #f8fafc)",
              borderRadius: 14,
              padding: "14px 18px",
              margin: "0 auto 20px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.05)",
              maxWidth: 700,
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 10px 30px rgba(0,0,0,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.05)";
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#2563eb",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                color: "#fff",
                fontSize: 18,
                flexShrink: 0,
              }}
              title="Profile"
            >
              {username ? String(username).slice(0, 1).toUpperCase() : "U"}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>
                Welcome back, {username}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                Ready to bid or create a listing?
              </div>
            </div>
          </div>
        )}

        <header className="hp-topbar" style={{ marginTop: 8 }}>
          <form
            className="hp-search-row"
            onSubmit={(e) => e.preventDefault()}
            aria-label="Search auctions"
          >
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
                  aria-label="Clear"
                >
                  ×
                </button>
              )}
            </div>

            <Dropdown
              label="Filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "any", label: "Filter: Any" },
                { value: "new", label: "New" },
                { value: "used", label: "Used" },
                { value: "nearby", label: "Near me" }, // NEW
              ]}
            />

            <Dropdown
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: "endingSoon", label: "Sort: Time left" }, // renamed
                { value: "highest", label: "Price: High → Low" },
                { value: "lowest", label: "Price: Low → High" },
              ]}
            />

            <button type="button" className="hp-reset-btn" onClick={clearFilters}>
              Reset
            </button>
          </form>

          {/* Radius control when "Near me" is active */}
          {filter === "nearby" && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, color: "#374151" }}>Radius:</label>
              <input
                type="range"
                min={5}
                max={200}
                step={5}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
              <span style={{ fontSize: 13, color: "#111827", minWidth: 48 }}>
                {radius} mi
              </span>
              {!userLoc && (
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  waiting for location…
                </span>
              )}
            </div>
          )}

          {/* user menu */}
          <div className="hp-user">
            <button
              ref={userBtnRef}
              className="hp-profile-btn"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              title="Account"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
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
                    <button className="hp-user-item" role="menuitem" onClick={goAccount}>
                      My account
                    </button>
                    <button className="hp-user-item danger" role="menuitem" onClick={doSignOut}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <button className="hp-user-item" role="menuitem" onClick={goSignIn}>
                      Sign in
                    </button>
                    <button className="hp-user-item primary" role="menuitem" onClick={goSignUp}>
                      Create account
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        <section className="hp-section">
          <h2 className="hp-h2" style={{ marginTop: 12 }}>Featured</h2>

          {loading && (
            <div className="hp-grid">
              {Array.from({ length: 6 }).map((_, i) => (
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
            <div className="hp-info">
              {filter === "nearby"
                ? "No auctions within your selected radius."
                : "No auctions match your filters."}
            </div>
          )}

          {!loading && !error && display.length > 0 && (
            <div className="hp-grid">
              {display.map((a) => {
                // Adapt data for BidAuctionCard
                const adapted = {
                  id: a.id,
                  title: a.title,
                  // BidAuctionCard fetches its own thumbnail & status
                  starting_price: a.starting_price ?? a.currentBid ?? 0,
                  reserve_price: a.reserve_price ?? 0,
                  end_time: a.end_time
                    ? a.end_time
                    : a.endsAt
                    ? new Date(a.endsAt).toISOString()
                    : null,
                  status: a.status ?? "active",
                  location: a.location ?? "", // expected ZIP for nearby filter
                };
                return (
                  <BidAuctionCard
                    key={a.id}
                    auction={adapted}
                    profileId={session?.user?.id || null}
                    onClick={() => nav(`/auction/${a.id}`)}
                  />
                );
              })}
            </div>
          )}
        </section>

        <button
          className="hp-fab"
          onClick={() => nav("/sell")}
          aria-label="Create auction"
          title="Create auction"
        >
          <span className="hp-fab-plus">+</span>
          <span className="hp-fab-label">Sell</span>
        </button>
      </div>
    </div>
  );
}

/* Custom dropdown (Filter/Sort) */
function Dropdown({ label, value, onChange, options }) {
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
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
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
        onKeyDown={onKeyDown}
      >
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
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* utilities (unused here but kept for parity with other views) */
function formatMoney(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n ?? 0);
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
