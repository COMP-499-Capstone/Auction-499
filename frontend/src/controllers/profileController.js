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