import '../styles/AuthPage.css';
import '../App.css';
import React, { useState } from "react";
import supabase from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { SignUpInfo } from '../controllers/SignupDB';

export default function Signup() {
    const [formData, setFormData] = useState({email: "", password: "", username: "", role: ""});
    const [errorMsg, setErrorMsg] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const { data, error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password
        });
        if (error) {
            setErrorMsg(error.message);
        } else {
            const UserId = data.user.id;
            SignUpInfo(UserId, formData.username, formData.role);
            setErrorMsg('profile successfully created');
            navigate(`/homepage/${UserId}`);
        }
    };

    return (
    <>
    <div className="login-container">
            <form onSubmit={handleSubmit} className="login-form">
                <input name="email" placeholder='Email' value={formData.email} onChange={handleChange} required />
                <input name="password" type="password" value={formData.password} placeholder="Password" onChange={handleChange} required />
                <input name="username" value={formData.username} placeholder='enter a username' onChange={handleChange} required />
                <input name="role" value={formData.role} placeholder='enter role: buyer or seller' onChange={handleChange} required />

                {errorMsg && <p className="login-error"> {errorMsg} </p>}

                <button type="submit">Create Profile</button>
            </form>
    </div>
    </>
    );
}