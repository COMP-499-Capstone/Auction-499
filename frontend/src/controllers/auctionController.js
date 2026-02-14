// src/controllers/auctionController.js
import supabase from "../lib/supabaseClient";
import { getBidder, getThumbnailUrl } from "./profileController";

/**
 * Get a single auction with seller username + first image thumbnail.
 */
export async function getAuctionWithSeller(auctionId) {
  if (!auctionId) return null;

  const { data, error } = await supabase
    .from("auctions")
    .select("*, profiles(username)")
    .eq("id", auctionId)
    .maybeSingle();

  if (error) {
    console.error("getAuctionWithSeller:", error.message);
    return null;
  }
  if (!data) return null;

  // Reuse existing helper to get first image URL
  const thumbnail_url = await getThumbnailUrl(auctionId);

  return {
    ...data,
    seller: data.profiles?.username || "Unknown",
    thumbnail_url: thumbnail_url || null,
  };
}

/**
 * Get bid history for an auction, enriched with bidder usernames.
 */
export async function getBidHistoryWithUsernames(auctionId) {
  if (!auctionId) return [];

  const { data, error } = await supabase
    .from("bids")
    .select("bid_amount, bidder_id, created_at")
    .eq("auction_id", auctionId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getBidHistoryWithUsernames:", error.message);
    return [];
  }

  const rows = data || [];
  const enriched = await Promise.all(
    rows.map(async (b) => ({
      ...b,
      username: await getBidder(b.bidder_id),
    }))
  );

  return enriched;
}
