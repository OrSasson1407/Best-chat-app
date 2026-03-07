import React, { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";
import { FaComments, FaBomb, FaPalette, FaShieldAlt } from "react-icons/fa";

export default function Welcome() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    // Get the user data from sessionStorage to display the name
    const storedUser = sessionStorage.getItem("chat-app-user");
    if (storedUser) {
      setUserName(JSON.parse(storedUser).username);
    }
  }, []);

  return (
    <Container>
      <div className="hero-section">
        {/* You can replace this Robot with your actual logo if you have one */}
        <img src="https://api.dicebear.com/9.x/bottts/svg?seed=Snappy&backgroundColor=transparent" alt="Welcome Robot" className="robot-mascot" />
        <h1>
          Welcome back, <span>{userName}!</span>
        </h1>
        <p className="subtitle">Please select a friend from the left to start chatting, or explore new features below.</p>
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
          <p>Click the gear icon in the sidebar to customize your experience with Cyberpunk or Midnight modes.</p>
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
  color: white;
  height: 100%;
  width: 100%;
  padding: 2rem;
  overflow-y: auto;

  /* Matches the glassmorphism theme from your main chat */
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(10px);

  .hero-section {
    text-align: center;
    margin-bottom: 3rem;
    animation: ${popIn} 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);

    .robot-mascot {
      height: 150px;
      margin-bottom: 1.5rem;
      animation: ${float} 4s ease-in-out infinite;
      filter: drop-shadow(0 10px 15px rgba(78, 14, 255, 0.4));
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      span {
        color: #4e0eff;
        text-shadow: 0 0 20px rgba(78, 14, 255, 0.5);
      }
    }

    .subtitle {
      color: #aaa;
      font-size: 1.1rem;
      max-width: 500px;
      margin: 0 auto;
      line-height: 1.5;
    }
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
    max-width: 800px;
    width: 100%;

    @media screen and (max-width: 900px) {
      grid-template-columns: 1fr;
    }

    .feature-card {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 1.2rem;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      transition: all 0.3s ease;
      animation: ${popIn} 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards;

      /* Staggering the animations for a cool effect */
      &:nth-child(1) { animation-delay: 0.1s; }
      &:nth-child(2) { animation-delay: 0.2s; }
      &:nth-child(3) { animation-delay: 0.3s; }
      &:nth-child(4) { animation-delay: 0.4s; }

      &:hover {
        transform: translateY(-5px);
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(78, 14, 255, 0.3);
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
      }

      .icon-wrapper {
        width: 45px;
        height: 45px;
        border-radius: 12px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 1.2rem;
        margin-bottom: 0.5rem;

        &.primary { background: rgba(78, 14, 255, 0.2); color: #9a86f3; }
        &.danger { background: rgba(255, 78, 78, 0.2); color: #ff4e4e; }
        &.success { background: rgba(0, 255, 136, 0.2); color: #00ff88; }
        &.warning { background: rgba(255, 170, 0, 0.2); color: #ffaa00; }
      }

      h3 {
        font-size: 1.1rem;
        color: #fff;
        font-weight: 600;
        margin: 0;
      }

      p {
        font-size: 0.9rem;
        color: #888;
        line-height: 1.5;
        margin: 0;
      }
    }
  }
`;