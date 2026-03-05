import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import styled, { keyframes, css } from "styled-components";
import { allUsersRoute, host } from "../utils/APIRoutes";
import Contacts from "../components/Contacts";
import Welcome from "../components/Welcome";
import ChatContainer from "../components/ChatContainer";

export default function Chat() {
  const navigate = useNavigate();
  const socket = useRef();
  
  // State Initialization
  const [contacts, setContacts] = useState([]); 
  const [currentChat, setCurrentChat] = useState(undefined);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  
  // Holds the username string instead of a boolean
  const [isTyping, setIsTyping] = useState(false);

  // NEW: UI State Management (Themes & Compact Mode)
  const [theme, setTheme] = useState(localStorage.getItem("chat-theme") || "glass");
  const [isCompact, setIsCompact] = useState(localStorage.getItem("chat-compact") === "true");

  // Persist UI preferences
  useEffect(() => {
    localStorage.setItem("chat-theme", theme);
    localStorage.setItem("chat-compact", isCompact);
  }, [theme, isCompact]);

  // 1. Authentication Check
  useEffect(() => {
    async function checkAuth() {
      const storedUser = sessionStorage.getItem("chat-app-user");
      if (!storedUser) {
        navigate("/login");
      } else {
        setCurrentUser(JSON.parse(storedUser));
        setIsLoaded(true);
      }
    }
    checkAuth();
  }, [navigate]);

  // 2. Socket Connection & Global Listeners
  useEffect(() => {
    if (currentUser) {
      socket.current = io(host);
      socket.current.emit("add-user", currentUser._id);
      
      // Listen for online users
      socket.current.on("get-online-users", (users) => {
        setOnlineUsers(users);
      });
      
      // Listen for typing events and store the specific username
      socket.current.on("typing-status", (data) => {
        if (currentChat) {
            if (data.isGroup) {
                setIsTyping(data.isTyping ? data.username : false);
            } else {
                if (currentChat._id === data.from) {
                    setIsTyping(data.isTyping ? data.username : false);
                }
            }
        }
      });
    }
  }, [currentUser, currentChat]);

  // 3. Fetch Contacts (Initial 1-on-1 list)
  useEffect(() => {
    async function fetchContacts() {
      if (currentUser) {
        try {
          const data = await axios.get(`${allUsersRoute}/${currentUser._id}`);
          setContacts(data.data);
        } catch (error) {
          console.error("Error fetching contacts:", error);
        }
      }
    }
    fetchContacts();
  }, [currentUser]);

  // Handlers
  const handleChatChange = (chat) => {
    setCurrentChat(chat);
    setIsTyping(false); // Reset typing status when switching chats
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  return (
    // UPDATED: Used $ prefix for styled-components specific props to prevent DOM warnings
    <Container $themeType={theme} $isTyping={!!isTyping}>
      {/* Animated Background Orbs */}
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      
      {/* Main Interface */}
      <div className={`glass-container ${isCompact ? "compact-mode" : ""}`}>
        <Contacts 
          contacts={contacts} 
          currentUser={currentUser} 
          changeChat={handleChatChange} 
          onlineUsers={onlineUsers}
          handleLogout={handleLogout}
          theme={theme}
          setTheme={setTheme}
          isCompact={isCompact}
          setIsCompact={setIsCompact}
        />
        
        {isLoaded && currentChat === undefined ? (
          <Welcome />
        ) : (
          currentChat && (
            <ChatContainer 
              currentChat={currentChat} 
              currentUser={currentUser} 
              socket={socket} 
              isTyping={isTyping} 
              theme={theme}
              isCompact={isCompact}
            />
          )
        )}
      </div>
    </Container>
  );
}

// --- Styles & Animations ---

const float = keyframes`
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(30px, -50px) scale(1.05); }
  100% { transform: translate(0, 0) scale(1); }
`;

// Adaptive pulse when someone is typing
const pulseGlow = keyframes`
  0% { filter: blur(80px) brightness(1); }
  50% { filter: blur(100px) brightness(1.5); }
  100% { filter: blur(80px) brightness(1); }
`;

// Theme-specific logic
const getThemeStyles = (themeType) => {
  switch (themeType) {
    case 'midnight':
      return css`
        background-color: #000000;
        .bg-orb { display: none; } /* Hide orbs for full OLED blacks */
        .glass-container { background: #0a0a0a; border: 1px solid #1a1a1a; box-shadow: none; backdrop-filter: none; }
      `;
    case 'cyberpunk':
      return css`
        background-color: #0d0221;
        .orb-1 { background: rgba(0, 255, 136, 0.2); }
        .orb-2 { background: rgba(255, 0, 85, 0.2); }
        .glass-container { background: rgba(13, 2, 33, 0.8); border: 1px solid #00ff88; box-shadow: 0 0 20px rgba(0, 255, 136, 0.2); }
      `;
    default: // glass (default)
      return css`
        background-color: #050510;
        .orb-1 { background: rgba(78, 14, 255, 0.3); }
        .orb-2 { background: rgba(154, 65, 254, 0.3); }
        .glass-container { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); }
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

  /* UPDATED: Apply dynamic theme variables using transient prop $themeType */
  ${({ $themeType }) => getThemeStyles($themeType)}

  /* Floating Background Orbs */
  .bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    z-index: 0;
    animation: ${float} 10s infinite ease-in-out;
    
    /* UPDATED: Adaptive Background: Pulses when user is typing */
    ${({ $isTyping }) => $isTyping && css` animation: ${pulseGlow} 2s infinite ease-in-out; `}
  }
  
  .orb-1 {
    width: 400px;
    height: 400px;
    top: -10%;
    left: -10%;
  }
  
  .orb-2 {
    width: 350px;
    height: 350px;
    bottom: -5%;
    right: -5%;
    animation-delay: -5s;
  }

  /* Main Glass Panel */
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

    @media screen and (max-width: 720px) {
      grid-template-columns: 35% 65%;
      width: 95vw;
      
      &.compact-mode {
        grid-template-columns: 30% 70%;
      }
    }
  }
`;