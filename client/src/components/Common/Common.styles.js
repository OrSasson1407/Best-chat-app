import styled, { keyframes, css } from "styled-components";

const orbFloat = keyframes`
  0%   { transform: translate(0,0) scale(1); }
  25%  { transform: translate(35px,-50px) scale(1.06); }
  50%  { transform: translate(-18px,25px) scale(0.95); }
  75%  { transform: translate(28px,18px) scale(1.02); }
  100% { transform: translate(0,0) scale(1); }
`;

const fadeInScale = keyframes`
  from { opacity: 0; transform: scale(0.97) translateY(12px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
`;

export const AppShellWrapper = styled.div`
  height: 100vh; width: 100vw;
  display: flex; align-items: center; justify-content: center;
  position: relative; overflow: hidden;
  background: var(--bg-root);
  background-image: ${({ $theme }) => $theme !== "light" ? "var(--mesh-gradient)" : "none"};
  transition: filter var(--duration-slow) var(--ease-out);
  filter: ${({ $isOffline }) => $isOffline ? "saturate(0.3) brightness(0.85)" : "none"};

  .aurora-bg {
    position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden;
    .orb { position: absolute; border-radius: 50%; pointer-events: none; animation: ${orbFloat} 22s ease-in-out infinite; }
    .orb-1 { width: min(700px,80vw); height: min(700px,80vw); top: -15%; left: -12%;
              background: radial-gradient(circle, rgba(124,58,237,0.28), transparent 70%);
              filter: blur(70px); animation-duration: 20s; }
    .orb-2 { width: min(600px,70vw); height: min(600px,70vw); bottom: -18%; right: -12%;
              background: radial-gradient(circle, rgba(99,102,241,0.22), transparent 70%);
              filter: blur(80px); animation-duration: 27s; animation-delay: -8s; }
    .orb-3 { width: min(400px,50vw); height: min(400px,50vw); top: 40%; left: 42%;
              background: radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%);
              filter: blur(90px); animation-duration: 35s; animation-delay: -15s; }
  }

  .offline-banner {
    position: absolute; top: 0; left: 0; right: 0; z-index: 50;
    background: linear-gradient(90deg, #ff5c72, #ff8c6e);
    color: white; text-align: center;
    padding: 8px 16px; font-size: var(--text-xs); font-weight: 600;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    .dot { width: 7px; height: 7px; border-radius: 50%; background: white; animation: ${pulse} 1.5s infinite; }
  }

  .theme-toggle {
    position: absolute; top: 1.2rem; right: 1.2rem; z-index: 20;
    display: flex; align-items: center; gap: 6px;
    background: var(--glass-bg); color: var(--text-primary);
    border: 1px solid var(--glass-border);
    padding: 7px 14px; border-radius: var(--radius-full);
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: var(--text-xs); font-weight: 600; cursor: pointer;
    backdrop-filter: var(--glass-blur); transition: all var(--duration-base) var(--ease-out);
    &:hover { transform: translateY(-2px); background: var(--msg-sent); color: white; border-color: transparent; box-shadow: 0 8px 24px rgba(124,58,237,0.35); }
    @media (max-width: 480px) { span { display: none; } padding: 8px; }
  }

  .mobile-nav-btn {
    display: none; position: absolute; top: 1.2rem; left: 1.2rem; z-index: 20;
    background: var(--glass-bg); color: var(--text-primary);
    border: 1px solid var(--glass-border); border-radius: var(--radius-md);
    width: 40px; height: 40px; cursor: pointer;
    backdrop-filter: var(--glass-blur); transition: all var(--duration-base) var(--ease-out);
    align-items: center; justify-content: center;
    &:hover { background: var(--msg-sent); color: white; border-color: transparent; }
    @media (max-width: 768px) { display: flex; }
  }

  .app-card {
    height: 88vh; width: min(88vw, 1440px);
    border-radius: 28px;
    display: grid;
    grid-template-columns: 300px 1fr;
    overflow: hidden;
    position: relative; z-index: 5;
    animation: ${fadeInScale} 0.5s var(--ease-spring);

    &.compact {
      grid-template-columns: 72px 1fr;
      height: 94vh; width: min(94vw, 1440px);
      border-radius: 20px;
    }

    @media (max-width: 1280px) { width: 94vw; }
    @media (max-width: 1024px) { grid-template-columns: 260px 1fr; }
    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      height: 100vh; width: 100vw;
      border-radius: 0;
    }
  }

  .sidebar-backdrop {
    display: none;
    @media (max-width: 768px) {
      display: block; position: fixed; inset: 0; z-index: 8;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
    }
  }

  .sidebar-wrapper {
    height: 100%; overflow: hidden;
    border-right: 1px solid var(--glass-border);
    transition: transform var(--duration-slow) var(--ease-spring);

    @media (max-width: 768px) {
      position: fixed; top: 0; left: 0;
      width: 82%; max-width: 320px; height: 100%; z-index: 9;
      transform: translateX(-105%);
      background: var(--bg-surface);
      border-right: 1px solid var(--glass-border);
      box-shadow: 20px 0 60px rgba(0,0,0,0.4);
      &.open { transform: translateX(0); }
    }
  }

  .chat-wrapper {
    height: 100%; overflow: hidden;
    @media (max-width: 768px) { width: 100%; }
  }
`;

export const LoadingScreen = styled.div`
  height: 100vh; width: 100vw;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-root); background-image: var(--mesh-gradient);

  .spinner-wrap {
    position: relative; display: flex; align-items: center; justify-content: center;
    width: 80px; height: 80px;
  }
  .logo-mark {
    font-family: "Plus Jakarta Sans", sans-serif;
    font-size: 1.8rem; font-weight: 800; color: var(--text-primary); z-index: 2;
  }
  .spinner {
    position: absolute; inset: 0;
    border: 2.5px solid var(--glass-border);
    border-top-color: var(--msg-sent);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
