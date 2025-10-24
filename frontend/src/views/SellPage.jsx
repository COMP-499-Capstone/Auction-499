// src/views/SellPage.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";

export default function SellPage() {
  const nav = useNavigate();
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data?.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess ?? null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Prefill end_time to +7 days (in local datetime-local format)
  const sevenDaysFromNowLocal = () => {
    const dt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };

  const [form, setForm] = useState({
    title: "",
    description: "",
    auction_type: "standard", // 'standard' | 'livestream'
    starting_price: "",
    reserve_price: "",
    end_time: "", // set in effect below
    location: "", // ZIP or "City, ST"
    image_url: "",
  });

  useEffect(() => {
    setForm((f) => (f.end_time ? f : { ...f, end_time: sevenDaysFromNowLocal() }));
  }, []);

  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState("");
  const [uploading, setUploading] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Ensure the FK target (profiles.id) exists for this user
  async function ensureProfile(user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      const username =
        user.user_metadata?.username ||
        user.email?.split("@")[0] ||
        `user_${user.id.slice(0, 6)}`;

      const { error: insertErr } = await supabase
        .from("profiles")
        .insert([{ id: user.id, username, role: "user" }]);
      if (insertErr) throw insertErr;
    }
  }

  // Upload image to Supabase Storage and return public URL
  async function uploadAuctionImage(userId, fileObj) {
    if (!fileObj) return null;
    setUploading(true);
    try {
      const safeName = fileObj.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ts = Date.now();
      const path = `${userId}/${ts}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("auction_pics")
        .upload(path, fileObj, { cacheControl: "3600", upsert: false, contentType: fileObj.type });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("auction_pics").getPublicUrl(path);
      return pub?.publicUrl ?? null;
    } finally {
      setUploading(false);
    }
  }

  const onFileChange = (e) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setFilePreview(f ? URL.createObjectURL(f) : "");
  };

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!session?.user?.id) {
      alert("Please sign in first.");
      nav("/auth");
      return;
    }

    // Basic validation
    if (!form.title.trim()) return alert("Title is required.");
    const startPrice = Number(form.starting_price);
    if (!Number.isFinite(startPrice)) return alert("Starting price is required.");
    if (!form.end_time) return alert("End time is required.");

    // Validate end time (must be in the future)
    const localEnd = new Date(form.end_time);
    if (Number.isNaN(localEnd.getTime())) {
      alert("Please pick a valid end date/time.");
      return;
    }
    if (localEnd <= new Date()) {
      alert("End time must be in the future.");
      return;
    }

    const startIso = new Date().toISOString();
    const endIso = localEnd.toISOString();
    const reserve =
      form.reserve_price === "" || form.reserve_price === null
        ? null
        : Number(form.reserve_price);

    try {
      // Ensure FK to profiles
      await ensureProfile(session.user);

      // Prepare image
      let finalImageUrl = null;
      if (file) {
        finalImageUrl = await uploadAuctionImage(session.user.id, file);
      } else if (form.image_url.trim()) {
        finalImageUrl = form.image_url.trim();
      }

      // Store location exactly as entered (ZIP or "City, ST")
      const cleanLocation = form.location.trim();

      // Insert into auctions
      const basePayload = {
        title: form.title.trim(),
        description: form.description || null,
        auction_type: form.auction_type,
        starting_price: Number.isFinite(startPrice) ? startPrice : 0,
        reserve_price: reserve,
        start_time: startIso,
        end_time: endIso,
        status: "active",
        seller_id: session.user.id,
      };

      const auctionPayload = cleanLocation
        ? { ...basePayload, location: cleanLocation }
        : basePayload;

      let { data: auction, error: aErr } = await supabase
        .from("auctions")
        .insert([auctionPayload])
        .select()
        .single();

      // If your DB still doesn't have a `location` column, retry without it.
      if (aErr && /location.*column/i.test(aErr.message || "")) {
        const { location, ...withoutLocation } = auctionPayload;
        const retry = await supabase.from("auctions").insert([withoutLocation]).select().single();
        auction = retry.data;
        aErr = retry.error;
      }
      if (aErr) throw aErr;

      // Optional image row
      if (finalImageUrl) {
        const { error: iErr } = await supabase
          .from("images")
          .insert([{ auction_id: auction.id, url: finalImageUrl }]);
        if (iErr) throw iErr;
      }

      nav(`/profile/${session.user.id}`);
    } catch (err) {
      console.error("Create auction failed:", err.message);
      alert("Failed to create auction: " + err.message);
    }
  };

  return (
    <div className="home-page" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <h1 className="hp-title">Create Auction</h1>

      <form
        onSubmit={onSubmit}
        className="hp-topbar"
        style={{
          flexDirection: "column",
          gap: 12,
          padding: 16,
          borderRadius: 14,
          background: "#fff",
          boxShadow: "0 8px 24px rgba(0,0,0,.06)",
        }}
      >
        {/* Title */}
        <input
          name="title"
          placeholder="Title"
          value={form.title}
          onChange={onChange}
          required
          className="hp-search-input"
        />

        {/* Description */}
        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={onChange}
          style={{ width: "100%", minHeight: 140, borderRadius: 10, padding: 12 }}
        />

        {/* Grid of fields */}
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            width: "100%",
          }}
        >
          {/* Type */}
          <select
            name="auction_type"
            value={form.auction_type}
            onChange={onChange}
            className="hp-dd-btn"
          >
            <option value="standard">Standard</option>
            <option value="livestream">Livestream</option>
          </select>

          {/* Starting price */}
          <input
            name="starting_price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Starting price"
            value={form.starting_price}
            onChange={onChange}
            className="hp-search-input"
            required
          />

          {/* Reserve price */}
          <input
            name="reserve_price"
            type="number"
            min="0"
            step="0.01"
            placeholder="Reserve price (optional)"
            value={form.reserve_price}
            onChange={onChange}
            className="hp-search-input"
          />

          {/* End time */}
          <input
            name="end_time"
            type="datetime-local"
            value={form.end_time}
            onChange={onChange}
            className="hp-search-input"
            required
          />

          {/* Location (ZIP or City, ST) */}
          <input
            name="location"
            placeholder="ZIP (e.g., 93060) or City, ST"
            value={form.location}
            onChange={onChange}
            className="hp-search-input"
          />

          {/* Manual Image URL (optional) */}
          <input
            name="image_url"
            placeholder="Image URL (optional)"
            value={form.image_url}
            onChange={onChange}
            className="hp-search-input"
          />
        </div>

        {/* File upload row */}
        <div
          style={{
            marginTop: 6,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label
              htmlFor="auction-file"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: "#f3f4f6",
                border: "1px solid #e5e7eb",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Upload image…
            </label>
            <input
              id="auction-file"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onFileChange}
            />
            {file && (
              <span style={{ fontSize: 13, color: "#374151" }}>
                {file.name} {uploading ? "• uploading…" : ""}
              </span>
            )}
          </div>

          {/* Preview */}
          {filePreview && (
            <div style={{ justifySelf: "end" }}>
              <img
                src={filePreview}
                alt="Preview"
                style={{
                  width: 120,
                  height: 80,
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button
            type="submit"
            className="hp-reset-btn"
            style={{
              fontWeight: 700,
              background: "#2563eb",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 16px",
            }}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Create"}
          </button>
          <button
            type="button"
            className="hp-reset-btn"
            onClick={() => nav("/")}
            style={{ borderRadius: 10, padding: "10px 16px" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
