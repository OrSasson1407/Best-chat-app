import React, { useState, useEffect } from "react";
import axios from "axios";
import styled from "styled-components";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { registerRoute } from "../utils/APIRoutes";
import { generateKeyPair } from "../utils/crypto";

export default function Register() {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "male"
  });

  const [avatars, setAvatars] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");

  const toastOptions = {
    position: "bottom-right",
    autoClose: 8000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };

  // Redirect if user is already logged in
  useEffect(() => {
    if (sessionStorage.getItem("chat-app-user")) {
      navigate("/");
    }
  }, [navigate]);

  // Generate random avatars based on selected gender
  useEffect(() => {
    const generateAvatars = () => {
      const collection = values.gender === "female" ? "lorelei" : "micah";
      const newAvatars = Array.from({ length: 4 }).map(() => {
        const randomSeed = Math.random().toString(36).substring(7);
        return `https://api.dicebear.com/9.x/${collection}/svg?seed=${randomSeed}`;
      });
      
      setAvatars(newAvatars);
      setSelectedAvatar(newAvatars[0]); 
    };
    generateAvatars();
  }, [values.gender]);

  const handleChange = (event) => {
    setValues({ ...values, [event.target.name]: event.target.value });
  };

  const handleValidation = () => {
    const { password, confirmPassword, username, email } = values;
    
    // Basic formatting regex for email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (password !== confirmPassword) {
      toast.error("Password and confirm password should be same.", toastOptions);
      return false;
    } else if (username.length < 3) {
      toast.error("Username should be greater than 3 characters.", toastOptions);
      return false;
    } else if (password.length < 8) {
      toast.error("Password should be equal or greater than 8 characters.", toastOptions);
      return false;
    } else if (email === "") {
      toast.error("Email is required.", toastOptions);
      return false;
    } else if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address.", toastOptions);
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (handleValidation()) {
      const { email, username, password, gender } = values;
      try {
        const { data } = await axios.post(registerRoute, {
          username,
          email,
          password,
          gender,
          avatarImage: selectedAvatar
        });

        if (data.status === false) {
          toast.error(data.msg, toastOptions);
        }
        if (data.status === true) {
          // Combined the user and token into a single object for storage
          const userData = {
            ...data.user,
            token: data.token,
          };
          sessionStorage.setItem("chat-app-user", JSON.stringify(userData));
          navigate("/");
        }
      } catch (error) {
        // FIXED: Catching the 400 error and displaying the server's error message
        if (error.response && error.response.data) {
          toast.error(error.response.data.msg || "Registration failed", toastOptions);
        } else {
          toast.error("Error connecting to server", toastOptions);
        }
      }
    }
  };

  return (
    <>
      <FormContainer>
        <form onSubmit={(event) => handleSubmit(event)}>
          <div className="brand">
            <h1>Snappy</h1>
          </div>
          <input type="text" placeholder="Username" name="username" onChange={(e) => handleChange(e)} />
          <input type="email" placeholder="Email" name="email" onChange={(e) => handleChange(e)} />
          
          <div className="gender-select">
            <label>Gender:</label>
            <select name="gender" value={values.gender} onChange={(e) => handleChange(e)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div className="avatar-section">
            <p>Select your Avatar:</p>
            <div className="avatars-list">
              {avatars.map((avatar, index) => (
                <div 
                  key={index} 
                  className={`avatar-option ${selectedAvatar === avatar ? "selected" : ""}`}
                  onClick={() => setSelectedAvatar(avatar)}
                >
                  <img src={avatar} alt={`avatar-${index}`} />
                </div>
              ))}
            </div>
          </div>

          <input type="password" placeholder="Password" name="password" onChange={(e) => handleChange(e)} />
          <input type="password" placeholder="Confirm Password" name="confirmPassword" onChange={(e) => handleChange(e)} />
          
          <button type="submit">Create User</button>
          <span>Already have an account? <Link to="/login">Login.</Link></span>
        </form>
      </FormContainer>
      <ToastContainer />
    </>
  );
}

const FormContainer = styled.div`
  height: 100vh; 
  width: 100vw; 
  display: flex; 
  flex-direction: column; 
  justify-content: center; 
  gap: 1rem; 
  align-items: center; 
  background-color: #050510;
  
  .brand { 
      display: flex; 
      align-items: center; 
      gap: 1rem; 
      justify-content: center; 
      h1 { color: white; text-transform: uppercase; } 
  }
  
  form { 
      display: flex; 
      flex-direction: column; 
      gap: 1.2rem; 
      background-color: #00000076; 
      border-radius: 2rem; 
      padding: 2.5rem 4rem; 
      border: 1px solid rgba(255, 255, 255, 0.1); 
      backdrop-filter: blur(10px); 
  }
  
  input, select { 
      background-color: transparent; 
      padding: 1rem; 
      border: 0.1rem solid #4e0eff; 
      border-radius: 0.4rem; 
      color: white; 
      width: 100%; 
      font-size: 1rem; 
      &:focus { border: 0.1rem solid #997af0; outline: none; } 
  }
  
  select { cursor: pointer; background-color: #0d0d30; }
  
  .gender-select { 
      display: flex; 
      align-items: center; 
      gap: 1rem; 
      color: white; 
      width: 100%; 
      label { font-weight: bold; } 
  }
  
  .avatar-section { 
      display: flex; 
      flex-direction: column; 
      gap: 0.5rem; 
      color: #ccc; 
      font-size: 0.9rem; 
      
      .avatars-list { 
          display: flex; 
          justify-content: space-between; 
          gap: 10px; 
          
          .avatar-option { 
              width: 60px; 
              height: 60px; 
              border-radius: 50%; 
              cursor: pointer; 
              border: 3px solid transparent; 
              transition: 0.3s; 
              background: #1a1a2e;
              
              img { 
                  width: 100%; 
                  height: 100%; 
                  border-radius: 50%; 
                  object-fit: cover; 
              } 
              
              &:hover { transform: scale(1.1); } 
          } 
          
          .selected { 
              border: 3px solid #00ff88; 
              box-shadow: 0 0 10px #00ff88; 
              transform: scale(1.1); 
          } 
      } 
  }
  
  button { 
      background-color: #4e0eff; 
      color: white; 
      padding: 1rem 2rem; 
      border: none; 
      font-weight: bold; 
      cursor: pointer; 
      border-radius: 0.4rem; 
      font-size: 1rem; 
      text-transform: uppercase; 
      &:hover { background-color: #4e0eff; } 
  }
  
  span { 
      color: white; 
      text-transform: uppercase; 
      a { color: #4e0eff; text-decoration: none; font-weight: bold; } 
  }
`;