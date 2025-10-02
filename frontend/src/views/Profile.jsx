import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import { useParams } from "react-router-dom";
import heic2any from "heic2any";
import { UserCircle, Grid3x3, CircleDollarSign, Gavel } from "lucide-react";
import ProfileAuctionCard from "./ProfileAuctionCard";
import { getProfileById, updateProfile, uploadAvatar, getAuctionInfo } from "../controllers/profileController";
import  ToggleGroup from "./ToggleGroup";
import "../styles/Profile.css";

export default function Profile() {
    const [profile, setProfile] = useState({
        username:"",
        role: "",
        avatar_url: "",
    });
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [auctionInfo, setAuctionInfo] = useState([]);
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
                });
            }
        })
        .catch((err) => console.error("Fetch profile error:", err))
        .finally(() => setLoading(false));

        return () => {
            isMounted = false;
        };
    }, [id]);

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
                onClick={() => navigate(`/auction/${data.id}`)}
                />
            ))}
        </div>
        )}

        {view === "transactions" && (
        <div className="placeholder">
            <p>💵 transactions will show here </p>
        </div>
        )}

        {view === "bids" && (
        <div className="placeholder">
            <p>⚖️ bids on other auctions will show here</p>
        </div>
        )}
        </div>
    </div>
    );
}