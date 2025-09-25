import React, {useState} from "react";
import supabase from "../lib/supabaseClient";
import {useNavigate} from "react-router-dom";
//import heic2any from "heic2any";
import "../styles/AuthPage.css";
import "../App.css";
// this page is for authentication
export default function AuthPage() {
  const [formData, setFormData] = useState({email: "", password: ""});
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const {name, value} = e.target;
    setFormData((prev) => ({...prev, [name]: value}));
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    const {data, error} = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });
    if (error) {
      setErrorMsg(error.message);
    } else {
      const userId = data.user.id;
      navigate(`/homepage/${userId}`);
    }
  };

  return (
    <>
      <div className="app-container">
        <h1 className="auth-title">Auction</h1>{" "}
      </div>
      <div className="login-container">
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          {errorMsg && <p className="login-error"> {errorMsg} </p>}

          <button type="submit">Login</button>

          <button className="signup" onClick={() => navigate("/Signup")}>
            {" "}
            Signup{" "}
          </button>
        </form>
      </div>
    </>
  );
}
