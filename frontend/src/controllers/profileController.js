import supabase from "../lib/supabaseClient";

export async function getProfileById(userId) {
    const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

    if (error) {
        console.error(error.message);
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
    const filePath = `${safeFileName}`;

    console.log("file:", filePath);

    const { error: uploadError } = await supabase.storage
        .from("profile_pics")
        .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("profile_pics").getPublicUrl(filePath);

    return data.publicUrl;
}

export async function getAuctionInfo(userId) {
    const { data, error } = await supabase
    .from("auctions")
    .select("*")
    .eq("seller_id", userId);

    if (error) {
        console.error(error.message);
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
        console.error("Error fetching auctions user has bid on:", error.message);
    }
    // remove duplicates if bidder has bid multiple times on a post (hashmap)
    const unique = {};
    for (const row of data) {
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
    .single();

    if (error) {
        console.error("Error fetching current bid:", error.message);
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
    .single();

    if (error) {
        console.error("failed to retrieve status", error.message);
        return null;
    }
    return data.status;
}

export async function raiseBid(auctionId, amount, profileId) {
    const numericAmount = parseFloat(amount);

    if (isNaN(numericAmount)) {
        console.error("Invalid Bid amount");
    }

    const { error } = await supabase
    .from("bids")
    .insert([
        {
        auction_id: auctionId,
        bid_amount: numericAmount,
        bidder_id: profileId,
        }
    ]);

    if (error) {
        console.error("failed to insert new bid:", error.message);
    }
}

export async function getThumbnailUrl(auctionId) {
    const { data, error } = await supabase
    .from("images")
    .select("url")
    .eq("auction_id", auctionId)
    .single();

    if (error) {
        console.error("Failed to get thumbnail url:", error.message);
        return null;
    }
    return data?.url ?? null;
}

export async function getBidder(userId) {
    const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

    if (error) {
        console.error("Failed to fetch bidder:", error.message);
        return;
    }
    return data?.username ?? "Unknown";
}

export async function sellAuction(userId) {
    const { data, error} = await supabase
    .from("auctions")
    .update({status: "ended"})
    .eq("id", userId);

    if (error) {
        console.error("Failed to upload status", error.message);
    }
}

export async function createTransaction(auctionId, bidderId, profileId, currentBid) {
    const { error } = await supabase
    .from("transactions")
    .insert([
        {
            auction_id: auctionId,
            buyer_id: bidderId,
            seller_id: profileId,
            final_price: currentBid,
            paid: "False",
        }
    ]);

    if (error) {
        console.error("Failed to upload transaction:", error.message);
    }
}

export async function getIncomingPay(profileId) {
    const { data, error } = await supabase
    .from("transactions")
    .select(`id, 
        final_price, 
        paid, created_at, 
        buyer:buyer_id(username), 
        auctions(title)
    `)
    .eq("seller_id", profileId)
    .order('created_at', { ascending: false });

    if (error) {
        console.error("Failed to get incoming payments:", error.message);
    }
    return data;
}

export async function getOutgoingPay(profileId) {
    const { data, error } = await supabase
    .from("transactions")
    .select(`id, 
        final_price, 
        paid, created_at, 
        seller:profiles!seller_id(username, stripe_account_id), 
        auctions(title)
    `)
    .eq("buyer_id", profileId)
    .order('created_at', { ascending: false });

    if (error) {
        console.error("Failed to get outgoing payments:", error.message);
    }
    return data;
}

export async function updateStatus(checkoutId) {
    const { error } = await supabase
    .from("transactions")
    .update({ paid: true })
    .eq("stripe_payment_id", checkoutId);

    if (error) {
        console.error("Failed to update status:", error.message);
    }
}

export async function updateSeshId(sessionId, transactionId) {
    console.log("Updating transaction in DB:", transactionId, "with session ID:", sessionId);
    const { data, error } = await supabase
    .from("transactions")
    .update({ stripe_payment_id: sessionId})
    .eq("id", transactionId)
    .select();

    console.log("Supabase update result:", data);
    if (error) {
        console.error("Failed to update stripe id:", error.message);
    }
}

export async function setStripeId(accountId, profileId) {
    const { error } = await supabase
    .from("profiles")
    .update({ stripe_account_id: accountId})
    .eq("id", profileId);

    if (error) {
        console.error("Failed to set stripe id:", error.message);
    }
}

export async function getCheckoutIds(profileId) {
    const { data, error } = await supabase
      .from("transactions")
      .select("stripe_payment_id")
      .eq("buyer_id", profileId)
      .not("stripe_payment_id", "is", null);
  
    if (error) throw error;
  
    return data.map((row) => row.stripe_payment_id);
  }