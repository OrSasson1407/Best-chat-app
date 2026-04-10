// client/src/components/Welcome.jsx — REDESIGNED: Obsidian Aurora
import React, { useMemo } from "react";
import styled, { keyframes } from "styled-components";
import { motion } from "framer-motion";
import { FaComments, FaBomb, FaPalette, FaShieldAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import useChatStore from "../../store/chatStore";

const features = [
  {
    icon: <FaComments />,
    color: "violet",
    title: "Jump Right In",
    desc: "Select any chat or group from the sidebar to pick up where you left off.",
    action: () => toast.info("Select a chat from the left panel!"),
  },
  {
    icon: <FaBomb />,
    color: "rose",
    title: "Self-Destructing",
    desc: "Tap the timer icon while composing to send a message that vanishes after reading.",
    action: () => toast.info("Use the timer icon in the chat input."),
  },
  {
    icon: <FaPalette />,
    color: "teal",
    title: "Custom Themes",
    desc: "Personalize your workspace. Toggle between Light and Dark from the top-right.",
    action: null,
    isTheme: true,
  },
  {
    icon: <FaShieldAlt />,
    color: "amber",
    title: "E2E Encrypted",
    desc: "Every message is encrypted before it leaves your device. Your keys, your data.",
    action: () => toast.success("End-to-End Encryption is active ✅"),
  },
];

const colorMap = {
  violet: { bg: "rgba(124,58,237,0.12)", color: "#8b5cf6", border: "rgba(124,58,237,0.2)" },
  rose:   { bg: "rgba(244,63,94,0.12)",  color: "#f43f5e", border: "rgba(244,63,94,0.2)" },
  teal:   { bg: "rgba(20,184,166,0.12)", color: "#14b8a6", border: "rgba(20,184,166,0.2)" },
  amber:  { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
};

export default function Welcome() {
  const { currentUser, theme, setTheme } = useChatStore();
  const userName = currentUser?.username || "Guest";

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const handleCardClick = (f) => {
    if (f.isTheme) {
      const next = theme === "glass" ? "light" : "glass";
      setTheme(next); toast.success(`Switched to ${next} theme`);
    } else if (f.action) f.action();
  };

  return (
    <Wrap>
      {/* Hero */}
      <motion.div className="hero" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
        <motion.img
          src={`https://api.dicebear.com/9.x/bottts/svg?seed=${userName}&backgroundColor=transparent`}
          alt="Welcome mascot" className="mascot"
          animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          whileHover={{ scale: 1.12, rotate: [0, -8, 8, -8, 0], transition: { duration: 0.5 } }}
        />
        <div className="hero-text">
          <h1>{greeting}, <span className="accent">{userName}</span>!</h1>
          <p>Pick a conversation from the sidebar to dive in, or explore what Snappy can do.</p>
        </div>
      </motion.div>

      {/* Feature Grid */}
      <div className="grid">
        {features.map((f, i) => {
          const c = colorMap[f.color];
          return (
            <motion.div
              key={f.title} className="card"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }} onClick={() => handleCardClick(f)}
              style={{ cursor: "pointer" }}
            >
              <div className="card-icon" style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                {f.icon}
              </div>
              <div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Wrap>
  );
}

const Wrap = styled.div`
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; padding: clamp(1.5rem, 4vw, 3rem);
  gap: clamp(1.5rem, 4vh, 2.5rem); overflow-y: auto; overflow-x: hidden;

  .hero {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    max-width: 560px; width: 100%;
    background: var(--input-bg); border: 1px solid var(--glass-border);
    border-radius: 28px; padding: clamp(1.5rem,4vw,2.5rem);
    backdrop-filter: blur(12px);
  }

  .mascot {
    height: clamp(80px, 15vh, 140px); margin-bottom: 1rem;
    filter: drop-shadow(0 12px 24px rgba(0,0,0,0.25));
    cursor: pointer;
  }

  .hero-text {
    h1 { font-size: clamp(1.4rem,3.5vw,2.1rem); font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem; }
    .accent { color: var(--msg-sent); }
    p { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.7; max-width: 380px; }
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: clamp(0.75rem, 2vw, 1rem);
    max-width: 580px; width: 100%;
  }

  .card {
    background: var(--input-bg); border: 1px solid var(--glass-border);
    border-radius: 20px; padding: clamp(1rem,3vw,1.4rem);
    display: flex; flex-direction: column; gap: 10px;
    transition: all var(--duration-base) var(--ease-out);
    &:hover { border-color: var(--border-strong); box-shadow: 0 12px 30px rgba(0,0,0,0.12); }
  }

  .card-icon {
    width: 40px; height: 40px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem; flex-shrink: 0;
  }

  .card h3 { font-size: var(--text-base); font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
  .card p  { font-size: var(--text-xs); color: var(--text-secondary); line-height: 1.65; }

  @media (max-width: 480px) {
    .grid { grid-template-columns: 1fr; }
  }
`;
