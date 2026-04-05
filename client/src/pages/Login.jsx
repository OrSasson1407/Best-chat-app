// client/src/pages/Login.jsx — REDESIGNED: Obsidian Aurora
import React, { useState, useEffect } from "react";
import axios from "axios";
import styled, { keyframes } from "styled-components";
import { useNavigate, Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { loginRoute, updateE2EKeysRoute, validate2FALoginRoute } from "../utils/APIRoutes";
import { generateE2EBundle } from "../utils/crypto";
import useChatStore from "../store/chatStore";

export default function Login() {
  const navigate = useNavigate();
  const { setCurrentUser } = useChatStore();
  const [values, setValues] = useState({ username: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focused, setFocused] = useState(null);

  // Sprint 1: 2FA challenge state
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorUserId, setTwoFactorUserId] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // ✅ FIX: Use sessionStorage and guard against string "null" / "undefined"
  useEffect(() => {
    const token = sessionStorage.getItem("chat-app-token");
    if (token && token !== "null" && token !== "undefined") {
      navigate("/");
    }
  }, [navigate]);

  const handleChange = (e) => setValues({ ...values, [e.target.name]: e.target.value });

  const validateForm = () => {
    if (!values.username || !values.password) {
      toast.error("Please fill in all fields."); return false;
    }
    return true;
  };

  // Shared helper: store session + E2E setup then navigate
  const finalizeLogin = async (data) => {
    sessionStorage.setItem("chat-app-token", data.token);
    sessionStorage.setItem("chat-app-refresh-token", data.refreshToken);
    const userData = { ...data.user, token: data.token };
    sessionStorage.setItem("chat-app-user", JSON.stringify(userData));
    setCurrentUser(userData);
    try {
      const existingLocalKey = localStorage.getItem(`privateKey_${data.user._id}`);
      const serverHasKeys = data.user?.e2eStatus?.hasKeys === true;
      let serverKeyIsValid = false;
      if (existingLocalKey && serverHasKeys) {
        try {
          const verifyRes = await axios.get(
            `${updateE2EKeysRoute.replace("upload-bundle", "bundle")}/${data.user._id}`,
            { headers: { Authorization: `Bearer ${data.token}` } }
          );
          serverKeyIsValid = !!(verifyRes.data?.bundle?.identityKey);
        } catch (_) { serverKeyIsValid = false; }
      }
      if (!existingLocalKey || !serverHasKeys || !serverKeyIsValid) {
        const { bundle, privateKeys } = await generateE2EBundle();
        localStorage.setItem(`privateKey_${data.user._id}`, JSON.stringify(privateKeys.identityPrivateKey));
        localStorage.setItem(`fullE2EKeys_${data.user._id}`, JSON.stringify(privateKeys));
        await axios.post(updateE2EKeysRoute, bundle, { headers: { Authorization: `Bearer ${data.token}` } });
      }
    } catch (e2eErr) { console.error("[Crypto] E2EE key setup failed:", e2eErr); }
    navigate("/");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const { data } = await axios.post(loginRoute, { username: values.username, password: values.password });
      if (data.status === false) { toast.error(data.msg || "Invalid credentials."); return; }
      // ── Sprint 1: 2FA challenge ──
      if (data.status === "2fa_required") {
        setTwoFactorUserId(data.userId);
        setTwoFactorPending(true);
        return;
      }
      if (data.status === true) await finalizeLogin(data);
    } catch (err) {
      toast.error(err.response?.data?.msg || "Login failed. Please try again.");
    } finally { setIsSubmitting(false); }
  };

  // Sprint 1: submit the 6-digit TOTP code after password was accepted
  const handleTwoFactorSubmit = async (e) => {
    e?.preventDefault();
    if (twoFactorCode.length !== 6) { toast.warning("Enter the 6-digit code from your authenticator app."); return; }
    setIsSubmitting(true);
    try {
      const { data } = await axios.post(validate2FALoginRoute, { userId: twoFactorUserId, token: twoFactorCode });
      if (!data.status) { toast.error(data.msg || "Invalid code. Try again."); return; }
      await finalizeLogin(data);
    } catch (err) {
      toast.error(err.response?.data?.msg || "2FA verification failed.");
    } finally { setIsSubmitting(false); }
  };

  return (
    <PageWrap>
      {/* Aurora Orbs */}
      <div className="orbs" aria-hidden="true">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      </div>

      <Card>
        {/* Brand */}
        <div className="brand">
          <div className="logo-badge">S</div>
          <div className="brand-text">
            <span className="name">Snappy</span>
            <span className="tagline">Encrypted messaging</span>
          </div>
        </div>

        <div className="card-header">
          <h1>Welcome back</h1>
          <p>Sign in to continue your conversations</p>
        </div>

        {/* ── Sprint 1: 2FA challenge screen ── */}
        {twoFactorPending ? (
          <form onSubmit={handleTwoFactorSubmit} noValidate>
            <div className="twofa-prompt">
              <div className="twofa-icon">🔐</div>
              <p className="twofa-title">Two-factor authentication</p>
              <p className="twofa-sub">Enter the 6-digit code from your authenticator app, or a backup code.</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="000000"
                value={twoFactorCode}
                onChange={e => setTwoFactorCode(e.target.value.replace(/\s/g, ""))}
                className="twofa-input"
                autoFocus
                disabled={isSubmitting}
              />
            </div>
            <button type="submit" className="btn-submit" disabled={isSubmitting || twoFactorCode.length < 6}>
              {isSubmitting
                ? <><div className="btn-spinner" /><span>Verifying...</span></>
                : <><span>Verify</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>
              }
            </button>
            <p className="footer-link" style={{marginTop:"1rem"}}>
              <button type="button" style={{background:"none",border:"none",color:"var(--msg-sent)",cursor:"pointer",font:"inherit",fontSize:"var(--text-sm)"}} onClick={() => { setTwoFactorPending(false); setTwoFactorCode(""); }}>
                ← Back to login
              </button>
            </p>
          </form>
        ) : (
        <form onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className={`field-group ${focused === 'username' ? 'focused' : ''}`}>
            <label htmlFor="username">Username</label>
            <div className="input-wrap">
              <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <input
                id="username" type="text" name="username"
                placeholder="Enter your username"
                autoComplete="username"
                value={values.username}
                onChange={handleChange}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused(null)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Password */}
          <div className={`field-group ${focused === 'password' ? 'focused' : ''}`}>
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <input
                id="password" type={showPass ? "text" : "password"} name="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={values.password}
                onChange={handleChange}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                disabled={isSubmitting}
              />
              <button type="button" className="toggle-pass" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Hide password" : "Show password"}>
                {showPass
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          <button type="submit" className="btn-submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <><div className="btn-spinner" /><span>Signing in...</span></>
            ) : (
              <><span>Sign In</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></>
            )}
          </button>
        </form>
        )} {/* end twoFactorPending conditional */}

        <p className="footer-link">
          New to Snappy? <Link to="/register">Create an account</Link>
        </p>

        <div className="security-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          End-to-end encrypted
        </div>
      </Card>

      <ToastContainer position="top-center" autoClose={3500} hideProgressBar newestOnTop theme="dark" />
    </PageWrap>
  );
}

