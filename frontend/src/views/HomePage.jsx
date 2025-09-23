import { useNavigate, useParams } from 'react-router-dom';
import { CircleUserRound } from "lucide-react";
import "../styles/HomePage.css";

export default function HomePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    return (
        <button className="profile-icon" onClick={() => navigate(`/HomePage/Profile/${id}`)}>
            <CircleUserRound className="User"/>
        </button>
    );
}