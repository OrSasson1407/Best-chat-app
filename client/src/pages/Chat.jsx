import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import styled, { keyframes, css } from "styled-components";
import { allUsersRoute, host, updateFcmTokenRoute } from "../utils/APIRoutes"; 
import Contacts from "../components/Contacts";
import Welcome from "../components/Welcome";
import ChatContainer from "../components/ChatContainer";

// --- ZUSTAND GLOBAL STORE ---
import useChatStore from "../store/chatStore";
import { ToastContainer, toast } from "react-toastify";

// --- FIREBASE UTILITIES ---
import { requestForToken, onMessageListener } from "../firebase"; 

export default function Chat() {
  const navigate = useNavigate();
  const socket = useRef();
  
  // --- GLOBAL STATE ---
  const {
    currentUser, setCurrentUser,
    currentChat, setCurrentChat,
    setOnlineUsers,
    setGlobalTypingUsers,
    theme,
    isCompact
  } = useChatStore();

  // --- LOCAL COMPONENT STATE ---
  const [contacts, setContacts] = useState([]); 
  const [isLoaded, setIsLoaded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 1. Authentication Check & Data Retrieval
  useEffect(() => {
    async function checkAuth() {
      const storedData = sessionStorage.getItem("chat-app-user");
      if (!storedData) {
        navigate("/login");
      } else {
        setCurrentUser(JSON.parse(storedData));
        setIsLoaded(true);
      }
    }
    checkAuth();
  }, [navigate, setCurrentUser]);

  // 2. Setup STABLE Socket Connection
  useEffect(() => {
    if (currentUser && currentUser._id && !socket.current) {
      socket.current = io(host, {
        auth: { token: currentUser.token }
      });

      socket.current.on("connect", () => {
        socket.current.emit("add-user", currentUser._id);
      });

      socket.current.on("connect_error", (err) => {
        console.error("Socket Connection Error:", err.message);
        if (err.message.includes("Authentication error")) {
          sessionStorage.clear();
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
  }, [currentUser, navigate, setOnlineUsers]);

  // 3. Dynamic Socket Listeners
  useEffect(() => {
    if (socket.current) {
      const handleTypingStatus = (data) => {
        setGlobalTypingUsers((prev) => {
            if (data.isTyping) {
                return prev.includes(data.from) ? prev : [...prev, data.from];
            } else {
                return prev.filter(id => id !== data.from);
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
        socket.current.off("typing-status", handleTypingStatus);
      };
    }
  }, [currentChat, setGlobalTypingUsers]);

  // 4. Fetch Contacts 
  useEffect(() => {
    async function fetchContacts() {
      if (currentUser && currentUser._id) {
        try {
          const response = await axios.get(`${allUsersRoute}/${currentUser._id}`, {
            headers: { "x-auth-token": currentUser.token },
          });
          setContacts(response.data);
        } catch (error) {
          console.error("Error fetching contacts:", error);
          if (error.response?.status === 401) {
            sessionStorage.clear();
            navigate("/login");
          }
        }
      }
    }
    fetchContacts();
  }, [currentUser, navigate]);

  // 5. Firebase Push Notification Setup
  useEffect(() => {
    if (currentUser && currentUser.token) {
      const setupPushNotifications = async () => {
        const token = await requestForToken();
        if (token) {
           try {
              await axios.post(updateFcmTokenRoute, {
                 userId: currentUser._id,
                 fcmToken: token
              }, { headers: { "x-auth-token": currentUser.token } });
           } catch (err) {
              console.error("Failed to save FCM token to DB", err);
           }
        }
      };

      setupPushNotifications();

      onMessageListener()
        .then((payload) => {
          toast.info(`📬 ${payload.notification.title}: ${payload.notification.body}`, {
             position: "top-right",
             autoClose: 5000,
             hideProgressBar: false,
             closeOnClick: true,
             pauseOnHover: true,
             draggable: true,
             theme: theme === 'light' ? 'light' : 'dark',
          });
        })
        .catch((err) => console.log('Failed to listen to foreground messages: ', err));
    }
  }, [currentUser, theme]);

  const handleLogout = useCallback(async () => {
    try {
      await axios.get(`${host}/api/auth/logout`, { withCredentials: true }); 
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

  return (
    <Container 
      $themeType={theme} 
      $isTyping={!!isTyping} 
      $isMobileMenuOpen={isMobileMenuOpen}
    >
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      
      {/* Mobile Menu Toggle */}
      <button 
        className="mobile-toggle" 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
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
          {isLoaded && currentChat === undefined ? (
            <Welcome />
          ) : (
            currentChat && (
              <ChatContainer 
                socket={socket} 
                isTyping={isTyping} 
              />
            )
          )}
        </div>
      </div>
      <ToastContainer />
    </Container>
  );
}

// --- Styles & Animations ---

const float = keyframes`
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(30px, -50px) scale(1.05); }
  100% { transform: translate(0, 0) scale(1); }
`;

const pulseGlow = keyframes`
  0% { filter: blur(80px) brightness(1); }
  50% { filter: blur(100px) brightness(1.5); }
  100% { filter: blur(80px) brightness(1); }
`;

const getThemeStyles = (themeType) => {
  switch (themeType) {
    case 'light':
      return css`
        background-color: #f0f2f5;
        color: #333;
        .orb-1 { background: rgba(78, 14, 255, 0.15); }
        .orb-2 { background: rgba(0, 198, 255, 0.15); }
        .glass-container { 
          background: rgba(255, 255, 255, 0.6); 
          backdrop-filter: blur(25px); 
          border: 1px solid rgba(255, 255, 255, 0.6); 
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.05);
        }
      `;
    case 'midnight':
      return css`
        background-color: #000000;
        .bg-orb { display: none; }
        .glass-container { 
          background: #0a0a0a; 
          border: 1px solid #1a1a1a; 
          box-shadow: none; 
          backdrop-filter: none; 
        }
      `;
    case 'cyberpunk':
      return css`
        background-color: #0d0221;
        .orb-1 { background: rgba(0, 255, 136, 0.2); }
        .orb-2 { background: rgba(255, 0, 85, 0.2); }
        .glass-container { 
          background: rgba(13, 2, 33, 0.8); 
          border: 1px solid #00ff88; 
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.2); 
        }
      `;
    default: // 'glass'
      return css`
        background-color: #050510;
        .orb-1 { background: rgba(78, 14, 255, 0.3); }
        .orb-2 { background: rgba(154, 65, 254, 0.3); }
        .glass-container { 
          background: rgba(255, 255, 255, 0.03); 
          backdrop-filter: blur(20px); 
          border: 1px solid rgba(255, 255, 255, 0.1); 
        }
      `;
  }
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

  ${({ $themeType }) => getThemeStyles($themeType)}

  .mobile-toggle {
    display: none;
    position: absolute;
    top: 1.5rem;
    left: 1.5rem;
    z-index: 10;
    background: rgba(78, 14, 255, 0.8);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 1.2rem;
    cursor: pointer;
    backdrop-filter: blur(10px);
    transition: 0.3s;
    &:hover { background: #4e0eff; }
  }

  .bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    z-index: 0;
    animation: ${float} 10s infinite ease-in-out;
    ${({ $isTyping }) => $isTyping && css` animation: ${pulseGlow} 2s infinite ease-in-out; `}
  }
  
  .orb-1 { width: 400px; height: 400px; top: -10%; left: -10%; }
  .orb-2 { width: 350px; height: 350px; bottom: -5%; right: -5%; animation-delay: -5s; }

  .glass-container {
    height: 85vh;
    width: 85vw;
    border-radius: 2rem;
    display: grid;
    grid-template-columns: 25% 75%;
    overflow: hidden;
    z-index: 1;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
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

  /* Responsive Logic */
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
      background: ${({ $themeType }) => $themeType === 'light' ? '#fff' : '#050510'};
      transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      
      &.open {
        box-shadow: 20px 0 50px rgba(0, 0, 0, 0.8);
      }
    }

    .main-chat-wrapper {
        width: 100vw;
    }
  }
`;