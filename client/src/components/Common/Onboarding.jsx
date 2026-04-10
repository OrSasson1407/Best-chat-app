// client/src/components/Onboarding.jsx — Sprint 3: First-time user tutorial
import React, { useState } from "react";
import styled, { keyframes } from "styled-components";
import axios from "axios";
import { completeOnboardingRoute } from "../../utils/APIRoutes";
import useChatStore from "../../store/chatStore";

const STEPS = [
  {
    emoji: "👋",
    title: "Welcome to Snappy!",
    body: "Snappy is a fast, private, end-to-end encrypted messenger. This quick tour will show you everything you need to get started — it only takes a minute.",
    tip: null,
  },
  {
    emoji: "💬",
    title: "Start a conversation",
    body: "Tap any contact in the sidebar to open a chat. You can send text, voice notes, images, files, and even schedule messages to send later.",
    tip: "💡 Tip: Right-click any chat for quick actions like Pin, Mute, and Archive.",
  },
  {
    emoji: "👥",
    title: "Groups & Channels",
    body: "Create private groups for team chats or public channels for broadcasting. Admins can set roles, rules, and a member limit to keep things organised.",
    tip: "💡 Tip: Use /code, /bomb (self-destruct), or /clear slash commands inside any chat.",
  },
  {
    emoji: "🔒",
    title: "Your privacy, your rules",
    body: "All messages are end-to-end encrypted. You can enable Two-Factor Authentication in Settings, control who sees your last-seen and profile photo, and mute any chat.",
    tip: "💡 Tip: Enable 2FA under your profile settings for an extra layer of security.",
  },
  {
    emoji: "✨",
    title: "AI-powered features",
    body: "Snappy has built-in AI tools: grammar check your messages before sending, get quick-reply suggestions, translate messages, or ask for a chat summary.",
    tip: "💡 Tip: The ✨ button in the message bar checks your grammar before you hit send.",
  },
  {
    emoji: "📱",
    title: "Share your profile",
    body: "Every user has a unique QR code you can share to let others add you instantly — no need to search by username. Find yours in your profile settings.",
    tip: "💡 Tip: Groups also have QR invite codes — great for adding members without an invite link.",
  },
];

export default function Onboarding({ onComplete }) {
  const { currentUser, updateCurrentUser } = useChatStore();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const token = currentUser?.token || sessionStorage.getItem("chat-app-token");
      await axios.post(completeOnboardingRoute, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Update local user state so we don't re-show the tutorial
      updateCurrentUser({ onboardingDone: true });
      const stored = sessionStorage.getItem("chat-app-user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          sessionStorage.setItem("chat-app-user", JSON.stringify({ ...parsed, onboardingDone: true }));
        } catch {}
      }
    } catch (err) {
      console.error("[Onboarding] Failed to mark complete:", err);
    } finally {
      setCompleting(false);
      onComplete();
    }
  };

  return (
    <Overlay>
      <Modal>
        {/* Progress dots */}
        <Dots>
          {STEPS.map((_, i) => (
            <Dot key={i} $active={i === step} $done={i < step} onClick={() => i < step && setStep(i)} />
          ))}
        </Dots>

        {/* Step content */}
        <StepContent key={step}>
          <div className="emoji">{current.emoji}</div>
          <h2>{current.title}</h2>
          <p className="body">{current.body}</p>
          {current.tip && <div className="tip">{current.tip}</div>}
        </StepContent>

        {/* Navigation */}
        <NavRow>
          {step > 0 ? (
            <BackBtn onClick={() => setStep((s) => s - 1)}>← Back</BackBtn>
          ) : (
            <SkipBtn onClick={handleComplete}>Skip tour</SkipBtn>
          )}

          {isLast ? (
            <NextBtn $primary onClick={handleComplete} disabled={completing}>
              {completing ? "Saving…" : "Get started 🚀"}
            </NextBtn>
          ) : (
            <NextBtn $primary onClick={() => setStep((s) => s + 1)}>
              Next →
            </NextBtn>
          )}
        </NavRow>

        {/* Step counter */}
        <StepCount>{step + 1} / {STEPS.length}</StepCount>
      </Modal>
    </Overlay>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const fadeIn = keyframes`from{opacity:0;}to{opacity:1;}`;
const slideUp = keyframes`from{opacity:0;transform:translateY(24px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}`;
const stepIn = keyframes`from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:translateX(0);}`;

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 2000;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem; animation: ${fadeIn} 0.3s ease;
`;

const Modal = styled.div`
  background: var(--bg-panel); border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl); width: min(480px, 95vw);
  padding: 2rem 2.5rem 1.75rem;
  box-shadow: 0 40px 120px rgba(0,0,0,0.5);
  animation: ${slideUp} 0.35s var(--ease-spring);
  display: flex; flex-direction: column; gap: 0;
`;

const Dots = styled.div`
  display: flex; justify-content: center; gap: 8px; margin-bottom: 1.75rem;
`;

const Dot = styled.div`
  width: ${({ $active }) => $active ? "24px" : "8px"};
  height: 8px; border-radius: 99px;
  background: ${({ $active, $done }) =>
    $active ? "var(--msg-sent)" :
    $done   ? "rgba(124,58,237,0.4)" :
    "var(--border-default)"};
  transition: all 0.3s var(--ease-spring);
  cursor: ${({ $done }) => $done ? "pointer" : "default"};
`;

const StepContent = styled.div`
  display: flex; flex-direction: column; align-items: center;
  text-align: center; gap: 14px;
  animation: ${stepIn} 0.25s ease;

  .emoji { font-size: 3.5rem; line-height: 1; }

  h2 {
    font-size: var(--text-xl); font-weight: 800;
    color: var(--text-primary); margin: 0;
  }

  .body {
    font-size: var(--text-sm); color: var(--text-secondary);
    line-height: 1.7; margin: 0; max-width: 360px;
  }

  .tip {
    background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.18);
    border-radius: var(--radius-md); padding: 10px 16px;
    font-size: var(--text-xs); color: var(--msg-sent);
    font-weight: 600; line-height: 1.5; width: 100%;
    text-align: left;
  }
`;

const NavRow = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 2rem; gap: 12px;
`;

const baseBtn = `
  padding: 10px 20px; border-radius: var(--radius-md);
  font-size: var(--text-sm); font-weight: 700; cursor: pointer;
  font-family: 'Plus Jakarta Sans', sans-serif;
  transition: all var(--duration-base); border: none;
`;

const SkipBtn = styled.button`
  ${baseBtn}
  background: transparent; color: var(--text-tertiary);
  &:hover { color: var(--text-secondary); }
`;

const BackBtn = styled.button`
  ${baseBtn}
  background: var(--bg-overlay); color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  &:hover { background: var(--bg-hover); }
`;

const NextBtn = styled.button`
  ${baseBtn}
  background: ${({ $primary }) => $primary ? "var(--aurora-gradient)" : "var(--bg-overlay)"};
  color: ${({ $primary }) => $primary ? "white" : "var(--text-primary)"};
  box-shadow: ${({ $primary }) => $primary ? "0 4px 16px rgba(124,58,237,0.35)" : "none"};
  flex: 1; max-width: 200px;
  &:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const StepCount = styled.div`
  text-align: center; margin-top: 1rem;
  font-size: var(--text-xs); color: var(--text-tertiary); font-weight: 500;
`;
