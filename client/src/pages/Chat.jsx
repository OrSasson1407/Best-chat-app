// client/src/pages/Chat.jsx
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

// --- NEW: Import the Haptic Engine ---
import { triggerHaptic } from "../utils/haptics";

export default function Chat() {
  const navigate = useNavigate();
  const socket = useRef();

  const {
    currentUser, setCurrentUser,
    currentChat, setCurrentChat,
    setOnlineUsers,
    setGlobalTypingUsers,
    theme, setTheme,
    isCompact,
    _hasHydrated,
  } = useChatStore();

  const [contacts, setContacts] = useState([]);
  const [isLoaded, setIsLoaded] = useState(true); // Don't gate render on auth check
  const [isTyping, setIsTyping] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // --- PHASE 4: OFFLINE STATE ---
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const timeBasedColors = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return ["#ff9a9e", "#fecfef"];
    if (hour >= 12 && hour < 17) return ["#a1c4fd", "#c2e9fb"];
    if (hour >= 17 && hour < 21) return ["#f6d365", "#fda085"];
    return ["#30cfd0", "#330867"];
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    triggerHaptic('light'); // Added tactile feedback on theme switch
    setTheme(theme === "light" ? "glass" : "light");
  };

  // --- PHASE 4: NETWORK ONLINE/OFFLINE LISTENERS ---
  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      triggerHaptic('warning'); // Buzzes when the user loses connection
      toast.warning("📶 You are offline. Waiting for connection...", { 
        autoClose: false, 
        toastId: "offline-toast" 
      });
    };

    const handleOnline = () => {
      setIsOffline(false);
      triggerHaptic('success'); // Happy double-buzz when reconnected
      toast.dismiss("offline-toast");
      toast.success("🌐 Back online! Reconnecting...", { autoClose: 3000 });
      
      // Force Socket.io to try reconnecting immediately if it gave up
      if (socket.current && !socket.current.connected) {
        socket.current.connect();
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Bootstrap currentUser from sessionStorage on page refresh
  const hasRedirected = useRef(false);
  // IDB persist only saves between sessions — sessionStorage has the freshest data
  useEffect(() => {
    if (!currentUser) {
      const stored = sessionStorage.getItem("chat-app-user");
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
        } catch (e) {
          console.error("[Auth] Failed to parse stored user:", e);
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps



  // 2. Setup STABLE Socket Connection with Phase 4 Resilience
  useEffect(() => {
    if (currentUser && currentUser._id && !socket.current) {
      
      // ✅ FIX: Grab token from Zustand or sessionStorage securely.
      // If your server expects the "Bearer " prefix, leave rawToken as is.
      // If it fails, revert to cleanToken (most socket middlewares prefer cleanToken).
      const rawToken = currentUser.token || sessionStorage.getItem("chat-app-token") || "";
      const cleanToken = rawToken.replace(/(Bearer\s*)+/gi, "").trim();

      if (!cleanToken) {
        console.error("[Socket] No token available for socket auth. Redirecting to login.");
        navigate("/login");
        return;
      }

      socket.current = io(host, {
        auth: { token: cleanToken }, // Try passing rawToken here if cleanToken still gives 400 Bad Request
        parser: customParser,
        reconnection: true,             // Enable auto-reconnect
        reconnectionAttempts: Infinity, // Keep trying
        reconnectionDelay: 1000,        // Start with 1 second
        reconnectionDelayMax: 5000,     // Max wait 5 seconds between attempts
      });

      socket.current.on("connect", () => {
        socket.current.emit("add-user", currentUser._id);
      });

      // --- PHASE 4: RESILIENCE LISTENERS ---
      socket.current.on("disconnect", (reason) => {
        console.warn("[Socket] Disconnected:", reason);
        // If server manually disconnected us, we must manually reconnect
        if (reason === "io server disconnect") {
          socket.current.connect();
        }
      });

      socket.current.on("reconnect_attempt", () => {
        const freshToken = (currentUser?.token || sessionStorage.getItem("chat-app-token") || "")
          .replace(/(Bearer\s*)+/gi, "").trim();
        if (freshToken) {
          socket.current.auth.token = freshToken;
        }
      });

      socket.current.on("reconnect", (attemptNumber) => {
        console.log(`[Socket] Reconnected successfully on attempt ${attemptNumber}`);
        socket.current.emit("add-user", currentUser._id);
      });

      socket.current.on("connect_error", (err) => {
        console.error("Socket Connection Error:", err.message);
        
        // ✅ FIX: Safely catch "Invalid token" and "Authentication error"
        // Prevent infinite 400 Bad Request loops by destroying Zustand state AND disconnecting.
        if (err.message.includes("Authentication error") || err.message.includes("Invalid token")) {
          if (hasRedirected.current) return;
          hasRedirected.current = true;

          sessionStorage.clear();
          setCurrentUser(undefined);
          setCurrentChat(undefined);
          
          if (socket.current) {
            socket.current.disconnect();
          }
          
          toast.error("Session expired. Please log in again.");
          navigate("/login");
        }
      });

      socket.current.on("get-online-users", (users) => {
        setOnlineUsers(users);
      });

      return () => {
        if (socket.current) {
          socket.current.disconnect();
          socket.current = null;
        }
      };
    }
  }, [currentUser, navigate, setOnlineUsers, setCurrentUser, setCurrentChat]);

  // 3. Dynamic Socket Listeners
  useEffect(() => {
    if (socket.current) {
      const handleTypingStatus = (data) => {
        setGlobalTypingUsers((prev) => {
          if (data.isTyping) {
            return prev.includes(data.from) ? prev : [...prev, data.from];
          } else {
            return prev.filter((id) => id !== data.from);
          }
        });

        if (currentChat) {
          if (data.isGroup) {
            setIsTyping(data.isTyping ? data.username : false);
          } else {
            if (currentChat._id === data.from) {
              setIsTyping(data.isTyping ? data.username : false);
            }
          }
        } else {
          setIsTyping(false);
        }
      };

      socket.current.on("typing-status", handleTypingStatus);

      return () => {
        socket.current?.off("typing-status", handleTypingStatus);
      };
    }
  }, [currentChat, setGlobalTypingUsers]);

  // 4. Fetch Contacts
  useEffect(() => {
    async function fetchContacts() {
      if (currentUser && currentUser._id && !isOffline) { 
        try {
          const response = await axios.get(`${allUsersRoute}/${currentUser._id}`);
          setContacts(response.data);
        } catch (error) {
          console.error("Error fetching contacts:", error);
        }
      }
    }
    fetchContacts();
  }, [currentUser, navigate, isOffline]);

  // 5. Firebase Push Notification Setup
  useEffect(() => {
    if (currentUser && currentUser._id) {
      const setupPushNotifications = async () => {
        const token = await requestForToken();
        if (token) {
          try {
            await axios.post(updateFcmTokenRoute, {
              userId: currentUser._id,
              fcmToken: token,
            });
          } catch (err) {
            console.error("Failed to save FCM token to DB", err);
          }
        }
      };

      setupPushNotifications();

      const unsubscribe = onMessageListener((payload) => {
        toast.info(`📬 ${payload.notification.title}: ${payload.notification.body}`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: theme === "light" ? "light" : "dark",
        });
      });

      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }
  }, [currentUser, theme]);

  const handleLogout = useCallback(async () => {
    try {
      const refreshToken = sessionStorage.getItem("chat-app-refresh-token");
      const token = sessionStorage.getItem("chat-app-token");
      
      await axios.post(`${host}/api/auth/logout`,
        { refreshToken },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error("Logout API failed:", err);
    } finally {
      sessionStorage.clear();
      setCurrentUser(undefined);
      setCurrentChat(undefined);
      navigate("/login");
    }
  }, [navigate, setCurrentUser, setCurrentChat]);

  const handleChatChange = useCallback((chat) => {
    setCurrentChat(chat);
    setIsTyping(false);
    setIsMobileMenuOpen(false);
  }, [setCurrentChat]);

  // Show nothing (or a spinner) until IDB has rehydrated the store
  if (!_hasHydrated) {
    return (
      <LoadingScreen>
        <div className="spinner" />
      </LoadingScreen>
    );
  }

  return (
    <Container
      $themeType={theme}
      $isTyping={!!isTyping}
      $isMobileMenuOpen={isMobileMenuOpen}
      $timeColors={timeBasedColors}
      $isOffline={isOffline} 
    >
      {/* PHASE 4: Offline visual indicator header */}
      {isOffline && (
        <div className="offline-banner">
          ⚠️ You are currently offline. Check your internet connection.
        </div>
      )}

      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
      </button>

      {theme !== "light" && (
        <div className="mesh-gradient">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
          <div className="orb orb-3"></div>
        </div>
      )}

      {theme === "cyberpunk" && <div className="scanlines"></div>}

      <button 
        className="mobile-toggle" 
        onClick={() => {
          triggerHaptic('light'); 
          setIsMobileMenuOpen(!isMobileMenuOpen);
        }}
      >
        {isMobileMenuOpen ? "✕" : "☰"}
      </button>

      <div className={`glass-container ${isCompact ? "compact-mode" : ""}`}>
        <div className={`sidebar-wrapper ${isMobileMenuOpen ? "open" : ""}`}>
          <Contacts
            contacts={contacts}
            changeChat={handleChatChange}
            handleLogout={handleLogout}
          />
        </div>

        <div className="main-chat-wrapper">
          {!currentChat ? (
            <Welcome />
          ) : (
            <ChatContainer socket={socket} isTyping={isTyping} />
          )}
        </div>
      </div>
      <ToastContainer />
    </Container>
  );
}

// --- Styles & Animations ---
const pulseGlow = keyframes`
  0% { filter: blur(100px) brightness(1); }
  50% { filter: blur(120px) brightness(1.5); }
  100% { filter: blur(100px) brightness(1); }
`;

const meshAnimation = keyframes`
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0, 0) scale(1); }
`;

const scanlineAnim = keyframes`
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
`;

const getThemeStyles = (themeType) => {
  if (themeType === "midnight") {
    return css`
      background-color: #000000;
      .glass-container {
        background: #0a0a0a;
        border: 1px solid #1a1a1a;
        box-shadow: none;
        backdrop-filter: none;
      }
    `;
  }
  if (themeType === "cyberpunk") {
    return css`
      background-color: #0d0221;
      .glass-container {
        background: rgba(13, 2, 33, 0.85);
        border: 2px solid #00ff88;
        box-shadow: 0 0 20px rgba(0, 255, 136, 0.3), inset 0 0 10px rgba(0, 255, 136, 0.2);
      }
    `;
  }
  return css``;
};

const Container = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  position: relative;
  transition: background-color 0.5s ease;

  /* Turn grayscale if offline */
  filter: ${({ $isOffline }) => ($isOffline ? "grayscale(80%)" : "none")};

  background: ${({ $themeType, $timeColors }) =>
    $themeType === "light"
      ? "var(--bg-color)"
      : `linear-gradient(135deg, ${$timeColors[0]} 0%, ${$timeColors[1]} 100%)`};

  ${({ $themeType }) => getThemeStyles($themeType)}

  .offline-banner {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    background-color: #ff4757;
    color: white;
    text-align: center;
    padding: 0.5rem;
    font-weight: bold;
    z-index: 100;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  }

  .theme-toggle {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    z-index: 10;
    background: var(--glass-bg);
    color: var(--text-main);
    border: 1px solid var(--glass-border);
    padding: 0.6rem 1.2rem;
    border-radius: 2rem;
    font-weight: 600;
    cursor: pointer;
    backdrop-filter: var(--glass-blur);
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      background: var(--msg-sent);
      color: white;
    }
  }

  .mesh-gradient {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; z-index: 0;
    filter: blur(100px);
    ${({ $isTyping }) => $isTyping && css` animation: ${pulseGlow} 2s infinite ease-in-out; `}

    .orb {
      position: absolute; border-radius: 50%; opacity: 0.6;
      animation: ${meshAnimation} 20s infinite ease-in-out;
    }
    .orb-1 { width: 600px; height: 600px; top: -10%; left: -10%; background: var(--msg-sent); }
    .orb-2 { width: 500px; height: 500px; bottom: -10%; right: -10%; background: #00ff88; animation-delay: -5s; }
    .orb-3 { width: 400px; height: 400px; top: 30%; left: 40%; background: #ff0055; animation-delay: -10s; }
  }

  .scanlines {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2;
    pointer-events: none;
    background: linear-gradient(to bottom, transparent 50%, rgba(0, 255, 136, 0.05) 50%);
    background-size: 100% 4px;
    &::after {
      content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0, 255, 136, 0.1);
      opacity: 0.1; animation: ${scanlineAnim} 8s linear infinite;
    }
  }

  .mobile-toggle {
    display: none;
    position: absolute;
    top: 1.5rem;
    left: 1.5rem;
    z-index: 10;
    background: var(--msg-sent);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 1.2rem;
    cursor: pointer;
    backdrop-filter: var(--glass-blur);
    transition: 0.3s;
    &:hover { opacity: 0.8; }
  }

  .glass-container {
    height: 85vh;
    width: 85vw;
    border-radius: 2rem;
    display: grid;
    grid-template-columns: 25% 75%;
    overflow: hidden;
    z-index: 3;

    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    backdrop-filter: var(--glass-blur);
    box-shadow: var(--glass-shadow);
    transition: all 0.3s ease;

    &.compact-mode {
      height: 95vh;
      width: 95vw;
      border-radius: 1rem;
      grid-template-columns: 20% 80%;
    }

    .sidebar-wrapper, .main-chat-wrapper {
        height: 100%;
        width: 100%;
        overflow: hidden;
    }
  }

  @media screen and (max-width: 1080px) {
    .glass-container {
      width: 95vw;
      grid-template-columns: 30% 70%;
    }
  }

  @media screen and (max-width: 720px) {
    .mobile-toggle { display: block; }

    .glass-container {
      grid-template-columns: 100%;
      height: 100vh;
      width: 100vw;
      border-radius: 0;
    }

    .sidebar-wrapper {
      position: fixed;
      left: ${({ $isMobileMenuOpen }) => ($isMobileMenuOpen ? "0" : "-100%")};
      top: 0;
      width: 80%;
      height: 100%;
      z-index: 5;
      background: var(--bg-layout);
      transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border-right: 1px solid var(--glass-border);

      &.open {
        box-shadow: 20px 0 50px rgba(0, 0, 0, 0.8);
      }
    }

    .main-chat-wrapper {
        width: 100vw;
    }
  }
`;

const LoadingScreen = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg-color);

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--glass-border);
    border-top-color: var(--msg-sent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;