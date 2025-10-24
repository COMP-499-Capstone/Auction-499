// src/controllers/watchController.js
import supabase from "../lib/supabaseClient";

/** Exact watch count for an auction (cheap HEAD count). */
export async function getWatchCount(auctionId) {
  const { error, count } = await supabase
    .from("watches")
    .select("id", { head: true, count: "exact" })
    .eq("auction_id", auctionId);
  if (error) throw error;
  return count ?? 0;
}

/** Is this user watching this auction? */
export async function isUserWatching(auctionId, userId) {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("watches")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error; // ignore "not found"
  return !!data;
}

/** Toggle watch on/off. Returns the new state (true = watching). */
export async function toggleWatch(auctionId, userId) {
  if (!userId) throw new Error("Sign in to watch auctions.");

  const currentlyWatching = await isUserWatching(auctionId, userId);
  if (currentlyWatching) {
    const { error } = await supabase
      .from("watches")
      .delete()
      .eq("auction_id", auctionId)
      .eq("user_id", userId);
    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase
      .from("watches")
      .insert([{ auction_id: auctionId, user_id: userId }]);
    if (error) throw error;
    return true;
  }
}

/** Subscribe to realtime changes for an auction's watch rows. */
export function subscribeWatchCount(auctionId, cb) {
  const channel = supabase
    .channel(`watches-${auctionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "watches", filter: `auction_id=eq.${auctionId}` },
      cb
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/** List auctions a user is watching (with first image). */
export async function getWatchedAuctions(userId) {
  if (!userId) return [];

  // 1) watched auction ids
  const { data: watchRows, error: wErr } = await supabase
    .from("watches")
    .select("auction_id")
    .eq("user_id", userId);

  if (wErr) {
    console.error("getWatchedAuctions (watches) ->", wErr.message);
    return [];
  }
  const ids = (watchRows || []).map((r) => r.auction_id);
  if (!ids.length) return [];

  // 2) auctions
  const { data: auctions, error: aErr } = await supabase
    .from("auctions")
    .select(
      "id, title, description, auction_type, starting_price, reserve_price, end_time, status, location"
    )
    .in("id", ids);

  if (aErr) {
    console.error("getWatchedAuctions (auctions) ->", aErr.message);
    return [];
  }

  // 3) first image per auction
  const { data: imgs, error: iErr } = await supabase
    .from("images")
    .select("auction_id, url, uploaded_at")
    .in("auction_id", ids)
    .order("uploaded_at", { ascending: true });

  if (iErr) console.error("getWatchedAuctions (images) ->", iErr.message);

  const firstImageByAuction = new Map();
  (imgs || []).forEach((r) => {
    if (!firstImageByAuction.has(r.auction_id)) {
      firstImageByAuction.set(r.auction_id, r.url || "");
    }
  });

  // 4) shape for BidAuctionCard
  return auctions.map((a) => ({
    id: a.id,
    title: a.title,
    starting_price: Number(a.starting_price ?? 0),
    reserve_price: Number(a.reserve_price ?? 0),
    end_time: a.end_time || null,
    status: a.status || "active",
    location: a.location ?? "",
    thumbnail: firstImageByAuction.get(a.id) || "",
    watchers: undefined,
  }));
}