/* ── STYLES ─────────────────────────────────────── */
const PageWrap = styled.div`
  min-height: 100vh; width: 100vw;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-root);
  background-image: var(--mesh-gradient);
  position: relative; overflow: hidden;
  padding: 1rem;

  .orbs { position:absolute;inset:0;pointer-events:none;overflow:hidden; }
  .orb { position:absolute;border-radius:50%; animation:orbFloat 22s ease-in-out infinite; }
  .orb-1 { width:min(600px,70vw);height:min(600px,70vw);top:-15%;left:-12%;
            background:radial-gradient(circle,rgba(124,58,237,0.25),transparent 70%);
            filter:blur(70px); }
  .orb-2 { width:min(500px,60vw);height:min(500px,60vw);bottom:-18%;right:-10%;
            background:radial-gradient(circle,rgba(99,102,241,0.2),transparent 70%);
            filter:blur(80px);animation-delay:-9s;animation-duration:28s; }
  .orb-3 { width:min(300px,40vw);height:min(300px,40vw);top:55%;left:50%;
            background:radial-gradient(circle,rgba(34,211,238,0.15),transparent 70%);
            filter:blur(90px);animation-delay:-16s;animation-duration:35s; }

  @keyframes orbFloat {
    0%,100%{transform:translate(0,0) scale(1);}
    25%{transform:translate(30px,-45px) scale(1.05);}
    50%{transform:translate(-15px,20px) scale(0.96);}
    75%{transform:translate(25px,15px) scale(1.02);}
  }
`;

