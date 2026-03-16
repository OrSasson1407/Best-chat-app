import React, { useState, useEffect } from "react";
import axios from "axios";
import styled from "styled-components";
import { useNavigate, Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// MERGE UPDATE: Make sure publicKeyRoute is imported
import { loginRoute, publicKeyRoute } from "../utils/APIRoutes"; 
import { generateKeyPair } from "../utils/crypto";

export default function Login() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ username: "", password: "" });
  const toastOptions = {
    position: "bottom-right",
    autoClose: 8000,
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
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
      toast.error("Username and Password are required.", toastOptions);
      return false;
    }
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (validateForm()) {
      const { username, password } = values;
      try {
        // STEP 4 FIX: Added withCredentials to allow the browser to store secure HttpOnly cookies
        const { data } = await axios.post(loginRoute, {
          username,
          password,
        }, {
          withCredentials: true 
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

          // --- MERGE UPDATE: E2EE LOGIC ---
          try {
            // FIX: Check if the private key already exists for this user to prevent overwriting
            const existingKey = localStorage.getItem(`privateKey_${data.user._id}`);
            
            if (!existingKey) {
              // Generate Keys ONLY if they don't already exist on this device
              const keys = await generateKeyPair();
              
              // Save Private Key locally (NEVER send this to the server)
              localStorage.setItem(`privateKey_${data.user._id}`, JSON.stringify(keys.privateKey));
              
              // Send Public Key to the Backend for other users to encrypt messages for this user
              await axios.post(publicKeyRoute, {
                userId: data.user._id,
                publicKey: JSON.stringify(keys.publicKey)
              }, {
                withCredentials: true // Ensure the session cookie is passed during key registration
              });
            }
          } catch (cryptoErr) {
            console.error("Failed to generate or register E2EE keys", cryptoErr);
            toast.error("Warning: Encryption keys could not be established.", toastOptions);
          }
          // --------------------------------

          navigate("/");
        }
      } catch (error) {
        if (error.response && error.response.data) {
          toast.error(error.response.data.msg, toastOptions);
        } else {
          toast.error("Error logging in", toastOptions);
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