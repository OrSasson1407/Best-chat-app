import React, { useState, useEffect } from "react";
import axios from "axios";
import styled from "styled-components";
import { useNavigate, Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { loginRoute, updateE2EKeysRoute } from "../utils/APIRoutes";
import { generateE2EBundle } from "../utils/crypto";

export default function Login() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toastOptions = {
    pauseOnHover: true,
    draggable: true,
  };

  // ✅ FIX: Check for the token, not the old user object, to prevent redirect loops
  useEffect(() => {
    if (sessionStorage.getItem("chat-app-token")) {
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
    if (!validateForm()) return;

    setIsSubmitting(true);
    const { username, password } = values;

    try {
      const { data } = await axios.post(loginRoute, { username, password });

      if (data.status === false) {
        toast.error(data.msg || "Invalid credentials. Please try again.", toastOptions);
        return;
      }

      if (data.status === true) {
        // ✅ FIX 1: Save access token separately so App.js request interceptor can read it
        sessionStorage.setItem("chat-app-token", data.token);

        // ✅ FIX 2: Save refresh token so App.js can silently renew expired access tokens
        //           (was never saved on login — caused logout every 15 min)
        sessionStorage.setItem("chat-app-refresh-token", data.refreshToken);

        // Save user object (also embed token for socket auth)
        const userData = { ...data.user, token: data.token };
        sessionStorage.setItem("chat-app-user", JSON.stringify(userData));

        // --- E2EE: generate device keys if this is a new device ---
        try {
          const existingKey = localStorage.getItem(`privateKey_${data.user._id}`);

          if (!existingKey) {
            console.log("[Crypto] No local keys found. Generating new E2E bundle for this device...");
            const { bundle, privateKeys } = await generateE2EBundle();

            localStorage.setItem(`privateKey_${data.user._id}`, JSON.stringify(privateKeys.identityPrivateKey));
            localStorage.setItem(`fullE2EKeys_${data.user._id}`, JSON.stringify(privateKeys));

            // Register new bundle with backend (token is now set, interceptor will attach it)
            await axios.post(updateE2EKeysRoute, {
              userId: data.user._id,
              e2eKeys: bundle,
            });
            console.log("[Crypto] Device keys successfully synced with server.");
          }
        } catch (cryptoErr) {
          console.error("[Crypto] Failed to generate or register E2EE keys:", cryptoErr);
          toast.error("Secure connection could not be fully established.", toastOptions);
        }

        toast.success(`Welcome back, ${data.user.username}!`, toastOptions);
        navigate("/");
      }
    } catch (error) {
      console.error("[API] Login request failed:", error);
      if (error.response?.data) {
        toast.error(error.response.data.msg || "Login failed. Please try again.", toastOptions);
      } else {
        toast.error("Check your internet connection and try again.", toastOptions);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <FormContainer>
        <form onSubmit={handleSubmit}>
          <div className="brand">
            <h1>snappy</h1>
          </div>
          <input
            type="text"
            placeholder="Username"
            name="username"
            onChange={handleChange}
            disabled={isSubmitting}
            min="3"
          />
          <input
            type="password"
            placeholder="Password"
            name="password"
            onChange={handleChange}
            disabled={isSubmitting}
          />
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in..." : "Log In"}
          </button>
          <span>
            Don't have an account? <Link to="/register">Create One.</Link>
          </span>
        </form>
      </FormContainer>

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
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
    transition: 0.3s;
    &:hover:not(:disabled) {
      background-color: #997af0;
    }
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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