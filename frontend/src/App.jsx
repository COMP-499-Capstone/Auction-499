import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import HomePage from "./views/HomePage";
import AuthPage from "./views/AuthPage";
import Signup from "./views/Signup";
import Profile from "./views/Profile";
import SellPage from "./views/SellPage";
import ListingPage from "./views/ListingPage";
import LiveLobby from "./views/LiveLobby";
import HostLive from "./views/HostLive";
import ViewerLive from "./views/ViewerLive";
import './App.css'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/account/:id" element={<AuthPage />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/sell" element={<SellPage />} />
        <Route path="/auction/:id" element={<ListingPage />} />
        <Route path="/homepage/:id" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/live" element={<LiveLobby />} />
        <Route path="/live/:roomName" element={<ViewerLive />} />
        <Route path="/host/:roomId" element={<HostLive />} />
        <Route path="/watch/:roomId" element={<ViewerLive />} />
      </Routes>
    </Router>
  );
}
