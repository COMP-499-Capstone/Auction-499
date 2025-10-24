import supabase from "../lib/supabaseClient";

export async function getProfileById(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getProfileById:", error.message);
    return null;
  }
  return data;
}

export async function updateProfile(profile, userId) {
  const { error } = await supabase
    .from("profiles")
    .update({
      username: profile.username,
      role: profile.role,
      avatar_url: profile.avatar_url,
    })
    .eq("id", userId);

  if (error) throw error;
}

export async function uploadAvatar(userId, file) {
  if (!file) throw new Error("No file provided");

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}_${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("profile_pics")
    .upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("profile_pics").getPublicUrl(path);
  return data.publicUrl;
}

export async function getAuctionInfo(userId) {
  const { data, error } = await supabase
    .from("auctions")
    .select("*")
    .eq("seller_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAuctionInfo:", error.message);
    return [];
  }
  return data;
}

export async function getBidPostInfo(userId) {
  const { data, error } = await supabase
    .from("bids")
    .select(`auction:auction_id(*)`)
    .eq("bidder_id", userId);

  if (error) {
    console.error("getBidPostInfo:", error.message);
    return [];
  }

  // de-dup auctions when the same user bid multiple times
  const unique = {};
  for (const row of data || []) {
    unique[row.auction.id] = row.auction;
  }
  return Object.values(unique);
}

export async function getCurrentBidWithUser(auctionId) {
  const { data, error } = await supabase
    .from("bids")
    .select("bid_amount, bidder_id, profiles(username)")
    .eq("auction_id", auctionId)
    .order("bid_amount", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("getCurrentBidWithUser:", error.message);
    return null;
  }

  return data
    ? {
        amount: data.bid_amount,
        username: data.profiles?.username ?? "Unknown",
        id: data.bidder_id,
      }
    : null;
}

export async function getStatus(auctionId) {
  const { data, error } = await supabase
    .from("auctions")
    .select("status")
    .eq("id", auctionId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("getStatus:", error.message);
    return null;
  }
  return data?.status ?? null;
}

export async function raiseBid(auctionId, amount, profileId) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    console.error("raiseBid: invalid amount");
    return;
  }

  const { error } = await supabase.from("bids").insert([
    {
      auction_id: auctionId,
      bid_amount: numericAmount,
      bidder_id: profileId,
    },
  ]);

  if (error) {
    console.error("raiseBid:", error.message);
  }
}

export async function getThumbnailUrl(auctionId) {
  const { data, error } = await supabase
    .from("images")
    .select("url, uploaded_at")
    .eq("auction_id", auctionId)
    .order("uploaded_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("getThumbnailUrl:", error.message);
    return null;
  }
  return data?.url ?? null;
}

export async function getBidder(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("getBidder:", error.message);
    return;
  }
  return data?.username ?? "Unknown";
}

export async function sellAuction(auctionId) {
  const { error } = await supabase
    .from("auctions")
    .update({ status: "ended" })
    .eq("id", auctionId);

  if (error) {
    console.error("sellAuction:", error.message);
  }
}

export async function createTransaction(auctionId, bidderId, profileId, currentBid) {
  const numeric = Number(currentBid);
  const { error } = await supabase.from("transactions").insert([
    {
      auction_id: auctionId,
      buyer_id: bidderId,
      seller_id: profileId,
      final_price: Number.isFinite(numeric) ? numeric : 0,
      paid: false, // boolean, not string
    },
  ]);

  if (error) {
    console.error("createTransaction:", error.message);
  }
}

export async function getIncomingPay(profileId) {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      `id,
       final_price,
       paid,
       created_at,
       buyer:buyer_id(username),
       auctions(title)`
    )
    .eq("seller_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getIncomingPay:", error.message);
  }
  return data;
}

export async function getOutgoingPay(profileId) {
  const { data, error } = await supabase
    .from("transactions")
    .select(
      `id,
       final_price,
       paid,
       created_at,
       seller:profiles!seller_id(username, stripe_account_id),
       auctions(title)`
    )
    .eq("buyer_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getOutgoingPay:", error.message);
  }
  return data;
}

export async function updateStatus(checkoutId) {
  const { error } = await supabase
    .from("transactions")
    .update({ paid: true })
    .eq("stripe_payment_id", checkoutId);

  if (error) {
    console.error("updateStatus:", error.message);
  }
}

export async function updateSeshId(sessionId, transactionId) {
  const { error } = await supabase
    .from("transactions")
    .update({ stripe_payment_id: sessionId })
    .eq("id", transactionId);

  if (error) {
    console.error("updateSeshId:", error.message);
  }
}

export async function setStripeId(accountId, profileId) {
  const { error } = await supabase
    .from("profiles")
    .update({ stripe_account_id: accountId })
    .eq("id", profileId);

  if (error) {
    console.error("setStripeId:", error.message);
  }
}

export async function getCheckoutIds(profileId) {
  const { data, error } = await supabase
    .from("transactions")
    .select("stripe_payment_id")
    .eq("buyer_id", profileId)
    .not("stripe_payment_id", "is", null);

  if (error) throw error;
  return (data || []).map((row) => row.stripe_payment_id);
}

/** Patch fields on an auction row. Only pass fields you want to change. */
export async function updateAuction(auctionId, patch) {
  // Guard
  if (!auctionId || !patch || typeof patch !== "object") {
    throw new Error("updateAuction: invalid arguments");
  }

  const { data, error } = await supabase
    .from("auctions")
    .update(patch)
    .eq("id", auctionId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("updateAuction:", error.message);
    throw error;
  }
  return data;
}

/** Delete an auction and its dependents (bids, images, livestreams, transactions, watches). */
export async function deleteAuction(auctionId) {
  if (!auctionId) throw new Error("deleteAuction: auctionId required");

  // Delete dependents first (no ON DELETE CASCADE in schema)
  // Ignore missing tables gracefully (e.g., watches).
  const tasks = [
    supabase.from("images").delete().eq("auction_id", auctionId),
    supabase.from("bids").delete().eq("auction_id", auctionId),
    supabase.from("livestreams").delete().eq("auction_id", auctionId),
    supabase.from("transactions").delete().eq("auction_id", auctionId),
  ];

  // Optional: watches table (used elsewhere in your code)
  try {
    tasks.push(supabase.from("watches").delete().eq("auction_id", auctionId));
  } catch (_) {
    /* ignore if table doesn't exist */
  }

  for (const p of tasks) {
    const { error } = await p;
    if (error && error.code !== "PGRST116") {
      // 'not found' is fine; anything else bubbles
      console.error("deleteAuction (child) ->", error.message);
      throw error;
    }
  }

  // Finally delete the auction
  const { error: aErr } = await supabase.from("auctions").delete().eq("id", auctionId);
  if (aErr) {
    console.error("deleteAuction (auction) ->", aErr.message);
    throw aErr;
  }
}