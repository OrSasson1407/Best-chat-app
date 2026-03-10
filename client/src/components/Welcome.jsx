import React, { useMemo } from "react";
import styled, { keyframes, css } from "styled-components";
import { FaComments, FaBomb, FaPalette, FaShieldAlt } from "react-icons/fa";
import useChatStore from "../store/chatStore";

export default function Welcome() {
  const { currentUser, theme } = useChatStore();
  const userName = currentUser?.username || "Guest";

  // Dynamic time-based greeting
  const greeting = useMemo(() => {
    const currentHour = new Date().getHours();
    if (currentHour >= 5 && currentHour < 12) return "Good morning";
    if (currentHour >= 12 && currentHour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <Container $themeType={theme}>
      <div className="hero-section">
        {/* Personalized robot mascot based on the user's name */}
        <img 
          src={`https://api.dicebear.com/9.x/bottts/svg?seed=${userName}&backgroundColor=transparent`} 
          alt="Welcome Robot" 
          className="robot-mascot" 
        />
        <h1>
          {greeting}, <span className="accent-text">{userName}!</span>
        </h1>
        <p className="subtitle">
          Please select a friend from the left to start chatting, or explore new features below.
        </p>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="icon-wrapper primary"><FaComments /></div>
          <h3>Jump Right In</h3>
          <p>Select a personal chat or a group from your folders to continue the conversation.</p>
        </div>

        <div className="feature-card">
          <div className="icon-wrapper danger"><FaBomb /></div>
          <h3>Self-Destructing</h3>
          <p>Use the timer icon in the chat input to send messages that vanish after being read.</p>
        </div>

        <div className="feature-card">
          <div className="icon-wrapper success"><FaPalette /></div>
          <h3>Custom Themes</h3>
          <p>Click the gear icon in the sidebar to customize your experience with Cyberpunk or Light modes.</p>
        </div>

        <div className="feature-card">
          <div className="icon-wrapper warning"><FaShieldAlt /></div>
          <h3>Private & Secure</h3>
          <p>Your chats are secure. You can block unwanted contacts directly from the chat menu.</p>
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
  0% { transform: scale(0.9) translateY(20px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

// --- Styled Components ---
const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  /* Dynamically uses the text variable */
  color: var(--text-main); 
  height: 100%;
  width: 100%;
  padding: 2rem;
  overflow-y: auto;
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

  .hero-section {
    text-align: center;
    margin-bottom: 3rem;
    animation: ${popIn} 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    width: 100%;

    .robot-mascot {
      height: 150px;
      margin-bottom: 1.5rem;
      animation: ${float} 4s ease-in-out infinite;
      filter: drop-shadow(0 15px 25px rgba(0, 0, 0, 0.2));
      
      ${({ $themeType }) => $themeType === 'cyberpunk' && css`
        filter: drop-shadow(0 10px 20px rgba(0, 255, 136, 0.2));
      `}
    }

    h1 {
      font-size: 2.2rem;
      margin-bottom: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.5px;
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
      font-size: 1.1rem;
      max-width: 520px;
      margin: 0 auto;
      line-height: 1.6;
      font-weight: 400;
    }
  }

  .features-grid {
    display: grid;
    /* STRICT 2-COLUMN GRID: Prevents layout breaking on browser zoom */
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    max-width: 800px;
    width: 100%;

    /* Only stack on literal mobile phones (very small widths) */
    @media screen and (max-width: 550px) {
      grid-template-columns: 1fr;
    }

    .feature-card {
      /* Replaced hardcoded transparent background with variables */
      background: var(--input-bg);
      border: 1px solid var(--glass-border);
      border-radius: 1.5rem;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      animation: ${popIn} 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;
      backdrop-filter: blur(12px);

      /* Staggering the animations */
      &:nth-child(1) { animation-delay: 0.1s; }
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.3s; }
      &:nth-child(4) { animation-delay: 0.4s; }

      &:hover {
        transform: translateY(-8px);
        filter: brightness(0.95);
        border-color: var(--msg-sent);
        box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css`
          border-color: rgba(0, 255, 136, 0.4); box-shadow: 0 15px 30px rgba(0, 255, 136, 0.1);
        `}
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
        font-size: 1.1rem;
        color: var(--text-main);
        font-weight: 700;
        margin: 0;
        letter-spacing: 0.3px;
      }

      p {
        font-size: 0.9rem;
        color: var(--text-dim);
        line-height: 1.6;
        margin: 0;
      }
    }
  }
`;