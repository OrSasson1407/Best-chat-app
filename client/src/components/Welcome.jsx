import React, { useMemo, useState } from "react";
import styled, { keyframes, css } from "styled-components";
import { motion } from "framer-motion"; // <-- Added Framer Motion
import { FaComments, FaBomb, FaPalette, FaShieldAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import useChatStore from "../store/chatStore";

export default function Welcome() {
  const { currentUser, theme, setTheme } = useChatStore();
  const userName = currentUser?.username || "Guest";

  // State to track mouse position for the Spotlight hover effect
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const { currentTarget, clientX, clientY } = e;
    const { left, top } = currentTarget.getBoundingClientRect();
    setMousePos({
      x: clientX - left,
      y: clientY - top,
    });
  };

  // Dynamic time-based greeting
  const greeting = useMemo(() => {
    const currentHour = new Date().getHours();
    if (currentHour >= 5 && currentHour < 12) return "Good morning";
    if (currentHour >= 12 && currentHour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // Action Handlers for the feature cards
  const handleCardClick = (action) => {
      if (action === 'theme') {
          const nextTheme = theme === 'glass' ? 'midnight' : theme === 'midnight' ? 'cyberpunk' : theme === 'cyberpunk' ? 'light' : 'glass';
          setTheme(nextTheme);
          toast.success(`Theme changed to ${nextTheme.charAt(0).toUpperCase() + nextTheme.slice(1)}!`);
      } else if (action === 'secure') {
          toast.info("End-to-End Encryption is active.");
      }
  };

  return (
    <Container $themeType={theme}>
      <div className="hero-pedestal">
        <motion.img 
          src={`https://api.dicebear.com/9.x/bottts/svg?seed=${userName}&backgroundColor=transparent`} 
          alt="Welcome Robot" 
          className="robot-mascot" 
          whileHover={{ 
            scale: 1.15, 
            rotate: [0, -10, 10, -10, 10, 0],
            transition: { duration: 0.5 }
          }}
        />
        <h1>
          {greeting}, <span className="accent-text">{userName}!</span>
        </h1>
        <p className="subtitle">
          Please select a friend from the left to start chatting, or explore new features below.
        </p>
      </div>

      <div 
        className="features-grid" 
        onMouseMove={handleMouseMove}
        style={{ '--mouse-x': `${mousePos.x}px`, '--mouse-y': `${mousePos.y}px` }}
      >
        <div className="feature-card" onClick={() => toast.info("Select a chat from the left panel!")}>
          <div className="spotlight-overlay"></div>
          <div className="content-wrapper">
              <div className="icon-wrapper primary"><FaComments /></div>
              <h3>Jump Right In</h3>
              <p>Select a personal chat or a group from your folders to continue the conversation.</p>
          </div>
        </div>

        <div className="feature-card" onClick={() => toast.info("Send a message and click the timer icon.")}>
          <div className="spotlight-overlay"></div>
          <div className="content-wrapper">
              <div className="icon-wrapper danger"><FaBomb /></div>
              <h3>Self-Destructing</h3>
              <p>Use the timer icon in the chat input to send messages that vanish after being read.</p>
          </div>
        </div>

        <div className="feature-card clickable" onClick={() => handleCardClick('theme')}>
          <div className="spotlight-overlay"></div>
          <div className="content-wrapper">
              <div className="icon-wrapper success"><FaPalette /></div>
              <h3>Custom Themes</h3>
              <p>Click here to instantly cycle through our custom dynamic themes.</p>
          </div>
        </div>

        <div className="feature-card clickable" onClick={() => handleCardClick('secure')}>
          <div className="spotlight-overlay"></div>
          <div className="content-wrapper">
              <div className="icon-wrapper warning"><FaShieldAlt /></div>
              <h3>Private & Secure</h3>
              <p>Your chats are locked down. You can block unwanted contacts directly from the menu.</p>
          </div>
        </div>
      </div>
    </Container>
  );
}

// --- Animations ---
const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
  100% { transform: translateY(0px); }
`;

const popIn = keyframes`
  0% { transform: scale(0.95) translateY(20px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

// --- Styled Components ---
const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  color: var(--text-main); 
  height: 100%;
  width: 100%;
  
  /* --- IDEA 1: FLUID LAYOUT USING CLAMP --- */
  padding: clamp(1rem, 5vh, 4rem);
  gap: clamp(1.5rem, 5vh, 4rem);
  
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  z-index: 1;
  box-sizing: border-box;

  /* Dynamically uses the background variable */
  background: transparent; 

  /* Dynamic Extra Themes */
  ${({ $themeType }) => $themeType === 'midnight' && css`
    background: #050505;
  `}

  ${({ $themeType }) => $themeType === 'cyberpunk' && css`
    background: rgba(10, 5, 20, 0.9);
    &::before {
      content: ""; position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: -1;
      background-image: 
        linear-gradient(rgba(0, 255, 136, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 255, 136, 0.03) 1px, transparent 1px);
      background-size: 30px 30px;
    }
  `}

  /* --- IDEA 5: GLASSMORPHIC PEDESTAL --- */
  .hero-pedestal {
    text-align: center;
    width: 100%;
    max-width: 800px;
    animation: ${popIn} 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    
    background: linear-gradient(180deg, var(--input-bg) 0%, transparent 100%);
    border-top: 1px solid var(--glass-border);
    border-radius: 32px;
    padding: clamp(2rem, 5vh, 4rem) 2rem;
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 40px rgba(0,0,0,0.05);

    .robot-mascot {
      /* Fluid image sizing */
      height: clamp(100px, 18vh, 160px);
      margin-bottom: 1rem;
      animation: ${float} 6s ease-in-out infinite;
      filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.2));
      cursor: pointer;
      
      ${({ $themeType }) => $themeType === 'cyberpunk' && css`
        filter: drop-shadow(0 10px 20px rgba(0, 255, 136, 0.2));
      `}
    }

    h1 {
      /* Fluid typography */
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      margin-bottom: 0.8rem;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: var(--text-main);
      
      .accent-text {
        color: var(--msg-sent);
        ${({ $themeType }) => $themeType === 'cyberpunk' && css`
          color: #00ff88; text-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
        `}
      }
    }

    .subtitle {
      color: var(--text-dim);
      font-size: clamp(0.9rem, 1.5vw, 1.1rem);
      max-width: 520px;
      margin: 0 auto;
      line-height: 1.6;
      font-weight: 500;
    }
  }

  .features-grid {
    display: grid;
    /* Responsive Grid: Automatically switches from 2 columns to 1 on small heights or widths */
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: clamp(1rem, 2vh, 1.5rem);
    max-width: 800px;
    width: 100%;
    position: relative;

    .feature-card {
      background: var(--input-bg);
      border: 1px solid var(--glass-border);
      border-radius: 1.5rem;
      padding: clamp(1.2rem, 3vh, 1.8rem);
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      animation: ${popIn} 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;
      backdrop-filter: blur(12px);
      
      position: relative;
      overflow: hidden;

      &.clickable { cursor: pointer; }

      /* --- IDEA 2: SPOTLIGHT HOVER EFFECT --- */
      &::before {
        content: "";
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        border-radius: inherit;
        padding: 2px; /* thickness of the border glow */
        background: radial-gradient(
          600px circle at var(--mouse-x) var(--mouse-y), 
          var(--msg-sent),
          transparent 40%
        );
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        opacity: 0;
        transition: opacity 0.3s;
      }

      .spotlight-overlay {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: radial-gradient(
          800px circle at var(--mouse-x) var(--mouse-y), 
          rgba(255,255,255,0.04),
          transparent 40%
        );
        opacity: 0;
        transition: opacity 0.3s;
        z-index: 0;
      }

      /* Staggering the animations */
      &:nth-child(1) { animation-delay: 0.1s; }
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.3s; }
      &:nth-child(4) { animation-delay: 0.4s; }

      &:hover {
        transform: translateY(-4px);
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
        &::before { opacity: 1; }
        .spotlight-overlay { opacity: 1; }
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css`
          box-shadow: 0 15px 30px rgba(0, 255, 136, 0.1);
        `}
      }

      .content-wrapper {
        position: relative;
        z-index: 1;
        pointer-events: none; /* Let the card handle the hover */
      }

      .icon-wrapper {
        width: 45px;
        height: 45px;
        border-radius: 14px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.2rem;
        margin-bottom: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

        &.primary { background: rgba(78, 14, 255, 0.2); color: #9a86f3; border: 1px solid rgba(78, 14, 255, 0.3); }
        &.danger { background: rgba(255, 78, 78, 0.15); color: #ff4e4e; border: 1px solid rgba(255, 78, 78, 0.3); }
        &.success { background: rgba(0, 255, 136, 0.15); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); }
        &.warning { background: rgba(255, 170, 0, 0.15); color: #ffaa00; border: 1px solid rgba(255, 170, 0, 0.3); }
      }

      h3 {
        font-size: clamp(1rem, 2vw, 1.1rem);
        color: var(--text-main);
        font-weight: 700;
        margin: 0;
        letter-spacing: 0.3px;
      }

      p {
        font-size: clamp(0.85rem, 1.5vw, 0.9rem);
        color: var(--text-dim);
        line-height: 1.6;
        margin: 0;
      }
    }
  }
`;