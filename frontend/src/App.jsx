import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AuthPage from "./views/AuthPage";
import Signup from "./views/Signup";
import HomePage from "./views/HomePage";
import Profile from "./views/Profile";
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/Signup" element={<Signup />} />
        <Route path="/HomePage/:id" element={<HomePage />} />
        <Route path="/HomePage/Profile/:id" element={<Profile />} />
      </Routes>
    </Router>
  );
}

export default App
