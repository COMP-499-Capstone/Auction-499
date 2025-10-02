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

export async function getCurrentBidWithUser(auctionId) {
    const { data, error } = await supabase
    .from("bids")
    .select("bid_amount, profiles(username)")
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
    }
    : null;
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