import React, { useState, useEffect } from "react";
import axios from "axios";
import styled from "styled-components";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { registerRoute } from "../utils/APIRoutes";
import { generateE2EBundle } from "../utils/crypto";
import { FaEye, FaEyeSlash, FaSyncAlt, FaArrowRight, FaArrowLeft, FaCheck } from "react-icons/fa";

export default function Register() {
  const navigate = useNavigate();

  // WIZARD STATES
  const [step, setStep] = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    gender: "male",
  });

  const [avatars, setAvatars] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const toastOptions = {
    pauseOnHover: true,
    draggable: true,
    theme: "dark",
  };

  useEffect(() => {
    if (sessionStorage.getItem("chat-app-user")) {
      navigate("/");
    }
  }, [navigate]);

  const generateAvatars = () => {
    const collection = values.gender === "female" ? "lorelei" : "micah";
    const newAvatars = Array.from({ length: 4 }).map(() => {
      const randomSeed = Math.random().toString(36).substring(7);
      return `https://api.dicebear.com/9.x/${collection}/svg?seed=${randomSeed}`;
    });
    setAvatars(newAvatars);
    setSelectedAvatar(newAvatars[0]);
  };

  useEffect(() => {
    generateAvatars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.gender]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues({ ...values, [name]: value });

    if (name === "password") {
      let score = 0;
      if (value.length > 7) score += 25;
      if (value.length > 10) score += 25;
      if (/[A-Z]/.test(value)) score += 15;
      if (/[0-9]/.test(value)) score += 15;
      if (/[^A-Za-z0-9]/.test(value)) score += 20;
      setPasswordStrength(Math.min(100, score));
    }
  };

  const handleNextStep = () => {
    const { password, confirmPassword, username, email } = values;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (username.length < 3) {
      return toast.error("Username must be at least 3 characters.", toastOptions);
    } else if (email === "" || !emailRegex.test(email)) {
      return toast.error("Please enter a valid email address.", toastOptions);
    } else if (password.length < 8) {
      return toast.error("Password must be at least 8 characters.", toastOptions);
    } else if (password !== confirmPassword) {
      return toast.error("Passwords do not match.", toastOptions);
    }
    setStep(2);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!acceptedTerms) {
      return toast.warning("Please accept the Terms of Service to continue.", toastOptions);
    }

    setIsSubmitting(true);
    const { email, username, password, gender } = values;

    try {
      console.log("[Dev Log] Generating secure E2E keys for new user...");
      const { bundle, privateKeys } = await generateE2EBundle();
      console.log("[Dev Log] Keys generated. Sending to backend...");

      const { data } = await axios.post(registerRoute, {
        username,
        email,
        password,
        gender,
        avatarImage: selectedAvatar,
        e2eKeys: bundle,
      });

      if (data.status === false) {
        toast.error(data.msg, toastOptions);
        return;
      }

      if (data.status === true) {
        if (!data.token) {
          console.error("[Auth Error] Backend did not return an authentication token.");
          toast.error("Registration failed. Please try again later.", toastOptions);
          return;
        }

        // Save E2E private keys locally
        localStorage.setItem(`privateKey_${data.user._id}`, JSON.stringify(privateKeys.identityPrivateKey));
        localStorage.setItem(`fullE2EKeys_${data.user._id}`, JSON.stringify(privateKeys));

        // ✅ FIX: Save access token separately so App.js request interceptor can read it
        sessionStorage.setItem("chat-app-token", data.token);

        // ✅ FIX: Save refresh token so App.js can silently renew expired access tokens
        //         (was missing — caused logout every 15 min after registration too)
        sessionStorage.setItem("chat-app-refresh-token", data.refreshToken);

        // Save user object (also embed token for socket auth)
        const userData = { ...data.user, token: data.token };
        sessionStorage.setItem("chat-app-user", JSON.stringify(userData));

        toast.success("Welcome to Snappy!", toastOptions);
        navigate("/");
      }
    } catch (error) {
      console.error("Registration Request Failed:", error);
      if (error.response?.data) {
        toast.error(error.response.data.msg || "Registration failed. Please try again.", toastOptions);
      } else {
        toast.error("Check your internet connection and try again.", toastOptions);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength < 40) return "#ff4e4e";
    if (passwordStrength < 80) return "#f0ad4e";
    return "#00ff88";
  };

  return (
    <>
      <FormContainer>
        <form onSubmit={handleSubmit}>
          <div className="brand">
            <h1>Snappy</h1>
          </div>

          <div className="wizard-progress">
            <div className={`step-indicator ${step >= 1 ? "active" : ""}`}>1</div>
            <div className={`progress-line ${step === 2 ? "active" : ""}`}></div>
            <div className={`step-indicator ${step === 2 ? "active" : ""}`}>2</div>
          </div>
          <div className="wizard-labels">
            <span className={step >= 1 ? "active-text" : ""}>Account</span>
            <span className={step === 2 ? "active-text" : ""}>Profile</span>
          </div>

          {step === 1 && (
            <div className="form-step slide-in">
              <input type="text" placeholder="Username" name="username" value={values.username} onChange={handleChange} disabled={isSubmitting} />
              <input type="email" placeholder="Email" name="email" value={values.email} onChange={handleChange} disabled={isSubmitting} />

              <div className="input-wrapper">
                <input type={showPassword ? "text" : "password"} placeholder="Password" name="password" value={values.password} onChange={handleChange} disabled={isSubmitting} />
                <div className="icon-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </div>
              </div>

              {values.password.length > 0 && (
                <div className="strength-meter">
                  <div className="strength-bar" style={{ width: `${passwordStrength}%`, backgroundColor: getStrengthColor() }} />
                </div>
              )}

              <div className="input-wrapper">
                <input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm Password" name="confirmPassword" value={values.confirmPassword} onChange={handleChange} disabled={isSubmitting} />
                <div className="icon-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </div>
              </div>

              <button type="button" className="action-btn next-btn" onClick={handleNextStep}>
                Next Step <FaArrowRight />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="form-step slide-in">
              <div className="gender-select">
                <label>Gender:</label>
                <select name="gender" value={values.gender} onChange={handleChange} disabled={isSubmitting}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>

              <div className="avatar-section">
                <div className="avatar-header">
                  <p>Select your Avatar:</p>
                  <button type="button" className="shuffle-btn" onClick={generateAvatars} disabled={isSubmitting} title="Generate new avatars">
                    <FaSyncAlt /> Shuffle
                  </button>
                </div>

                <div className="avatars-list">
                  {avatars.map((avatar, index) => (
                    <div
                      key={index}
                      className={`avatar-option ${selectedAvatar === avatar ? "selected" : ""} ${isSubmitting ? "disabled" : ""}`}
                      onClick={() => !isSubmitting && setSelectedAvatar(avatar)}
                    >
                      <img src={avatar} alt={`avatar-${index}`} />
                      {selectedAvatar === avatar && (
                        <div className="check-badge">
                          <FaCheck size={10} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <label className="terms-checkbox">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span className="checkmark"></span>
                <p>I agree to the <Link to="/terms">Terms of Service</Link> and E2EE policy.</p>
              </label>

              <div className="button-group">
                <button type="button" className="action-btn back-btn" onClick={() => setStep(1)} disabled={isSubmitting}>
                  <FaArrowLeft /> Back
                </button>
                <button type="submit" className="action-btn submit-btn" disabled={isSubmitting || !acceptedTerms}>
                  {isSubmitting ? "Creating Keys..." : "Create Account"}
                </button>
              </div>
            </div>
          )}

          <span className="login-link">
            Already have an account? <Link to="/login">Login.</Link>
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
  background-color: #050510;
  
  .brand { 
      display: flex; align-items: center; gap: 1rem; justify-content: center; 
      h1 { color: white; text-transform: uppercase; margin: 0; font-size: 2rem;} 
  }
  
  form { 
      display: flex; flex-direction: column; gap: 1.2rem; 
      background-color: #00000076; border-radius: 2rem; 
      padding: 2.5rem 3.5rem; border: 1px solid rgba(255, 255, 255, 0.1); 
      backdrop-filter: blur(10px); width: 100%; max-width: 450px;
      overflow: hidden;
  }

  .wizard-progress {
      display: flex; align-items: center; justify-content: center; margin-top: 0.5rem;
      .step-indicator {
          width: 35px; height: 35px; border-radius: 50%; background: #1a1a2e; color: #666;
          display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid #333; transition: 0.4s;
          &.active { background: #4e0eff; color: white; border-color: #4e0eff; box-shadow: 0 0 10px rgba(78, 14, 255, 0.5); }
      }
      .progress-line {
          height: 3px; width: 60px; background: #333; transition: 0.4s;
          &.active { background: #4e0eff; }
      }
  }
  .wizard-labels {
      display: flex; justify-content: space-between; padding: 0 1rem; margin-top: -10px; margin-bottom: 10px;
      span { font-size: 0.75rem; color: #666; font-weight: bold; text-transform: uppercase; transition: 0.4s;}
      .active-text { color: #4e0eff; }
  }

  .form-step { display: flex; flex-direction: column; gap: 1.2rem; }
  
  @keyframes slideIn {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
  }
  .slide-in { animation: slideIn 0.3s ease-out forwards; }
  
  .input-wrapper {
      position: relative; width: 100%; display: flex; align-items: center;
      .icon-toggle {
          position: absolute; right: 15px; color: #888; cursor: pointer; font-size: 1.2rem; transition: 0.3s;
          display: flex; align-items: center; justify-content: center;
          &:hover { color: #fff; }
      }
  }

  .strength-meter {
      width: 100%; height: 4px; background: rgba(255, 255, 255, 0.1); border-radius: 2px; margin-top: -0.8rem; overflow: hidden;
      .strength-bar { height: 100%; transition: width 0.4s ease, background-color 0.4s ease; }
  }

  input[type="text"], input[type="email"], input[type="password"], select { 
      background-color: transparent; padding: 1rem; border: 0.1rem solid #4e0eff; 
      border-radius: 0.4rem; color: white; width: 100%; font-size: 1rem; transition: 0.3s;
      &:focus { border: 0.1rem solid #997af0; outline: none; background: rgba(255,255,255,0.02);} 
      &:disabled { opacity: 0.6; cursor: not-allowed; }
  }
  
  .input-wrapper input { padding-right: 2.5rem; }
  select { cursor: pointer; background-color: #0d0d30; }
  
  .gender-select { 
      display: flex; align-items: center; gap: 1rem; color: white; width: 100%; 
      label { font-weight: bold; } 
  }
  
  .avatar-section { 
      display: flex; flex-direction: column; gap: 0.8rem; color: #ccc; font-size: 0.9rem; 
      background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 0.8rem; border: 1px solid rgba(255,255,255,0.05);

      .avatar-header {
          display: flex; justify-content: space-between; align-items: center;
          p { margin: 0; font-weight: bold; color: #e0e0e0; }
          .shuffle-btn {
              background: rgba(78, 14, 255, 0.2); border: 1px solid rgba(78, 14, 255, 0.4); padding: 0.4rem 0.8rem;
              font-size: 0.75rem; border-radius: 0.5rem; display: flex; align-items: center; gap: 0.4rem; color: #9a86f3; transition: 0.3s; cursor: pointer;
              &:hover:not(:disabled) { background: #4e0eff; color: white; }
          }
      }
      
      .avatars-list { 
          display: flex; justify-content: space-between; gap: 10px; 
          .avatar-option { 
              width: 60px; height: 60px; border-radius: 50%; cursor: pointer; border: 3px solid transparent; 
              transition: 0.3s; background: #1a1a2e; position: relative;
              img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; } 
              &:hover { transform: scale(1.1); } 
              &.disabled { cursor: not-allowed; opacity: 0.6; &:hover { transform: none; } }
              
              .check-badge {
                  position: absolute; bottom: -5px; right: -5px; background: #00ff88; color: #000;
                  width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                  border: 2px solid #0d0d30;
              }
          } 
          .selected { border: 3px solid #00ff88; box-shadow: 0 0 10px #00ff88; transform: scale(1.1); } 
      } 
  }

  .terms-checkbox {
      display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 0.85rem; color: #bbb; margin-top: 5px;
      input { display: none; }
      .checkmark {
          width: 20px; height: 20px; min-width: 20px; background: rgba(255,255,255,0.05); border: 1px solid #4e0eff; 
          border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: 0.2s;
      }
      input:checked ~ .checkmark { background: #4e0eff; border-color: #4e0eff; }
      input:checked ~ .checkmark::after { content: "✓"; color: white; font-size: 12px; font-weight: bold;}
      p { margin: 0; }
      a { color: #4e0eff; text-decoration: none; font-weight: bold; &:hover{ text-decoration: underline; }}
  }

  .action-btn { 
      padding: 1rem; border: none; font-weight: bold; cursor: pointer; border-radius: 0.4rem; 
      font-size: 1rem; transition: 0.3s; display: flex; justify-content: center; align-items: center; gap: 0.5rem;
      &:disabled { opacity: 0.5; cursor: not-allowed; }
  }
  .next-btn { background-color: #4e0eff; color: white; margin-top: 0.5rem; &:hover:not(:disabled) { background-color: #997af0; } }
  
  .button-group { display: flex; gap: 10px; margin-top: 0.5rem; }
  .back-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: white; flex: 1; &:hover:not(:disabled) { background: rgba(255,255,255,0.05); } }
  .submit-btn { background-color: #4e0eff; color: white; flex: 2; &:hover:not(:disabled) { background-color: #997af0; box-shadow: 0 0 15px rgba(78, 14, 255, 0.4); } }
  
  .login-link { 
      color: white; text-transform: uppercase; font-size: 0.8rem; text-align: center; margin-top: 0.5rem;
      a { color: #4e0eff; text-decoration: none; font-weight: bold; } 
  }
`;
