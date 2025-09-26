import { useState, useEffect } from "react";
import supabase from "../lib/supabaseClient";
import { useParams } from "react-router-dom";
import heic2any from "heic2any";
import { UserCircle } from "lucide-react";
import { getProfileById, updateProfile, uploadAvatar, } from "../controllers/profileController";
import "../styles/Profile.css";

export default function Profile() {
    const [profile, setProfile] = useState({
        username:"",
        role: "",
        avatar_url: "",
    });
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const { id } = useParams();

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
                    <UserCircle size={100} color="#c7c7c7" />
                )}
                {isEditing && (
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} />
                )}
            </div>

            <div className="profile-info">
                <input
                type="text"
                value={profile.username}
                disabled={!isEditing}
                onChange={(e) =>
                    setProfile((prev) => ({ ...prev, username: e.target.value }))
                }
                />
                <input
                type="text"
                value={profile.role}
                disabled={!isEditing}
                onChange={(e) =>
                    setProfile((prev) => ({ ...prev, role: e.target.value }))
                }
                />

                {isEditing ? (
                    <button onClick={handleSave} disabled={loading}>
                        {loading ? "Saving..." : "Save"}
                    </button>
                ) : (
                    <button onClick={() => setIsEditing(true)}>Edit</button>
                )}
            </div>
        </div>
    );
}