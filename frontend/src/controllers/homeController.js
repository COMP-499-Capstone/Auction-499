// src/controllers/homeController.js
import supabase from "../lib/supabaseClient";

/**
 * Fetch auctions for the home page, plus first image, seller username,
 * and watch counts.
 */
export async function fetchFeaturedAuctions(opts = {}) {
  const { query = "", sort = "endingSoon", limit = 24 } = opts;

  // 1) Base auctions (active or upcoming, not already ended)
  let aq = supabase
    .from("auctions")
    .select(
      "id, title, description, auction_type, starting_price, reserve_price, start_time, end_time, status, seller_id, location"
    )
    .in("status", ["active", "upcoming"])
    .gte("end_time", new Date().toISOString())
    .limit(limit);

  // Basic search (title / description / location)
  if (query.trim()) {
    const term = `%${query.trim()}%`;
    aq = aq.or(`title.ilike.${term},description.ilike.${term},location.ilike.${term}`);
  }

  // Sorting
  if (sort === "endingSoon") aq = aq.order("end_time", { ascending: true });
  if (sort === "highest") aq = aq.order("starting_price", { ascending: false });
  if (sort === "lowest") aq = aq.order("starting_price", { ascending: true });

  const { data: auctions, error: aErr } = await aq;
  if (aErr) {
    console.error("fetchFeaturedAuctions (auctions) ->", aErr.message);
    return [];
  }
  if (!auctions?.length) return [];

  // Collect IDs to enrich
  const auctionIds = auctions.map((a) => a.id);
  const sellerIds = [...new Set(auctions.map((a) => a.seller_id))];

  // 2) Thumbnails (first image per auction)
  const { data: imgs, error: iErr } = await supabase
    .from("images")
    .select("auction_id, url")
    .in("auction_id", auctionIds);

  if (iErr) console.error("fetchFeaturedAuctions (images) ->", iErr.message);

  const firstImageByAuction = new Map();
  (imgs || []).forEach((row) => {
    if (!firstImageByAuction.has(row.auction_id)) {
      firstImageByAuction.set(row.auction_id, row.url || "");
    }
  });

  // 3) Seller usernames
  const { data: profs, error: pErr } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", sellerIds);

  if (pErr) console.error("fetchFeaturedAuctions (profiles) ->", pErr.message);

  const usernameById = new Map((profs || []).map((p) => [p.id, p.username || "Unknown"]));

  // 4) Watch counts (aggregate in JS)
  let watchCountByAuction = new Map();
  try {
    const { data: watchRows, error: wErr } = await supabase
      .from("watches")
      .select("auction_id")
      .in("auction_id", auctionIds);

    if (wErr) {
      console.error("fetchFeaturedAuctions (watches) ->", wErr.message);
    } else {
      watchCountByAuction = watchRows.reduce((map, r) => {
        map.set(r.auction_id, (map.get(r.auction_id) || 0) + 1);
        return map;
      }, new Map());
    }
  } catch (e) {
    console.error("fetchFeaturedAuctions (watches aggregate) ->", e.message);
  }

  // 5) Final shape for the UI
  return auctions.map((r) => ({
    id: r.id,
    title: r.title,
    auctionType: r.auction_type ?? "standard",
    currentBid: Number(r.starting_price ?? 0),
    watchers: watchCountByAuction.get(r.id) || 0, // ✅ real count now
    location: r.location ?? "",
    seller: usernameById.get(r.seller_id) ?? "Unknown",
    thumbnail: firstImageByAuction.get(r.id) || "",
    endsAt: r.end_time ? new Date(r.end_time).getTime() : Date.now(),
    reserve_price: r.reserve_price ?? 0,
    starting_price: r.starting_price ?? 0,
  }));
}

/** Get a username for the session banner / menus. */
export async function fetchUsername(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("fetchUsername ->", error.message);
    return null;
  }
  return data?.username ?? null;
}
