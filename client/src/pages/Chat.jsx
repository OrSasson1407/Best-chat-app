import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import styled, { keyframes } from "styled-components";
import { allUsersRoute, host } from "../utils/APIRoutes";
import Contacts from "../components/Contacts";
import Welcome from "../components/Welcome";
import ChatContainer from "../components/ChatContainer";

export default function Chat() {
  const navigate = useNavigate();
  const socket = useRef();
  
  // State Initialization
  const [contacts, setContacts] = useState([]); // Init as empty array for safety
  const [currentChat, setCurrentChat] = useState(undefined);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

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

  // 2. Socket Connection & Listeners
  useEffect(() => {
    if (currentUser) {
      socket.current = io(host);
      socket.current.emit("add-user", currentUser._id);
      
      // Listen for online users update
      socket.current.on("get-online-users", (users) => {
        setOnlineUsers(users);
      });
      
      // Listen for typing status
      socket.current.on("typing-status", (data) => {
        // Only show typing if it's from the person currently selected
        if (currentChat && currentChat._id === data.from) {
          setIsTyping(data.isTyping);
        }
      });
    }
  }, [currentUser, currentChat]);

  // 3. Fetch Contacts
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
    setIsTyping(false); // Reset typing when switching chats
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/login");
  };

  return (
    <Container>
      {/* Animated Background Orbs */}
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      
      {/* Glassmorphism Main Interface */}
      <div className="glass-container">
        <Contacts 
          contacts={contacts} 
          changeChat={handleChatChange} 
          onlineUsers={onlineUsers}
          handleLogout={handleLogout}
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
            />
          )
        )}
      </div>
    </Container>
  );
}

// --- Styles & Animations ---

const float = keyframes`
  0% { transform: translate(0, 0); }
  50% { transform: translate(30px, -50px); }
  100% { transform: translate(0, 0); }
`;

const Container = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #050510;
  overflow: hidden;
  position: relative;

  /* Floating Orbs for Background */
  .bg-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    z-index: 0;
    animation: ${float} 10s infinite ease-in-out;
  }
  .orb-1 {
    width: 400px;
    height: 400px;
    background: rgba(78, 14, 255, 0.3);
    top: -10%;
    left: -10%;
  }
  .orb-2 {
    width: 350px;
    height: 350px;
    background: rgba(154, 65, 254, 0.3);
    bottom: -5%;
    right: -5%;
    animation-delay: -5s;
  }

  /* Main Glass Panel */
  .glass-container {
    height: 85vh;
    width: 85vw;
    background: rgba(255, 255, 255, 0.03); /* Translucent background */
    backdrop-filter: blur(15px); /* Frosted glass effect */
    border: 1px solid rgba(255, 255, 255, 0.1); /* Subtle border */
    border-radius: 2rem;
    display: grid;
    grid-template-columns: 25% 75%;
    overflow: hidden;
    z-index: 1;
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
    
    @media screen and (max-width: 720px) {
      grid-template-columns: 35% 65%;
      width: 95vw;
    }
  }
`;