// client/src/pages/Register.jsx — REDESIGNED: Obsidian Aurora
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
  const [step, setStep] = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [values, setValues] = useState({ username: "", email: "", password: "", confirmPassword: "", gender: "male" });
  const [avatars, setAvatars] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [focused, setFocused] = useState(null);

  const toastOptions = { pauseOnHover: true, draggable: true, theme: "dark" };

  useEffect(() => { if (sessionStorage.getItem("chat-app-token")) navigate("/"); }, [navigate]);

  const generateAvatars = () => {
    const collection = values.gender === "female" ? "lorelei" : "micah";
    const newAvatars = Array.from({ length: 4 }).map(() => {
      const seed = Math.random().toString(36).substring(7);
      return `https://api.dicebear.com/9.x/${collection}/svg?seed=${seed}`;
    });
    setAvatars(newAvatars); setSelectedAvatar(newAvatars[0]);
  };
  useEffect(() => { generateAvatars(); }, [values.gender]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues({ ...values, [name]: value });
    if (name === "password") {
      let s = 0;
      if (value.length > 7) s += 25; if (value.length > 10) s += 25;
      if (/[A-Z]/.test(value)) s += 15; if (/[0-9]/.test(value)) s += 15;
      if (/[^A-Za-z0-9]/.test(value)) s += 20;
      setPasswordStrength(Math.min(100, s));
    }
  };

  const handleNextStep = () => {
    const { password, confirmPassword, username, email } = values;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (username.length < 3) return toast.error("Username must be at least 3 characters.", toastOptions);
    if (!emailRegex.test(email)) return toast.error("Please enter a valid email address.", toastOptions);
    if (password.length < 8) return toast.error("Password must be at least 8 characters.", toastOptions);
    if (password !== confirmPassword) return toast.error("Passwords do not match.", toastOptions);
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!acceptedTerms) return toast.warning("Please accept the Terms of Service.", toastOptions);
    setIsSubmitting(true);
    const { email, username, password, gender } = values;
    try {
      const { bundle, privateKeys } = await generateE2EBundle();
      const { data } = await axios.post(registerRoute, { username, email, password, gender, avatarImage: selectedAvatar, e2eKeys: bundle });
      if (data.status === false) { toast.error(data.msg, toastOptions); setIsSubmitting(false); return; }
      if (data.status === true) {
        if (!data.token) { toast.error("Registration failed. Please try again.", toastOptions); setIsSubmitting(false); return; }
        localStorage.setItem(`privateKey_${data.user._id}`, JSON.stringify(privateKeys.identityPrivateKey));
        localStorage.setItem(`fullE2EKeys_${data.user._id}`, JSON.stringify(privateKeys));
        
        // ✅ Ensure tokens are stored in sessionStorage properly
        sessionStorage.setItem("chat-app-token", data.token);
        sessionStorage.setItem("chat-app-refresh-token", data.refreshToken);
        const userData = { ...data.user, token: data.token };
        sessionStorage.setItem("chat-app-user", JSON.stringify(userData));
        
        toast.success("Welcome to Snappy! 🎉", toastOptions);
        setTimeout(() => navigate("/"), 100);
      }
    } catch (error) {
      toast.error(error.response?.data?.msg || "Registration failed. Check your connection.", toastOptions);
      setIsSubmitting(false);
    }
  };

  const strengthColor = passwordStrength < 40 ? "var(--color-danger)" : passwordStrength < 80 ? "var(--color-warning)" : "var(--color-success)";
  const strengthLabel = passwordStrength < 40 ? "Weak" : passwordStrength < 80 ? "Good" : "Strong";

  const FieldIcon = ({ path }) => (
    <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{path}</svg>
  );

  return (
    <PageWrap>
      <div className="orbs" aria-hidden="true">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      </div>

      <Card>
        {/* Brand */}
        <div className="brand">
          <div className="logo-badge">S</div>
          <div className="brand-text">
            <span className="name">Snappy</span>
            <span className="tagline">Create your account</span>
          </div>
        </div>

        {/* Wizard Steps */}
        <div className="steps-track">
          <div className={`step ${step >= 1 ? "done" : ""} ${step === 1 ? "active" : ""}`}>
            <div className="step-circle">{step > 1 ? <FaCheck size={10} /> : "1"}</div>
            <span>Account</span>
          </div>
          <div className={`step-line ${step === 2 ? "active" : ""}`} />
          <div className={`step ${step === 2 ? "active" : ""}`}>
            <div className="step-circle">2</div>
            <span>Profile</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* ── STEP 1 ─────────────────────────────── */}
          {step === 1 && (
            <div className="form-step">
              <div className="card-header">
                <h1>Create Account</h1>
                <p>Set up your credentials</p>
              </div>

              {[
                { id: "username", type: "text", label: "Username", autocomplete: "username", iconPath: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
                { id: "email", type: "email", label: "Email", autocomplete: "email", iconPath: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></> },
              ].map(f => (
                <div key={f.id} className={`field-group ${focused === f.id ? "focused" : ""}`}>
                  <label htmlFor={f.id}>{f.label}</label>
                  <div className="input-wrap">
                    <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{f.iconPath}</svg>
                    <input id={f.id} type={f.type} name={f.id} placeholder={`Enter your ${f.label.toLowerCase()}`}
                      autoComplete={f.autocomplete} value={values[f.id]} onChange={handleChange}
                      onFocus={() => setFocused(f.id)} onBlur={() => setFocused(null)} disabled={isSubmitting} />
                  </div>
                </div>
              ))}

              {/* Password */}
              <div className={`field-group ${focused === "password" ? "focused" : ""}`}>
                <label htmlFor="password">Password</label>
                <div className="input-wrap">
                  <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input id="password" type={showPassword ? "text" : "password"} name="password"
                    placeholder="Create a strong password" autoComplete="new-password"
                    value={values.password} onChange={handleChange}
                    onFocus={() => setFocused("password")} onBlur={() => setFocused(null)} disabled={isSubmitting} />
                  <button type="button" className="toggle-pass" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
                {values.password.length > 0 && (
                  <div className="strength-row">
                    <div className="strength-bar"><div className="strength-fill" style={{ width: `${passwordStrength}%`, background: strengthColor }} /></div>
                    <span className="strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className={`field-group ${focused === "confirmPassword" ? "focused" : ""}`}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-wrap">
                  <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} name="confirmPassword"
                    placeholder="Repeat your password" autoComplete="new-password"
                    value={values.confirmPassword} onChange={handleChange}
                    onFocus={() => setFocused("confirmPassword")} onBlur={() => setFocused(null)} disabled={isSubmitting} />
                  <button type="button" className="toggle-pass" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
              </div>

              <button type="button" className="btn-next" onClick={handleNextStep}>
                Next <FaArrowRight size={13} />
              </button>
            </div>
          )}

          {/* ── STEP 2 ─────────────────────────────── */}
          {step === 2 && (
            <div className="form-step">
              <div className="card-header">
                <h1>Pick Your Look</h1>
                <p>Personalize your profile</p>
              </div>

              {/* Gender */}
              <div className="field-group">
                <label htmlFor="gender">Gender</label>
                <div className="input-wrap select-wrap">
                  <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M16 16c0-2.21-1.79-4-4-4s-4 1.79-4 4"/></svg>
                  <select id="gender" name="gender" value={values.gender} onChange={handleChange} disabled={isSubmitting}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              {/* Avatars */}
              <div className="avatar-section">
                <div className="avatar-section-header">
                  <span>Choose an avatar</span>
                  <button type="button" className="shuffle-btn" onClick={generateAvatars} disabled={isSubmitting}>
                    <FaSyncAlt size={11} /> Shuffle
                  </button>
                </div>
                <div className="avatars-grid">
                  {avatars.map((av, i) => (
                    <div key={i} className={`avatar-opt ${selectedAvatar === av ? "selected" : ""}`}
                      onClick={() => !isSubmitting && setSelectedAvatar(av)}>
                      <img src={av} alt={`avatar option ${i + 1}`} />
                      {selectedAvatar === av && <div className="check-ring"><FaCheck size={9} /></div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Terms */}
              <label className="terms-row" htmlFor="termsAccept">
                <div className={`checkbox ${acceptedTerms ? "checked" : ""}`} onClick={() => setAcceptedTerms(!acceptedTerms)}>
                  {acceptedTerms && <FaCheck size={9} />}
                </div>
                <input id="termsAccept" type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} disabled={isSubmitting} style={{ display: "none" }} />
                <span>I agree to the <Link to="/terms" onClick={(e) => e.stopPropagation()}>Terms of Service</Link> & E2EE policy</span>
              </label>

              <div className="btn-row">
                <button type="button" className="btn-back" onClick={() => setStep(1)} disabled={isSubmitting}>
                  <FaArrowLeft size={12} /> Back
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting || !acceptedTerms}>
                  {isSubmitting ? <><div className="btn-spinner" /><span>Generating keys...</span></> : <><span>Create Account</span></>}
                </button>
              </div>
            </div>
          )}

          <p className="login-link">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>

        <div className="security-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          End-to-end encrypted with E2E keys
        </div>
      </Card>

      <ToastContainer position="top-center" autoClose={3000} hideProgressBar newestOnTop theme="dark" />
    </PageWrap>
  );
}

/* ── STYLES ─────────────────────────────────────── */
const PageWrap = styled.div`
  min-height:100vh; width:100vw;
  display:flex; align-items:center; justify-content:center;
  background:var(--bg-root); background-image:var(--mesh-gradient);
  position:relative; overflow:hidden; padding:1rem;

  .orbs{position:absolute;inset:0;pointer-events:none;overflow:hidden;}
  .orb{position:absolute;border-radius:50%;animation:orbFloat 22s ease-in-out infinite;}
  .orb-1{width:min(600px,70vw);height:min(600px,70vw);top:-15%;left:-12%;background:radial-gradient(circle,rgba(124,58,237,0.25),transparent 70%);filter:blur(70px);}
  .orb-2{width:min(500px,60vw);height:min(500px,60vw);bottom:-18%;right:-10%;background:radial-gradient(circle,rgba(99,102,241,0.2),transparent 70%);filter:blur(80px);animation-delay:-9s;animation-duration:28s;}
  .orb-3{width:min(300px,40vw);height:min(300px,40vw);top:55%;left:50%;background:radial-gradient(circle,rgba(34,211,238,0.15),transparent 70%);filter:blur(90px);animation-delay:-16s;animation-duration:35s;}
  @keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1);}25%{transform:translate(30px,-45px) scale(1.05);}50%{transform:translate(-15px,20px) scale(0.96);}75%{transform:translate(25px,15px) scale(1.02);}}
`;

const Card = styled.div`
  background:var(--glass-noise),var(--glass-bg);
  border:1px solid var(--glass-border);
  backdrop-filter:var(--glass-blur); -webkit-backdrop-filter:var(--glass-blur);
  box-shadow:var(--glass-shadow); border-radius:28px;
  padding:clamp(1.75rem,5vw,2.75rem); width:min(460px,95vw);
  position:relative; z-index:5; animation:fadeInScale 0.5s var(--ease-spring);

  .brand{display:flex;align-items:center;gap:12px;margin-bottom:1.5rem;}
  .logo-badge{width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#6366f1,#22d3ee);display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:800;color:white;box-shadow:0 8px 20px rgba(124,58,237,0.4);}
  .brand-text{display:flex;flex-direction:column;}
  .name{font-size:var(--text-lg);font-weight:800;color:var(--text-primary);line-height:1;}
  .tagline{font-size:var(--text-xs);color:var(--text-secondary);margin-top:2px;}

  /* Steps */
  .steps-track{display:flex;align-items:center;gap:0;margin-bottom:1.75rem;}
  .step{display:flex;flex-direction:column;align-items:center;gap:6px;}
  .step-circle{width:32px;height:32px;border-radius:50%;border:2px solid var(--border-default);background:var(--bg-overlay);color:var(--text-secondary);display:flex;align-items:center;justify-content:center;font-size:var(--text-xs);font-weight:700;transition:all var(--duration-base);}
  .step span{font-size:var(--text-2xs);color:var(--text-secondary);font-weight:500;text-transform:uppercase;letter-spacing:0.4px;}
  .step.active .step-circle{border-color:var(--msg-sent);background:rgba(124,58,237,0.15);color:var(--msg-sent);}
  .step.active span{color:var(--msg-sent);}
  .step.done .step-circle{background:var(--msg-sent);border-color:var(--msg-sent);color:white;}
  .step-line{flex:1;height:2px;background:var(--border-default);margin:0 8px;margin-bottom:22px;border-radius:2px;transition:background var(--duration-base);}
  .step-line.active{background:var(--msg-sent);}

  /* Form */
  form{display:flex;flex-direction:column;}
  .form-step{display:flex;flex-direction:column;gap:0.85rem;animation:slideUp 0.3s var(--ease-out);}
  @keyframes slideUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}

  .card-header{margin-bottom:0.5rem;}
  .card-header h1{font-size:var(--text-xl);font-weight:800;color:var(--text-primary);margin-bottom:3px;}
  .card-header p{font-size:var(--text-sm);color:var(--text-secondary);}

  /* Fields */
  .field-group{display:flex;flex-direction:column;gap:5px;}
  label{font-size:var(--text-xs);font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.3px;}
  .input-wrap{position:relative;display:flex;align-items:center;background:var(--input-bg);border:1px solid var(--border-default);border-radius:12px;transition:all var(--duration-base);}
  .field-icon{position:absolute;left:13px;color:var(--text-tertiary);flex-shrink:0;pointer-events:none;}
  input,select{width:100%;background:transparent;border:none;color:var(--text-primary);font-family:'Plus Jakarta Sans',sans-serif;font-size:var(--text-sm);padding:12px 40px 12px 40px;&::placeholder{color:var(--text-tertiary);}&:disabled{opacity:0.5;cursor:not-allowed;}}
  select{padding-right:16px;cursor:pointer;appearance:none;}
  .select-wrap::after{content:'▾';position:absolute;right:14px;color:var(--text-tertiary);font-size:12px;pointer-events:none;}
  .toggle-pass{position:absolute;right:12px;background:none;border:none;color:var(--text-tertiary);cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;transition:color var(--duration-fast);&:hover{color:var(--text-primary);}}
  .field-group.focused .input-wrap{border-color:var(--msg-sent);background:rgba(124,58,237,0.06);box-shadow:0 0 0 3px rgba(124,58,237,0.1);.field-icon{color:var(--msg-sent);}}

  .strength-row{display:flex;align-items:center;gap:10px;margin-top:4px;}
  .strength-bar{flex:1;height:4px;background:var(--bg-overlay);border-radius:4px;overflow:hidden;}
  .strength-fill{height:100%;border-radius:4px;transition:width 0.4s,background 0.4s;}
  .strength-label{font-size:var(--text-2xs);font-weight:700;min-width:40px;text-align:right;}

  /* Avatars */
  .avatar-section{display:flex;flex-direction:column;gap:10px;}
  .avatar-section-header{display:flex;align-items:center;justify-content:space-between;}
  .avatar-section-header span{font-size:var(--text-xs);font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.3px;}
  .shuffle-btn{display:flex;align-items:center;gap:5px;background:var(--input-bg);border:1px solid var(--border-default);color:var(--text-secondary);padding:5px 10px;border-radius:var(--radius-full);font-size:var(--text-xs);font-weight:600;cursor:pointer;transition:all var(--duration-fast);&:hover{border-color:var(--msg-sent);color:var(--msg-sent);&:disabled{opacity:0.5;cursor:not-allowed;}}}
  .avatars-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
  .avatar-opt{border-radius:14px;overflow:hidden;cursor:pointer;border:2px solid var(--border-default);position:relative;transition:all var(--duration-base);aspect-ratio:1;background:var(--bg-overlay);&:hover{border-color:var(--msg-sent);transform:translateY(-2px);}img{width:100%;height:100%;object-fit:cover;display:block;}&.selected{border-color:var(--msg-sent);box-shadow:0 0 0 3px rgba(124,58,237,0.25);}.check-ring{position:absolute;bottom:4px;right:4px;width:18px;height:18px;background:var(--msg-sent);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;border:2px solid var(--bg-panel);}}

  /* Terms */
  .terms-row{display:flex;align-items:center;gap:10px;cursor:pointer;}
  .checkbox{width:18px;height:18px;border-radius:6px;border:2px solid var(--border-strong);background:var(--input-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all var(--duration-fast);&.checked{background:var(--msg-sent);border-color:var(--msg-sent);color:white;}}
  .terms-row span{font-size:var(--text-xs);color:var(--text-secondary);a{color:var(--msg-sent);font-weight:600;text-decoration:none;&:hover{text-decoration:underline;}}}

  /* Buttons */
  .btn-next{margin-top:0.5rem;width:100%;padding:13px;background:linear-gradient(135deg,#7c3aed,#6366f1,#22d3ee);color:white;border:none;border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:var(--text-sm);font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all var(--duration-base) var(--ease-out);box-shadow:0 6px 20px rgba(124,58,237,0.35);&:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(124,58,237,0.45);}&:active{transform:translateY(0);}}
  .btn-row{display:flex;gap:10px;margin-top:0.5rem;}
  .btn-back{padding:13px 18px;background:var(--input-bg);border:1px solid var(--border-default);color:var(--text-secondary);border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:var(--text-sm);font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all var(--duration-fast);&:hover{border-color:var(--border-strong);color:var(--text-primary);}&:disabled{opacity:0.5;cursor:not-allowed;}}
  .btn-submit{flex:1;padding:13px;background:linear-gradient(135deg,#7c3aed,#6366f1);color:white;border:none;border-radius:12px;font-family:'Plus Jakarta Sans',sans-serif;font-size:var(--text-sm);font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all var(--duration-base) var(--ease-out);box-shadow:0 6px 20px rgba(124,58,237,0.3);&:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(124,58,237,0.4);}&:disabled{opacity:0.6;cursor:not-allowed;}}
  .btn-spinner{width:15px;height:15px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}

  .login-link{margin-top:1.25rem;text-align:center;font-size:var(--text-sm);color:var(--text-secondary);a{color:var(--msg-sent);font-weight:600;text-decoration:none;&:hover{text-decoration:underline;}}}
  .security-badge{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:1rem;font-size:var(--text-2xs);color:var(--text-tertiary);font-weight:500;letter-spacing:0.3px;svg{color:var(--color-success);}}

  @keyframes fadeInScale{from{opacity:0;transform:scale(0.95) translateY(16px);}to{opacity:1;transform:scale(1) translateY(0);}}
  @media(max-width:480px){padding:1.5rem;border-radius:20px;}
`;