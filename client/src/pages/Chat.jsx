// client/src/pages/Chat.jsx — REDESIGNED: Obsidian Aurora
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import customParser from "socket.io-msgpack-parser";
import styled, { keyframes, css } from "styled-components";
import { allUsersRoute, host, updateFcmTokenRoute } from "../utils/APIRoutes";
import Contacts from "../components/Contacts";
import Welcome from "../components/Welcome";
import ChatContainer from "../components/ChatContainer";
import useChatStore from "../store/chatStore";
import { ToastContainer, toast } from "react-toastify";
import { requestForToken, onMessageListener } from "../firebase";
import { triggerHaptic } from "../utils/haptics";

export default function Chat() {
  const navigate = useNavigate();
  const socket = useRef();
  const {
    currentUser, setCurrentUser, currentChat, setCurrentChat,
    setOnlineUsers, setGlobalTypingUsers, theme, setTheme, isCompact, _hasHydrated,
  } = useChatStore();

  const [contacts, setContacts] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); }, [theme]);
  const toggleTheme = () => { triggerHaptic('light'); setTheme(theme === "light" ? "glass" : "light"); };

  useEffect(() => {
    const handleOffline = () => { setIsOffline(true); triggerHaptic('warning'); toast.warning("📶 You are offline.", { autoClose: false, toastId: "offline-toast" }); };
    const handleOnline = () => {
      setIsOffline(false); triggerHaptic('success'); toast.dismiss("offline-toast"); toast.success("🌐 Back online!", { autoClose: 3000 });
      if (socket.current && !socket.current.connected) socket.current.connect();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => { window.removeEventListener("offline", handleOffline); window.removeEventListener("online", handleOnline); };
  }, []);

  const hasRedirected = useRef(false);
  // FIX: sessionStorage is tab-isolated by the browser spec, making it the only
  // correct source for per-tab identity. We removed currentUser from the Zustand
  // IDB persist config because IDB is shared across ALL tabs — persisting there
  // caused Tab B to rehydrate with Tab A's user on mount.
  // This effect runs once and bootstraps the tab's identity from sessionStorage.
  useEffect(() => {
    const stored = sessionStorage.getItem("chat-app-user");
    if (stored && stored !== "null" && stored !== "undefined") { 
      try { 
        const parsed = JSON.parse(stored);
        // Always sync from sessionStorage — overrides any stale IDB rehydration
        setCurrentUser(parsed); 
      } catch (e) { 
        console.error("[Auth] Failed to parse stored user:", e);
        sessionStorage.clear();
      } 
    } else if (!currentUser) {
      // No session data and no in-memory user → redirect to login
      navigate("/login");
    }
  }, []);

  useEffect(() => {
    if (currentUser && currentUser._id && !socket.current) {
      const rawToken = currentUser.token || sessionStorage.getItem("chat-app-token") || "";
      const cleanToken = rawToken.replace(/(Bearer\s*)+/gi, "").trim();
      
      // ✅ FIX: Wipe bad data so Login doesn't bounce you right back into a loop
      if (!cleanToken || cleanToken === "null" || cleanToken === "undefined") { 
        sessionStorage.clear(); 
        navigate("/login"); 
        return; 
      }
      
      socket.current = io(host, { auth: { token: cleanToken }, parser: customParser, reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
      socket.current.on("connect", () => { socket.current.emit("add-user", currentUser._id); });
      socket.current.on("disconnect", (reason) => { if (reason === "io server disconnect") socket.current.connect(); });
      socket.current.on("reconnect_attempt", () => {
        const freshToken = (currentUser?.token || sessionStorage.getItem("chat-app-token") || "").replace(/(Bearer\s*)+/gi, "").trim();
        if (freshToken) socket.current.auth.token = freshToken;
      });
      socket.current.on("reconnect", (n) => { console.log(`[Socket] Reconnected on attempt ${n}`); socket.current.emit("add-user", currentUser._id); });
      socket.current.on("connect_error", (err) => {
        if (err.message.includes("Authentication error") || err.message.includes("Invalid token")) {
          if (hasRedirected.current) return; hasRedirected.current = true;
          sessionStorage.clear(); setCurrentUser(undefined); setCurrentChat(undefined);
          if (socket.current) socket.current.disconnect();
          toast.error("Session expired. Please log in again."); navigate("/login");
        }
      });
      socket.current.on("get-online-users", (users) => { setOnlineUsers(users); });

      // ✅ FIX: Keep onlineUsers in sync when any user comes online or goes offline
      socket.current.on("user-status-change", ({ userId, isOnline }) => {
        setOnlineUsers((prev) =>
          isOnline
            ? prev.includes(userId) ? prev : [...prev, userId]
            : prev.filter((id) => id !== userId)
        );
      });

      // ✅ FIX: When a user disconnects, remove from online list AND update their
      // lastSeen in the contacts snapshot so the UI shows the correct time
      socket.current.on("user-offline", ({ userId, lastSeen }) => {
        setOnlineUsers((prev) => prev.filter((id) => id !== userId));
        setContacts((prev) =>
          prev.map((c) =>
            c._id === userId ? { ...c, isOnline: false, lastSeen } : c
          )
        );
      });
      return () => { if (socket.current) { socket.current.disconnect(); socket.current = null; } };
    }
  }, [currentUser, navigate, setOnlineUsers, setCurrentUser, setCurrentChat, setContacts]);

  useEffect(() => {
    if (socket.current) {
      const handleTypingStatus = (data) => {
        setGlobalTypingUsers((prev) => {
          if (data.isTyping) return prev.includes(data.from) ? prev : [...prev, data.from];
          return prev.filter((id) => id !== data.from);
        });
        if (currentChat) {
          if (data.isGroup) setIsTyping(data.isTyping ? data.username : false);
          else if (currentChat._id === data.from) setIsTyping(data.isTyping ? data.username : false);
        } else setIsTyping(false);
      };
      socket.current.on("typing-status", handleTypingStatus);
      return () => { socket.current?.off("typing-status", handleTypingStatus); };
    }
  }, [currentChat, setGlobalTypingUsers]);

  // ✅ Setup Push Notifications with Auth Header
  useEffect(() => {
    if (currentUser && currentUser._id) {
      const setupPushNotifications = async () => {
        const token = await requestForToken();
        if (token) {
          try {
            const rawToken = currentUser.token || sessionStorage.getItem("chat-app-token") || "";
            const cleanToken = rawToken.replace(/(Bearer\s*)+/gi, "").trim();
            
            await axios.post(
              updateFcmTokenRoute, 
              { userId: currentUser._id, fcmToken: token },
              { headers: { Authorization: `Bearer ${cleanToken}` } }
            );
          } catch (err) {
            console.error("Failed to save FCM token to DB", err);
          }
        }
      };
      setupPushNotifications();
      
      const unsubscribe = onMessageListener((payload) => {
        toast.info(`📬 ${payload.notification.title}: ${payload.notification.body}`, { position: "top-right", autoClose: 5000, theme: theme === "light" ? "light" : "dark" });
      });
      return () => { if (typeof unsubscribe === "function") unsubscribe(); };
    }
  }, [currentUser, theme]);

  useEffect(() => {
    async function fetchContacts() {
      if (currentUser && currentUser._id && !isOffline) {
        try { 
          // FIX Bug C1: allUsersRoute is a protected endpoint — the global Axios
          // interceptor in App.jsx attaches the Authorization header automatically,
          // so no manual header is needed here. Previously this was missing entirely.
          const response = await axios.get(`${allUsersRoute}/${currentUser._id}`);
          setContacts(response.data);
        }
        catch (error) { console.error("Error fetching contacts:", error); }
      }
    }
    fetchContacts();
  }, [currentUser, navigate, isOffline]);

  const handleLogout = useCallback(async () => {
    const userId = currentUser?._id;
    try {
      const refreshToken = sessionStorage.getItem("chat-app-refresh-token");
      await axios.post(`${host}/api/auth/logout`, { refreshToken });
    } catch (err) { 
      console.error("Logout API failed:", err); 
    } finally {
      // FIX: Clear only this user's IDB keys (not other tabs') + clear private keys
      const { clearCache } = useChatStore.getState();
      await clearCache(userId);
      // FIX (Bug C5): remove E2E private keys so they don't persist after logout
      if (userId) {
        localStorage.removeItem(`privateKey_${userId}`);
        localStorage.removeItem(`fullE2EKeys_${userId}`);
      }
      sessionStorage.clear(); 
      setCurrentUser(undefined); 
      setCurrentChat(undefined); 
      navigate("/login"); 
    }
  }, [navigate, setCurrentUser, setCurrentChat, currentUser]);

  const handleChatChange = useCallback((chat) => { setCurrentChat(chat); setIsTyping(false); setIsMobileMenuOpen(false); }, [setCurrentChat]);

  if (!_hasHydrated) {
    return (
      <LoadingScreen>
        <div className="spinner-wrap">
          <div className="logo-mark">S</div>
          <div className="spinner" />
        </div>
      </LoadingScreen>
    );
  }

  return (
    <AppShell $isOffline={isOffline} $theme={theme}>

      {/* Aurora Orbs Background */}
      {theme !== "light" && (
        <div className="aurora-bg" aria-hidden="true">
          <div className="orb orb-1" />
          <div className="orb orb-2" />
          <div className="orb orb-3" />
        </div>
      )}

      {/* Offline Banner */}
      {isOffline && (
        <div className="offline-banner">
          <span className="dot" />
          You're offline — messages will sync when reconnected
        </div>
      )}

      {/* Theme Toggle */}
      <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === "light" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        )}
        <span>{theme === "light" ? "Dark" : "Light"}</span>
      </button>

      {/* Mobile Sidebar Toggle */}
      <button className="mobile-nav-btn" onClick={() => { triggerHaptic('light'); setIsMobileMenuOpen(!isMobileMenuOpen); }} aria-label="Toggle navigation">
        {isMobileMenuOpen
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        }
      </button>

      {/* Main App Card */}
      <div className={`app-card glass-container ${isCompact ? "compact" : ""}`}>

        {/* Sidebar Overlay (mobile) */}
        {isMobileMenuOpen && <div className="sidebar-backdrop" onClick={() => setIsMobileMenuOpen(false)} />}

        <div className={`sidebar-wrapper ${isMobileMenuOpen ? "open" : ""}`}>
          <Contacts contacts={contacts} changeChat={handleChatChange} handleLogout={handleLogout} />
        </div>

        <div className="chat-wrapper">
          {!currentChat ? <Welcome /> : <ChatContainer socket={socket} isTyping={isTyping} />}
        </div>
      </div>

      <ToastContainer position="top-right" autoClose={4000} hideProgressBar newestOnTop theme={theme === "light" ? "light" : "dark"} />
    </AppShell>
  );
}

