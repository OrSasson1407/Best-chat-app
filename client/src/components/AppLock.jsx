// client/src/components/AppLock.jsx
import React, { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import { FaLock, FaUnlock, FaBackspace } from "react-icons/fa";

// Constants for easy configuration
const PIN_STORAGE_KEY = "app-pin-code";
const PIN_LENGTH = 4;

export default function AppLock({ children }) {
  // IMPROVEMENT 1: Synchronous initialization to prevent content flicker
  // We check local storage immediately on mount instead of waiting for useEffect
  const savedPin = localStorage.getItem(PIN_STORAGE_KEY);
  const [isLocked, setIsLocked] = useState(() => !!savedPin);
  
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  // Wrap verifyPin in useCallback to prevent unnecessary re-creations
  const verifyPin = useCallback((enteredPin) => {
    if (enteredPin === savedPin) {
      setIsLocked(false);
      setPin("");
    } else {
      setError(true);
      // Clear pin after a brief delay on error
      setTimeout(() => setPin(""), 500); 
    }
  }, [savedPin]);

  const handleKeyPress = useCallback((key) => {
    setPin((prev) => {
      // Only accept input if we haven't reached the max length and no error is currently animating
      if (prev.length < PIN_LENGTH && !error) {
        const newPin = prev + key;
        
        // If we hit the required length, verify immediately
        if (newPin.length === PIN_LENGTH) {
          verifyPin(newPin);
        }
        return newPin;
      }
      return prev;
    });
    setError(false);
  }, [error, verifyPin]);

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  }, []);

  // IMPROVEMENT 2: Physical Keyboard Support
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e) => {
      // Check if key is a number from 0-9
      if (/^[0-9]$/.test(e.key)) {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLocked, handleKeyPress, handleDelete]);

  // If not locked, render the actual application
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <LockScreen>
      <div className="lock-container">
        <FaLock className={`lock-icon ${error ? "shake" : ""}`} />
        <h2>App Locked</h2>
        <p>Enter your PIN to access Snappy</p>

        <div className="pin-display">
          {[...Array(PIN_LENGTH)].map((_, i) => (
            <div 
              key={i} 
              className={`pin-dot ${pin.length > i ? "filled" : ""} ${error ? "error" : ""}`} 
            />
          ))}
        </div>

        <div className="keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button key={num} onClick={() => handleKeyPress(num.toString())}>
              {num}
            </button>
          ))}
          <button className="empty" disabled aria-hidden="true"></button>
          <button onClick={() => handleKeyPress("0")}>0</button>
          
          {/* IMPROVEMENT 3: Added aria-label for accessibility */}
          <button onClick={handleDelete} className="delete-btn" aria-label="Delete last digit">
            <FaBackspace />
          </button>
        </div>
      </div>
    </LockScreen>
  );
}

// Styles remain unchanged
const LockScreen = styled.div`
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: #131324;
  display: flex; justify-content: center; align-items: center;
  z-index: 9999;
  color: white;

  .lock-container {
    display: flex; flex-direction: column; align-items: center;
    background: rgba(0, 0, 0, 0.4); padding: 3rem; border-radius: 2rem;
    border: 1px solid rgba(78, 14, 255, 0.2);
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  .lock-icon { font-size: 3rem; color: #4e0eff; margin-bottom: 1rem; }
  h2 { margin-bottom: 0.5rem; letter-spacing: 1px; }
  p { color: #888; margin-bottom: 2rem; font-size: 0.9rem; }

  .pin-display {
    display: flex; gap: 1rem; margin-bottom: 2.5rem;
    .pin-dot {
      width: 15px; height: 15px; border-radius: 50%;
      border: 2px solid #4e0eff; transition: 0.2s;
      &.filled { background: #4e0eff; }
      &.error { border-color: #ff4b4b; background: #ff4b4b; }
    }
  }

  .keypad {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;
    button {
      width: 60px; height: 60px; border-radius: 50%;
      background: rgba(255, 255, 255, 0.05); border: 1px solid transparent;
      color: white; font-size: 1.5rem; cursor: pointer; transition: 0.2s;
      display: flex; justify-content: center; align-items: center;
      &:hover { background: rgba(78, 14, 255, 0.2); border-color: #4e0eff; transform: scale(1.1); }
      &:active { transform: scale(0.95); }
      &.empty { background: transparent; cursor: default; &:hover { border: none; transform: none; } }
      &.delete-btn { font-size: 1.2rem; color: #ff4b4b; }
    }
  }

  .shake {
    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
  }

  @keyframes shake {
    10%, 90% { transform: translate3d(-2px, 0, 0); }
    20%, 80% { transform: translate3d(3px, 0, 0); }
    30%, 50%, 70% { transform: translate3d(-5px, 0, 0); }
    40%, 60% { transform: translate3d(5px, 0, 0); }
  }
`;