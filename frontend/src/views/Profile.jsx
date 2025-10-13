import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import { useParams } from "react-router-dom";
import heic2any from "heic2any";
import { UserCircle, Grid3x3, CircleDollarSign, Gavel } from "lucide-react";
import ProfileAuctionCard from "./ProfileAuctionCard";
import TransactionsTable from "./TransactionsTable";
import BidAuctionCard from "./BidAuctionCard";
import { getProfileById, updateProfile, uploadAvatar, getAuctionInfo, getBidPostInfo, setStripeId } from "../controllers/profileController";
import  ToggleGroup from "./ToggleGroup";
import "../styles/Profile.css";

export default function Profile() {
    const [profile, setProfile] = useState({
        username:"",
        role: "",
        avatar_url: "",
        stripe_account_id: "",
    });
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [auctionInfo, setAuctionInfo] = useState([]);
    const [bidPosts, setBidPosts] = useState([]);
    const [view, setView] = useState("posts");
    const { id } = useParams();
    const navigate = useNavigate();

    // useEffect for profile data
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

    // creating stripe account used for transactions tab
    useEffect(() => {
        const createStripeAccount = async () => {
            try {
            if (profile.stripe_account_id) return;

            const user = await supabase.auth.getUser();
            console.log("email:", user.data.user.email);

            const res = await fetch("http://localhost:3000/stripe/create-connected-account", {
                method: "POST",
                headers:{ "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.data.user.email })
            });

            const data = await res.json();

            if (data.accountId) {
                setStripeId(data.accountId, id);
            }
        } catch (error) {
            console.error("Error creating Stripe account:", error.message);
        }
        };

        createStripeAccount();
    }, [profile]);

    /* useEffect for setting auction info, doesnt need interval 
    sell button is on homepage once landing back here it gets re rendered */
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

    // used for bids section, no interval assuming you need to go to homepage to bid
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

    // handlers for updates
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

    const handleAvatarUpload = async (e) => {
        let file = e.target.files[0];
        if(!file) return;

        if (file.type === "image/heic" || file.type === "image/heif") {
            try {
              const convertedBlob = await heic2any({
                blob: file,
                toType: "image/jpeg",
                quality: 0.9, // optional
              });
        
              // heic2any returns a Blob
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
        
              setProfile((prev) => ({
                ...prev,
                avatar_url: avatarUrl,
              }));
              updateProfile(profile, id);
            } catch (err) {
            console.error("Upload failed:", err.message);
            }
        }

    return (
    <div className="profile-shell">
        <div className="profile-page">
        <div className="profile-header">
            <div className="profile-pic">
                {profile.avatar_url ? (
                <img
                   src={profile.avatar_url}
                   alt="Profile"
                   width={100}
                   height={100}
                />
                ) : (
                    <UserCircle size={130} color="#c7c7c7" />
                )}
                {isEditing && (
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                )}
            </div>

            <div className="profile-info">
                <div className="profile-field">
                <label>UserName</label>
                <input
                type="text"
                value={profile.username}
                disabled={!isEditing}
                onChange={(e) =>
                    setProfile((prev) => ({ ...prev, username: e.target.value }))
                }
                />
                </div>

                <div className="profile-field">
                <label>Role</label>
                <input
                type="text"
                value={profile.role}
                disabled={!isEditing}
                onChange={(e) =>
                    setProfile((prev) => ({ ...prev, role: e.target.value }))
                }
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
                { icon: Gavel, value: "bids"},
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

        {view === "transactions" && (
            <TransactionsTable
            profileId={id}
            />
        )}

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
        </div>
    </div>
    );
}