// Home page data access (Supabase)
// Uses supabase client at: /src/lib/supabaseClient.js

import supabase from "../lib/supabaseClient";

/**
 * Fetch featured auctions with optional filters.
 * All filters are applied server-side (no placeholders).
 *
 * @param {Object} opts
 * @param {string} [opts.query]       - free text: title/location/seller_username
 * @param {"any"|"new"|"used"} [opts.condition]
 * @param {"endingSoon"|"highest"|"lowest"} [opts.sort]
 * @param {number} [opts.limit]       - default 24
 */
export async function fetchFeaturedAuctions(opts = {}) {
  const {query = "", condition = "any", sort = "endingSoon", limit = 24} = opts;

  let q = supabase
    .from("auctions")
    .select(
      `
      id,
      title,
      condition,
      current_bid,
      watchers,
      location,
      seller_username,
      thumbnail_url,
      ends_at
    `
    )
    .eq("is_featured", true)
    .limit(limit);

  // server-side filters
  if (query && query.trim()) {
    const term = `%${query.trim()}%`;
    q = q.or(
      `title.ilike.${term},location.ilike.${term},seller_username.ilike.${term}`
    );
  }

  if (condition !== "any") {
    q = q.eq("condition", condition);
  }

  if (sort === "endingSoon") q = q.order("ends_at", {ascending: true});
  if (sort === "highest") q = q.order("current_bid", {ascending: false});
  if (sort === "lowest") q = q.order("current_bid", {ascending: true});

  const {data, error} = await q;

  if (error) {
    console.error("fetchFeaturedAuctions error:", error.message);
    return [];
  }

  // map snake_case -> camelCase for the UI
  return (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    condition: r.condition, // "new" | "used"
    currentBid: r.current_bid ?? 0,
    watchers: r.watchers ?? 0,
    location: r.location ?? "",
    seller: r.seller_username ?? "",
    thumbnail: r.thumbnail_url ?? "",
    endsAt: r.ends_at ? new Date(r.ends_at).getTime() : Date.now(),
  }));
}

export async function fetchUsername(userId) {
  const { data, error } = await supabase
  .from("profiles")
  .select("username")
  .eq("id", userId)
  .single();

  if(error) {
    console.error(error);
    return null; 
  }
  return data?.username ?? null;
}