const Card = styled.div`
  background: var(--glass-noise), var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  box-shadow: var(--glass-shadow);
  border-radius: 28px;
  padding: clamp(2rem, 5vw, 3rem);
  width: min(440px, 95vw);
  position: relative; z-index: 5;
  animation: fadeInScale 0.5s var(--ease-spring);

  .brand {
    display: flex; align-items: center; gap: 12px; margin-bottom: 2rem;
    .logo-badge {
      width: 44px; height: 44px; border-radius: 14px;
      background: var(--aurora-gradient);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Plus Jakarta Sans',sans-serif; font-size: 1.3rem; font-weight: 800; color: white;
      box-shadow: 0 8px 20px rgba(124,58,237,0.4);
    }
    .brand-text { display:flex; flex-direction:column; }
    .name { font-size: var(--text-lg); font-weight: 800; color: var(--text-primary); line-height:1; }
    .tagline { font-size: var(--text-xs); color: var(--text-secondary); margin-top:2px; }
  }

  .card-header {
    margin-bottom: 1.75rem;
    h1 { font-size: var(--text-xl); font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
    p { font-size: var(--text-sm); color: var(--text-secondary); }
  }

  form { display: flex; flex-direction: column; gap: 1rem; }

  .field-group {
    display: flex; flex-direction: column; gap: 6px;
    label { font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary); letter-spacing: 0.3px; text-transform: uppercase; }

    .input-wrap {
      position: relative; display: flex; align-items: center;
      background: var(--input-bg); border: 1px solid var(--border-default);
      border-radius: 12px; transition: all var(--duration-base);

      .field-icon { position:absolute;left:14px;color:var(--text-tertiary);flex-shrink:0;pointer-events:none; }
      input {
        width: 100%; background: transparent; border: none;
        color: var(--text-primary); font-family: 'Plus Jakarta Sans',sans-serif;
        font-size: var(--text-sm); padding: 13px 44px 13px 42px;
        &::placeholder { color: var(--text-tertiary); }
        &:disabled { opacity: 0.5; cursor: not-allowed; }
      }
      .toggle-pass {
        position:absolute;right:12px;background:none;border:none;color:var(--text-tertiary);
        cursor:pointer;padding:4px;border-radius:6px;display:flex;align-items:center;
        transition:color var(--duration-fast);
        &:hover { color:var(--text-primary); }
      }
    }

    &.focused .input-wrap {
      border-color: var(--msg-sent); background: rgba(124,58,237,0.06);
      box-shadow: 0 0 0 3px rgba(124,58,237,0.12);
      .field-icon { color: var(--msg-sent); }
    }
  }

  .btn-submit {
    margin-top: 0.5rem;
    width: 100%; padding: 14px;
    background: var(--aurora-gradient);
    color: white; border: none; border-radius: 12px;
    font-family: 'Plus Jakarta Sans',sans-serif;
    font-size: var(--text-sm); font-weight: 700;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: all var(--duration-base) var(--ease-out);
    box-shadow: 0 6px 20px rgba(124,58,237,0.35);
    position: relative; overflow: hidden;
    &::before { content:'';position:absolute;inset:0;background:rgba(255,255,255,0.08);opacity:0;transition:opacity var(--duration-fast); }
    &:hover:not(:disabled) { transform:translateY(-2px);box-shadow:0 10px 30px rgba(124,58,237,0.45); }
    &:hover:not(:disabled)::before { opacity:1; }
    &:active { transform:translateY(0); }
    &:disabled { opacity:0.65;cursor:not-allowed; }

    .btn-spinner {
      width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);
      border-top-color:white;border-radius:50%;animation:spin 0.8s linear infinite;
    }
    @keyframes spin{to{transform:rotate(360deg);}}
  }

  .footer-link {
    margin-top: 1.25rem; text-align: center;
    font-size: var(--text-sm); color: var(--text-secondary);
    a { color: var(--msg-sent); font-weight: 600; text-decoration: none; transition:opacity var(--duration-fast); }
    a:hover { opacity:0.8; text-decoration:underline; }
  }

  /* Sprint 1 — 2FA challenge styles */
  .twofa-prompt {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    text-align: center; padding: 0.5rem 0 1.25rem;
    .twofa-icon { font-size: 2.5rem; line-height: 1; margin-bottom: 4px; }
    .twofa-title { font-size: var(--text-base); font-weight: 700; color: var(--text-primary); }
    .twofa-sub { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; max-width: 280px; }
  }
  .twofa-input {
    width: 100%; padding: 14px; text-align: center;
    font-size: 2rem; letter-spacing: 14px; font-family: monospace; font-weight: 700;
    background: var(--input-bg); border: 1.5px solid var(--border-default);
    border-radius: var(--radius-md); color: var(--text-primary); outline: none;
    transition: border-color var(--duration-base);
    &:focus { border-color: var(--msg-sent); box-shadow: 0 0 0 3px rgba(124,58,237,0.15); }
    &:disabled { opacity: 0.5; }
    &::placeholder { font-size: 1.5rem; letter-spacing: 8px; color: var(--text-tertiary); }
  }

  .security-badge {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    margin-top: 1.25rem; font-size: var(--text-2xs); color: var(--text-tertiary);
    font-weight: 500; letter-spacing: 0.3px;
    svg { color: var(--color-success); }
  }

  @keyframes fadeInScale {
    from{opacity:0;transform:scale(0.95) translateY(16px);}
    to{opacity:1;transform:scale(1) translateY(0);}
  }

  @media(max-width:480px) {
    padding:1.75rem 1.5rem;
    border-radius:20px;
  }
`;