/* ── STYLED COMPONENTS ────────────────────────── */
const AppShell = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: ${({ $theme }) => $theme === 'light' ? 'var(--bg-root)' : 'var(--bg-root)'};
  background-image: ${({ $theme }) => $theme !== 'light' ? 'var(--mesh-gradient)' : 'none'};
  transition: filter var(--duration-slow) var(--ease-out);
  filter: ${({ $isOffline }) => $isOffline ? 'saturate(0.3) brightness(0.85)' : 'none'};

  .aurora-bg {
    position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
    .orb {
      position: absolute; border-radius: 50%; pointer-events: none;
      animation: orbFloat 22s ease-in-out infinite;
    }
    .orb-1 { width: min(700px, 80vw); height: min(700px, 80vw); top: -15%; left: -12%;
              background: radial-gradient(circle, rgba(124,58,237,0.28), transparent 70%);
              filter: blur(70px); animation-duration: 20s; }
    .orb-2 { width: min(600px, 70vw); height: min(600px, 70vw); bottom: -18%; right: -12%;
              background: radial-gradient(circle, rgba(99,102,241,0.22), transparent 70%);
              filter: blur(80px); animation-duration: 27s; animation-delay: -8s; }
    .orb-3 { width: min(400px, 50vw); height: min(400px, 50vw); top: 40%; left: 42%;
              background: radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%);
              filter: blur(90px); animation-duration: 35s; animation-delay: -15s; }
  }

  .offline-banner {
    position: absolute; top: 0; left: 0; right: 0; z-index: 50;
    background: linear-gradient(90deg, #ff5c72, #ff8c6e);
    color: white; text-align: center;
    padding: 8px 16px; font-size: var(--text-xs); font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    letter-spacing: 0.2px;
    .dot { width: 7px; height: 7px; border-radius: 50%; background: white; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
  }

  .theme-toggle {
    position: absolute; top: 1.2rem; right: 1.2rem; z-index: 20;
    display: flex; align-items: center; gap: 6px;
    background: var(--glass-bg); color: var(--text-primary);
    border: 1px solid var(--glass-border);
    padding: 7px 14px; border-radius: var(--radius-full);
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: var(--text-xs); font-weight: 600; cursor: pointer;
    backdrop-filter: var(--glass-blur); transition: all var(--duration-base) var(--ease-out);
    &:hover { transform: translateY(-2px); background: var(--msg-sent); color: white; border-color: transparent; box-shadow: 0 8px 24px rgba(124,58,237,0.35); }
    svg { flex-shrink: 0; }
    @media (max-width: 480px) { span { display: none; } padding: 8px; }
  }

  .mobile-nav-btn {
    display: none; position: absolute; top: 1.2rem; left: 1.2rem; z-index: 20;
    background: var(--glass-bg); color: var(--text-primary);
    border: 1px solid var(--glass-border); border-radius: var(--radius-md);
    width: 40px; height: 40px; cursor: pointer;
    backdrop-filter: var(--glass-blur); transition: all var(--duration-base) var(--ease-out);
    align-items: center; justify-content: center;
    &:hover { background: var(--msg-sent); color: white; border-color: transparent; }
    @media (max-width: 768px) { display: flex; }
  }

  .app-card {
    height: 88vh; width: min(88vw, 1440px);
    border-radius: 28px;
    display: grid;
    grid-template-columns: 300px 1fr;
    overflow: hidden;
    position: relative; z-index: 5;
    animation: fadeInScale 0.5s var(--ease-spring);

    &.compact {
      grid-template-columns: 72px 1fr;
      height: 94vh; width: min(94vw, 1440px);
      border-radius: 20px;
    }

    @media (max-width: 1280px) { width: 94vw; }
    @media (max-width: 1024px) { grid-template-columns: 260px 1fr; }
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      height: 100vh; width: 100vw;
      border-radius: 0;
    }
  }

  .sidebar-backdrop {
    display: none;
    @media (max-width: 768px) {
      display: block; position: fixed; inset: 0; z-index: 8;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
    }
  }

  .sidebar-wrapper {
    height: 100%; overflow: hidden;
    border-right: 1px solid var(--glass-border);
    transition: transform var(--duration-slow) var(--ease-spring);

    @media (max-width: 768px) {
      position: fixed; top: 0; left: 0;
      width: 82%; max-width: 320px; height: 100%; z-index: 9;
      transform: translateX(-105%);
      background: var(--bg-surface);
      border-right: 1px solid var(--glass-border);
      box-shadow: 20px 0 60px rgba(0,0,0,0.4);
      &.open { transform: translateX(0); }
    }
  }

  .chat-wrapper {
    height: 100%; overflow: hidden;
    @media (max-width: 768px) { width: 100%; }
  }

  @keyframes fadeInScale {
    from { opacity:0; transform:scale(0.97) translateY(12px); }
    to   { opacity:1; transform:scale(1) translateY(0); }
  }

  @keyframes orbFloat {
    0%   { transform:translate(0,0) scale(1); }
    25%  { transform:translate(35px,-50px) scale(1.06); }
    50%  { transform:translate(-18px,25px) scale(0.95); }
    75%  { transform:translate(28px,18px) scale(1.02); }
    100% { transform:translate(0,0) scale(1); }
  }
`;

const LoadingScreen = styled.div`
  height:100vh; width:100vw;
  display:flex; align-items:center; justify-content:center;
  background:var(--bg-root);
  background-image:var(--mesh-gradient);

  .spinner-wrap {
    position:relative; display:flex; align-items:center; justify-content:center;
    width:80px; height:80px;
  }

  .logo-mark {
    font-family:'Plus Jakarta Sans',sans-serif;
    font-size:1.8rem; font-weight:800; color:var(--text-primary);
    z-index:2;
  }

  .spinner {
    position:absolute; inset:0;
    border:2.5px solid var(--glass-border);
    border-top-color:var(--msg-sent);
    border-radius:50%;
    animation:spin 0.9s linear infinite;
  }

  @keyframes spin { to{transform:rotate(360deg);} }
`;