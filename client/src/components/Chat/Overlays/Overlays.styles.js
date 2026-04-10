import styled, { keyframes } from "styled-components";

const springyPop = keyframes`
  0%   { transform: scale(0.85) translateY(10px); opacity: 0; }
  70%  { transform: scale(1.02) translateY(-2px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

const pulseBorder = keyframes`
  0%   { border-color: rgba(124, 58, 237, 0.3); box-shadow: 0 0 0 rgba(124,58,237,0); }
  50%  { border-color: rgba(124, 58, 237, 1);   box-shadow: 0 0 24px rgba(124,58,237,0.35); }
  100% { border-color: rgba(124, 58, 237, 0.3); box-shadow: 0 0 0 rgba(124,58,237,0); }
`;

// ── DROP OVERLAY ─────────────────────────────────────────────
export const DropOverlay = styled.div`
  position: absolute; top: 10px; left: 10px;
  width: calc(100% - 20px); height: calc(100% - 20px);
  background: rgba(13,17,23,0.82); backdrop-filter: blur(16px);
  z-index: 100; display: flex; justify-content: center; align-items: center;
  border: 2px dashed var(--msg-sent); border-radius: var(--radius-xl);
  animation: ${pulseBorder} 2s infinite ease-in-out;

  .overlay-content {
    text-align: center; color: var(--text-primary);
    animation: ${springyPop} 0.4s var(--ease-spring);
    background: var(--glass-noise), var(--bg-panel);
    padding: 2.5rem 3.5rem; border-radius: var(--radius-xl);
    box-shadow: var(--glass-shadow); border: 1px solid var(--glass-border);
    h2 { margin: 1rem 0; font-weight: 800; font-size: var(--text-xl); }
    p { color: var(--text-secondary); font-size: var(--text-sm); }
  }
`;

// ── LIGHTBOX ─────────────────────────────────────────────────
export const LightboxOverlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.9); z-index: var(--z-modal);
  display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(12px); animation: fadeIn 0.2s var(--ease-out);
  @keyframes fadeIn { from{opacity:0;} to{opacity:1;} }

  img {
    max-width: min(90%, 900px); max-height: 88vh;
    border-radius: var(--radius-lg); box-shadow: 0 24px 80px rgba(0,0,0,0.6);
  }

  .close-btn {
    position: absolute; top: 24px; right: 24px;
    background: var(--bg-overlay); border-radius: 50%;
    width: 46px; height: 46px; display: flex; justify-content: center; align-items: center;
    border: 1px solid var(--glass-border); color: var(--text-primary);
    font-size: var(--text-lg); cursor: pointer; transition: all var(--duration-fast) var(--ease-spring);
    &:hover { transform: scale(1.1); background: var(--color-danger); color: white; border-color: transparent; }
  }

  .receipt-modal {
    background: var(--glass-noise), var(--bg-panel); padding: 2rem;
    border-radius: var(--radius-xl); width: min(400px, 92vw);
    border: 1px solid var(--glass-border); box-shadow: var(--glass-shadow);
    position: relative; color: var(--text-primary);
    animation: slideUp 0.3s var(--ease-spring);
    @keyframes slideUp { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }

    .close-btn-small {
      position: absolute; top: 16px; right: 16px;
      background: var(--input-bg); border-radius: 50%;
      width: 30px; height: 30px; display: flex; justify-content: center; align-items: center;
      border: none; color: var(--text-secondary); cursor: pointer; font-size: var(--text-base);
      transition: all var(--duration-fast);
      &:hover { color: var(--color-danger); transform: scale(1.1); }
    }

    h3 {
      margin-bottom: 1rem; border-bottom: 1px solid var(--glass-border);
      padding-bottom: 12px; font-weight: 800; font-size: var(--text-md);
    }
    .msg-preview {
      background: var(--input-bg); padding: 12px; border-radius: var(--radius-md);
      font-style: italic; color: var(--text-secondary); font-size: var(--text-xs);
      margin-bottom: 1.5rem; border-left: 3px solid var(--color-read-tick);
    }

    .readers-list {
      max-height: 280px; overflow-y: auto; padding-right: 4px;
      &::-webkit-scrollbar { width: 4px; }
      &::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 99px; }

      h4 {
        color: var(--color-read-tick); display: flex; align-items: center; gap: 6px;
        margin-bottom: 1rem; font-weight: 700; font-size: var(--text-xs);
        text-transform: uppercase; letter-spacing: 0.6px;
      }

      .reader-item {
        display: flex; align-items: center; gap: 12px;
        background: var(--input-bg); padding: 10px 12px;
        border-radius: var(--radius-md); margin-bottom: 8px;
        transition: all var(--duration-fast); border: 1px solid transparent;
        &:hover { border-color: var(--glass-border); transform: translateX(4px); }

        .reader-info {
          display: flex; align-items: center; gap: 10px; flex: 1;
          .reader-avatar-img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(56,189,248,0.4); }
          .reader-name { font-weight: 600; font-size: var(--text-sm); }
        }
        .reader-time { font-size: var(--text-2xs); color: var(--text-secondary); font-weight: 500; }
      }
    }
  }
`;
