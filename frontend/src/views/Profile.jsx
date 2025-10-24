// src/views/Profile.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import heic2any from "heic2any";
import { UserCircle, Grid3x3, CircleDollarSign, Gavel, Eye } from "lucide-react";
import ProfileAuctionCard from "./ProfileAuctionCard";
import TransactionsTable from "./TransactionsTable";
import BidAuctionCard from "./BidAuctionCard";
import {
  getProfileById,
  updateProfile,
  uploadAvatar,
  getAuctionInfo,
  getBidPostInfo,
  setStripeId,
} from "../controllers/profileController";
import { getWatchedAuctions } from "../controllers/watchController";
import ToggleGroup from "./ToggleGroup";
import "../styles/Profile.css";

export default function Profile() {
  const [profile, setProfile] = useState({
    username: "",
    role: "",
    avatar_url: "",
    stripe_account_id: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [auctionInfo, setAuctionInfo] = useState([]);
  const [bidPosts, setBidPosts] = useState([]);
  const [watching, setWatching] = useState([]); // auctions I’m watching

  const [view, setView] = useState("posts");
  const { id } = useParams();
  const navigate = useNavigate();

  // profile data
  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setLoading(true);
    getProfileById(id)
      .then((data) => {
        if (isMounted && data) {
          setProfile({
            username: data.username ?? "",
            role: data.role ?? "",
            avatar_url: data.avatar_url ?? "",
            stripe_account_id: data.stripe_account_id ?? "",
          });
        }
      })
      .catch((err) => console.error("Fetch profile error:", err))
      .finally(() => setLoading(false));
    return () => {
      isMounted = false;
    };
  }, [id]);

  // stripe account (unchanged)
  useEffect(() => {
    const createStripeAccount = async () => {
      try {
        if (profile.stripe_account_id) return;
        const user = await supabase.auth.getUser();

        const res = await fetch("http://localhost:3000/stripe/create-connected-account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.data.user.email }),
        });

        const data = await res.json();
        if (data.accountId) setStripeId(data.accountId, id);
      } catch (error) {
        console.error("Error creating Stripe account:", error.message);
      }
    };
    createStripeAccount();
  }, [profile, id]);

  // my auctions
  useEffect(() => {
    const fetchAuction = async () => {
      try {
        const data = await getAuctionInfo(id);
        setAuctionInfo(data);
      } catch (err) {
        console.error("failed to set auction data:", err.message);
      }
    };
    if (id) fetchAuction();
  }, [id]);

  // auctions I've bid on
  useEffect(() => {
    const bidAuction = async () => {
      try {
        const data = await getBidPostInfo(id);
        setBidPosts(data);
      } catch (err) {
        console.error("failed to get posts for bids:", err.message);
      }
    };
    if (id) bidAuction();
  }, [id]);

  // auctions I’m watching
  useEffect(() => {
    const loadWatching = async () => {
      try {
        const rows = await getWatchedAuctions(id);
        setWatching(rows);
      } catch (e) {
        console.error("failed to load watching:", e.message);
      }
    };
    if (id) loadWatching();
  }, [id]);

  // optimistic-remove this auction from the Watching grid immediately
  const handleUnwatch = (auctionId) => {
    setWatching((list) => list.filter((a) => a.id !== auctionId));
  };

  // if unwatch failed, put it back (avoid duplicates)
  const handleUnwatchRevert = (auctionObj) => {
    setWatching((list) => {
      if (list.some((a) => a.id === auctionObj.id)) return list;
      return [auctionObj, ...list];
    });
  };

  // save profile edits
  const handleSave = async () => {
    setLoading(true);
    try {
      await updateProfile(profile, id);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update profile:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // avatar upload (with HEIC conversion)
  const handleAvatarUpload = async (e) => {
    let file = e.target.files[0];
    if (!file) return;

    if (file.type === "image/heic" || file.type === "image/heif") {
      try {
        const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
        file = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
          type: "image/jpeg",
        });
      } catch (err) {
        console.error("HEIC conversion failed:", err);
        return;
      }
    }

    try {
      const avatarUrl = await uploadAvatar(id, file);
      setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
      updateProfile(profile, id);
    } catch (err) {
      console.error("Upload failed:", err.message);
    }
  };

  return (
    <div className="profile-shell">
      <div className="profile-page">
        <div className="profile-header">
          <div className="profile-pic">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" width={100} height={100} />
            ) : (
              <UserCircle size={130} color="#c7c7c7" />
            )}
            {isEditing && <input type="file" accept="image/*" onChange={handleAvatarUpload} />}
          </div>

          <div className="profile-info">
            <div className="profile-field">
              <label>UserName</label>
              <input
                type="text"
                value={profile.username}
                disabled={!isEditing}
                onChange={(e) => setProfile((prev) => ({ ...prev, username: e.target.value }))}
              />
            </div>

            <div className="profile-field">
              <label>Role</label>
              <input
                type="text"
                value={profile.role}
                disabled={!isEditing}
                onChange={(e) => setProfile((prev) => ({ ...prev, role: e.target.value }))}
              />
            </div>

            {isEditing ? (
              <button onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
            ) : (
              <button onClick={() => setIsEditing(true)}>Edit</button>
            )}
          </div>
        </div>

        <div className="toggle">
          <ToggleGroup
            options={[
              { icon: Grid3x3, value: "posts" },
              { icon: CircleDollarSign, value: "transactions" },
              { icon: Gavel, value: "bids" },
              { icon: Eye, value: "watching" }, // NEW EYE TAB
            ]}
            onChange={setView}
          />
        </div>

        {view === "posts" && (
          <div className="profile-grid">
            {auctionInfo.map((data) => (
              <ProfileAuctionCard
                key={data.id}
                auction={data}
                profileId={id}
                onClick={() => navigate(`/auction/${data.id}`)}
              />
            ))}
          </div>
        )}

        {view === "transactions" && <TransactionsTable profileId={id} />}

        {view === "bids" && (
          <div className="profile-grid">
            {bidPosts.map((data) => (
              <BidAuctionCard
                key={data.id}
                auction={data}
                profileId={id}
                onClick={() => navigate(`/auction/${data.id}`)}
              />
            ))}
          </div>
        )}

        {view === "watching" && (
          <div className="profile-grid">
            {watching.length === 0 ? (
              <div style={{ padding: 16, color: "#6b7280" }}>
                You aren’t watching anything yet.
              </div>
            ) : (
              watching.map((a) => (
                <BidAuctionCard
                  key={a.id}
                  auction={a}
                  profileId={id}
                  onClick={() => navigate(`/auction/${a.id}`)}
                  // pass handlers so unfollow removes immediately
                  onUnwatch={handleUnwatch}
                  onUnwatchRevert={handleUnwatchRevert}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
