import styled, { keyframes, css } from "styled-components";

const shimmer = keyframes`
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const slideUpFade = keyframes`
  0%   { transform: translateY(16px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
`;

const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); }
  30%            { transform: translateY(-5px); }
`;

const springyPop = keyframes`
  0%   { transform: scale(0.85) translateY(10px); opacity: 0; }
  70%  { transform: scale(1.02) translateY(-2px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
`;

// ── PINNED BANNER ────────────────────────────────────────────
export const PinnedBanner = styled.div`
  margin: 10px auto 0;
  width: calc(100% - 2rem);
  border-radius: var(--radius-md);
  background: var(--glass-noise), var(--bg-panel);
  border: 1px solid var(--glass-border);
  border-left: 3px solid var(--msg-sent);
  padding: 8px 16px;
  display: flex; align-items: center; gap: 12px;
  color: var(--text-primary); cursor: pointer;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  z-index: 2; box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  transition: all var(--duration-base) var(--ease-out);

  &:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }

  .pin-content {
    display: flex; flex-direction: column;
    .pin-title {
      font-size: var(--text-2xs); font-weight: 800; text-transform: uppercase;
      letter-spacing: 0.7px; color: var(--msg-sent);
    }
    .pin-text { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 1px; }
  }
`;

// ── MESSAGES AREA ────────────────────────────────────────────
export const MessagesArea = styled.div`
  height: 100%; width: 100%; overflow: hidden; position: relative;
  padding: ${({ $isCompact }) => $isCompact ? "1rem 1.25rem" : "1.25rem 1.75rem"};
  z-index: 1;

  &::before {
    content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
    background-image: radial-gradient(circle, var(--border-subtle) 1px, transparent 1px);
    background-size: 28px 28px; opacity: 0.6;
  }

  .virtuoso-scroll {
    height: 100% !important; width: 100% !important; overflow-x: hidden !important;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 99px; }
    &::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
  }

  .loading-older {
    text-align: center; padding: 1rem;
    color: var(--msg-sent); font-size: var(--text-xs); font-weight: 600; opacity: 0.8;
  }

  .skeleton-container { display: flex; flex-direction: column; gap: 1rem; }
  .skeleton-msg .content {
    background: var(--bg-overlay) !important; border: 1px solid var(--glass-border) !important;
    border-radius: var(--radius-lg) !important; box-shadow: none !important;
  }
  .skeleton-anim {
    background: linear-gradient(90deg, var(--bg-overlay) 25%, var(--bg-hover) 50%, var(--bg-overlay) 75%);
    background-size: 200% 100%;
    animation: ${shimmer} 1.6s infinite linear;
  }

  .date-separator {
    display: flex; justify-content: center; align-items: center;
    margin: 1.25rem 0; position: relative;
    span {
      background: var(--bg-overlay); border: 1px solid var(--glass-border);
      padding: 4px 14px; border-radius: var(--radius-full);
      font-size: var(--text-2xs); font-weight: 600; color: var(--text-secondary);
      z-index: 1; letter-spacing: 0.3px;
    }
    &::after {
      content: ""; position: absolute; width: 100%; height: 1px;
      background: linear-gradient(90deg, transparent, var(--border-default), transparent);
      top: 50%; z-index: 0;
    }
  }

  .highlight-flash .content {
    animation: flashBg 1.5s ease-out;
  }
  @keyframes flashBg {
    0%   { background: rgba(124,58,237,0.4); box-shadow: 0 0 20px rgba(124,58,237,0.3); transform: scale(1.01); }
    100% { background: inherit; box-shadow: inherit; transform: scale(1); }
  }

  .message-wrapper {
    padding-bottom: 1rem;
    animation: ${slideUpFade} 0.28s var(--ease-out) backwards;
    transition: padding 0.15s ease;
    &.grouped-next { padding-bottom: 3px; }
  }

  .message {
    display: flex; align-items: flex-end; position: relative;

    .content {
      max-width: clamp(200px, 62%, 520px);
      word-wrap: break-word; word-break: break-word;
      padding: 10px 14px;
      border-radius: var(--radius-lg);
      color: var(--text-primary); font-size: var(--text-sm);
      line-height: 1.55; display: flex; flex-direction: column;
      position: relative; min-width: 120px;
      transition: transform var(--duration-fast) var(--ease-out),
                  box-shadow var(--duration-fast);

      &:hover { transform: translateY(-1px); }

      &::before {
        content: ""; position: absolute; bottom: 0;
        width: 14px; height: 14px; z-index: -1;
      }

      .message-actions {
        position: absolute; top: 50%; margin-top: -18px;
        background: var(--glass-noise), var(--bg-panel);
        padding: 5px 10px; border-radius: var(--radius-full);
        display: flex; gap: 2px; opacity: 0; visibility: hidden;
        transition: all var(--duration-base) var(--ease-spring);
        box-shadow: 0 8px 24px rgba(0,0,0,0.2); z-index: 5;
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--glass-border);
        left: 100%; margin-left: 8px;
        transform: translateX(-8px) scale(0.92);

        button, .reaction-trigger {
          background: none; border: none; color: var(--text-secondary); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          padding: 5px; border-radius: var(--radius-sm);
          transition: all var(--duration-fast) var(--ease-spring);
          font-size: var(--text-base);
          &:hover { color: var(--text-primary); transform: scale(1.2); background: var(--input-bg); }
        }

        .reaction-trigger:hover .reaction-menu { display: flex; }
        .reaction-menu {
          display: none; position: absolute; bottom: 130%; left: 50%;
          transform: translateX(-50%);
          background: var(--bg-panel); padding: 8px 12px;
          border-radius: var(--radius-full); gap: 10px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.2);
          backdrop-filter: blur(16px); border: 1px solid var(--glass-border);
          animation: ${springyPop} 0.2s var(--ease-spring);
          white-space: nowrap;
          .reaction-emoji-btn {
            cursor: pointer; transition: all var(--duration-fast); font-size: 1.3rem;
            display: inline-block;
            &:hover { transform: scale(1.5) translateY(-4px); }
          }
        }
      }

      &:hover .message-actions {
        opacity: 1; visibility: visible; transform: translateX(0) scale(1);
      }

      .reactions-display {
        position: absolute; bottom: -14px; right: 12px;
        display: flex; flex-direction: row-reverse; z-index: 3;

        .reaction-pill {
          background: var(--bg-panel); padding: 2px 6px;
          border-radius: var(--radius-full); font-size: var(--text-xs);
          border: 1px solid var(--glass-border);
          box-shadow: 0 4px 12px rgba(0,0,0,0.12); margin-left: -8px;
          cursor: pointer; transition: all var(--duration-fast) var(--ease-spring);
          display: flex; align-items: center; backdrop-filter: blur(8px);
          &:hover { transform: scale(1.25) translateY(-3px); z-index: 10; border-color: var(--msg-sent); }
          .reaction-anim { display: inline-block; animation: ${springyPop} 0.3s var(--ease-spring); }
        }
      }

      .sender-name {
        font-size: var(--text-2xs); color: var(--msg-sent); font-weight: 700;
        margin-bottom: 5px; text-transform: capitalize; letter-spacing: 0.3px;
      }
      .deleted-text { font-style: italic; color: var(--text-tertiary); font-size: var(--text-xs); }
      .edited-tag { font-size: 0.62rem; opacity: 0.45; margin-left: 5px; font-style: italic; }
      .forwarded-tag {
        font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: 6px;
        font-style: italic; display: flex; align-items: center; gap: 5px; font-weight: 500;
      }

      .view-once-btn {
        background: linear-gradient(135deg, var(--color-danger), #ff8c6e);
        color: white; border: none; padding: 10px 18px;
        border-radius: var(--radius-md); cursor: pointer; font-weight: 700;
        font-size: var(--text-xs); display: flex; align-items: center; gap: 6px;
        box-shadow: 0 4px 16px rgba(255,92,114,0.35); transition: all var(--duration-base);
        &:hover { filter: brightness(1.1); transform: translateY(-2px); }
      }

      .link-preview {
        display: flex; flex-direction: column; gap: 6px; margin: 6px 0;
        .preview-card {
          background: var(--bg-overlay); border-radius: var(--radius-md);
          overflow: hidden; text-decoration: none; color: var(--text-primary);
          border: 1px solid var(--glass-border); transition: all var(--duration-base);
          &:hover { filter: brightness(0.95); transform: translateY(-2px); }
          img { width: 100%; height: 150px; object-fit: cover; border-bottom: 1px solid var(--glass-border); }
          .preview-info {
            padding: 10px 12px;
            h4 { margin: 0; font-size: var(--text-xs); font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            p { margin: 4px 0 0; font-size: var(--text-2xs); color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; }
          }
        }
      }

      .poll-container {
        background: var(--bg-overlay); padding: 14px 16px;
        border-radius: var(--radius-md); border: 1px solid var(--glass-border); min-width: 240px; margin: 6px 0;
        h4 { margin: 0 0 12px; color: var(--text-primary); display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); font-weight: 700; }
        .poll-option {
          position: relative; background: var(--bg-panel); padding: 10px 12px;
          border-radius: var(--radius-sm); margin-bottom: 6px; cursor: pointer;
          overflow: hidden; display: flex; justify-content: space-between;
          border: 1px solid transparent; transition: all var(--duration-base);
          &:hover { border-color: var(--glass-border); }
          &.voted { border-color: var(--msg-sent); }
          .poll-bar { position: absolute; top: 0; left: 0; height: 100%; background: var(--msg-sent); opacity: 0.15; z-index: 0; transition: width 0.8s var(--ease-out); }
          .opt-text, .opt-percent { position: relative; z-index: 1; font-size: var(--text-xs); font-weight: 600; }
        }
      }

      .quoted-message {
        background: var(--bg-overlay); border-left: 3px solid var(--msg-sent);
        padding: 7px 10px; border-radius: 4px 10px 10px 4px;
        font-size: var(--text-xs); margin-bottom: 8px; color: var(--text-secondary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;
        transition: all var(--duration-fast);
        &:hover { filter: brightness(0.9); }
        span { font-weight: 700; color: var(--msg-sent); }
      }

      .code-snippet {
        background: var(--bg-root); padding: 12px; border-radius: var(--radius-md);
        overflow-x: auto; border: 1px solid var(--glass-border); margin: 6px 0;
        code { font-family: 'JetBrains Mono', 'Fira Code', monospace; white-space: pre-wrap; word-break: break-all; font-size: var(--text-xs); line-height: 1.6; color: var(--text-primary); }
      }

      .msg-image { max-width: 100%; border-radius: var(--radius-md); margin-top: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
      .msg-image.clickable { cursor: pointer; transition: transform var(--duration-base); &:hover { transform: scale(1.02); } }
      .msg-video { max-width: 100%; border-radius: var(--radius-md); margin-top: 6px; outline: none; }
      .msg-audio { max-width: 220px; margin-top: 6px; height: 38px; }
      .msg-file-link {
        display: flex; align-items: center; gap: 10px;
        background: var(--bg-overlay); padding: 10px 14px; border-radius: var(--radius-md);
        color: var(--text-primary); text-decoration: none; margin-top: 6px;
        font-weight: 600; font-size: var(--text-xs); border: 1px solid var(--glass-border);
        transition: all var(--duration-base);
        &:hover { filter: brightness(0.95); transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
      }

      .meta {
        display: flex; justify-content: flex-end; align-items: center;
        gap: 5px; font-size: 0.62rem; opacity: 0.75; margin-top: 7px; font-weight: 500;

        .timer-icon { color: var(--color-warning); animation: ${pulse} 2s infinite; }
        .read-status { font-size: var(--text-sm); display: flex; align-items: center; }
        .read-status-wrapper {
          display: flex; align-items: center; gap: 3px;
          border-radius: var(--radius-sm); padding: 2px 5px; transition: all var(--duration-fast);
          &.has-avatars { background: rgba(255,255,255,0.1); }
          &:hover.has-avatars { background: rgba(255,255,255,0.15); }
        }
        .reader-avatars { display: flex; align-items: center; margin-right: 2px; }
        .tiny-avatar {
          width: 15px; height: 15px; border-radius: 50%;
          border: 1px solid var(--msg-sent); margin-left: -5px;
          background: var(--bg-overlay); object-fit: cover;
          &:first-child { margin-left: 0; }
        }
        .more-readers { font-size: 0.58rem; margin-left: 3px; font-weight: 700; }
      }
    }
  }

  .deleted-msg .content {
    background: var(--bg-overlay) !important; border: 1px dashed var(--border-default) !important;
    box-shadow: none !important; backdrop-filter: none; color: var(--text-tertiary) !important;
    &::before { display: none; }
  }

  .sended {
    justify-content: flex-end;
    .content {
      background: linear-gradient(135deg, var(--msg-sent), var(--msg-sent-2));
      color: white; border-bottom-right-radius: 4px;
      box-shadow: 0 4px 16px rgba(124,58,237,0.25);
      &::before {
        right: -5px; background: var(--msg-sent-2);
        clip-path: polygon(0 0, 0% 100%, 100% 100%);
      }
      .message-actions {
        right: 100%; left: auto; margin-right: 8px; margin-left: 0;
        transform: translateX(8px) scale(0.92);
      }
      &:hover .message-actions { transform: translateX(0) scale(1); }
      .reactions-display { right: auto; left: 12px; flex-direction: row; .reaction-pill { margin-left: 0; margin-right: -8px; } }
      .meta { color: rgba(255,255,255,0.7); }
      .sender-name { color: rgba(255,255,255,0.85); }
    }
  }

  .message-wrapper.grouped-next .sended .content {
    border-bottom-right-radius: var(--radius-lg);
    &::before { display: none; }
  }
  .message-wrapper.grouped-prev .sended .content { border-top-right-radius: 4px; }

  .recieved {
    justify-content: flex-start;
    .content {
      background: var(--glass-noise), var(--msg-received);
      border: 1px solid var(--glass-border);
      border-bottom-left-radius: 4px;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      &::before {
        left: -5px; background: var(--msg-received);
        clip-path: polygon(100% 0, 0 100%, 100% 100%);
        border-bottom: 1px solid var(--glass-border);
      }
    }
  }

  .message-wrapper.grouped-next .recieved .content {
    border-bottom-left-radius: var(--radius-lg);
    &::before { display: none; }
  }
  .message-wrapper.grouped-prev .recieved .content { border-top-left-radius: 4px; }

  .typing-dots {
    display: flex; align-items: center; gap: 5px; height: 16px; padding: 0 4px;
    span {
      width: 6px; height: 6px; background: var(--msg-sent); border-radius: 50%;
      animation: ${bounce} 1.4s infinite ease-in-out both; opacity: 0.8;
      &:nth-child(1) { animation-delay: -0.32s; }
      &:nth-child(2) { animation-delay: -0.16s; }
    }
  }

  .fa-spin { animation: spin 1.2s infinite linear; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

// ── SCROLL BUTTON ─────────────────────────────────────────────
export const ScrollButton = styled.button`
  position: absolute; bottom: 88px; right: 24px;
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--msg-sent); color: white; border: none; cursor: pointer;
  box-shadow: 0 6px 20px rgba(124,58,237,0.4);
  display: flex; justify-content: center; align-items: center; z-index: 10;
  transition: all var(--duration-base) var(--ease-spring); font-size: 1.1rem;
  &:hover { filter: brightness(1.15); box-shadow: 0 10px 28px rgba(124,58,237,0.5); transform: translateY(-2px); }

  .unread-badge {
    position: absolute; top: -6px; right: -6px;
    background: var(--color-danger); color: white;
    font-size: var(--text-2xs); font-weight: 800;
    min-width: 20px; height: 20px; display: flex;
    justify-content: center; align-items: center;
    border-radius: var(--radius-full); padding: 0 5px;
    border: 2px solid var(--bg-base);
    animation: badgePop 0.4s var(--ease-spring);
    box-shadow: 0 3px 8px rgba(255,92,114,0.4);
  }
  @keyframes badgePop { 0%{transform:scale(0);} 50%{transform:scale(1.3);} 100%{transform:scale(1);} }
`;
