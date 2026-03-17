import React, { useState, useEffect } from "react";
import axios from "axios";
import styled from "styled-components";
import { useNavigate, Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// MERGE UPDATE: Swap to the new E2E Key Route and Generator
import { loginRoute, updateE2EKeysRoute } from "../utils/APIRoutes"; 
import { generateE2EBundle } from "../utils/crypto";

export default function Login() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: "", password: "" });
  
  // Removed position, autoClose, and theme from here since we define them globally in ToastContainer
  const toastOptions = {
    pauseOnHover: true,
    draggable: true,
  };

  useEffect(() => {
    if (sessionStorage.getItem("chat-app-user")) {
      navigate("/");
    }
  }, [navigate]);

  const handleChange = (event) => {
    setValues({ ...values, [event.target.name]: event.target.value });
  };

  const validateForm = () => {
    const { username, password } = values;
    if (username === "" || password === "") {
      toast.error("Please enter your username and password.", toastOptions);
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (validateForm()) {
      const { username, password } = values;
      try {
        const { data } = await axios.post(loginRoute, {
          username,
          password,
        }, {
          withCredentials: true 
        });

        if (data.status === false) {
          console.warn(`[Auth] Login rejected: ${data.msg}`);
          toast.error(data.msg || "Invalid credentials. Please try again.", toastOptions);
        }
        
        if (data.status === true) {
          const userData = {
            ...data.user,
            token: data.token,
          };
          sessionStorage.setItem("chat-app-user", JSON.stringify(userData));

          // --- MERGE UPDATE: UPDATED SIGNAL E2EE LOGIC ---
          try {
            const existingKey = localStorage.getItem(`privateKey_${data.user._id}`);
            
            if (!existingKey) {
              console.log("[Crypto] Local keys not found. Generating new E2E bundle for this device...");
              
              // FIX: Generate the full Signal-style bundle instead of just one key
              const { bundle, privateKeys } = await generateE2EBundle();
              
              localStorage.setItem(`privateKey_${data.user._id}`, JSON.stringify(privateKeys.identityPrivateKey));
              localStorage.setItem(`fullE2EKeys_${data.user._id}`, JSON.stringify(privateKeys));
              
              // Send the new bundle to the Backend
              await axios.post(updateE2EKeysRoute, {
                userId: data.user._id,
                e2eKeys: bundle
              }, {
                withCredentials: true 
              });
              console.log("[Crypto] Device keys successfully synced with server.");
            }
          } catch (cryptoErr) {
            console.error("[Crypto] Failed to generate or register E2EE keys", cryptoErr);
            // Softer error for the user
            toast.error("Secure connection could not be fully established.", toastOptions);
          }
          // --------------------------------

          toast.success(`Welcome back, ${data.user.username}!`, toastOptions);
          navigate("/");
        }
      } catch (error) {
        console.error("[API] Login request failed:", error);
        if (error.response && error.response.data) {
          toast.error(error.response.data.msg || "Login failed. Please try again.", toastOptions);
        } else {
          toast.error("Check your internet connection and try again.", toastOptions);
        }
      }
    }
  };

  return (
    <>
      <FormContainer>
        <form onSubmit={(event) => handleSubmit(event)}>
          <div className="brand">
            <h1>snappy</h1>
          </div>
          <input
            type="text"
            placeholder="Username"
            name="username"
            onChange={(e) => handleChange(e)}
            min="3"
          />
          <input
            type="password"
            placeholder="Password"
            name="password"
            onChange={(e) => handleChange(e)}
          />
          <button type="submit">Log In</button>
          <span>
            Don't have an account? <Link to="/register">Create One.</Link>
          </span>
        </form>
      </FormContainer>
      
      {/* PREMIUM IOS TOAST CONTAINER */}
      <ToastContainer 
          position="top-center" 
          autoClose={3000} 
          hideProgressBar={true} 
          newestOnTop={true} 
          closeOnClick 
          rtl={false} 
          pauseOnFocusLoss 
          draggable 
          pauseOnHover 
          theme="dark"
      />
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
  background-color: #131324;
  .brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
    h1 {
      color: white;
      text-transform: uppercase;
    }
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    background-color: #00000076;
    border-radius: 2rem;
    padding: 5rem;
  }
  input {
    background-color: transparent;
    padding: 1rem;
    border: 0.1rem solid #4e0eff;
    border-radius: 0.4rem;
    color: white;
    width: 100%;
    font-size: 1rem;
    &:focus {
      border: 0.1rem solid #997af0;
      outline: none;
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
    &:hover {
      background-color: #4e0eff;
    }
  }
  span {
    color: white;
    text-transform: uppercase;
    a {
      color: #4e0eff;
      text-decoration: none;
      font-weight: bold;
    }
  }
`;