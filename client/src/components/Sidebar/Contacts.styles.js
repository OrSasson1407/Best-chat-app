import styled, { keyframes } from "styled-components";
import { motion } from "framer-motion";

export const shimmer = keyframes`
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

export const pulseRing = keyframes`
  0%   { transform: scale(0.9); opacity: 0.9; }
  70%  { transform: scale(1.1); opacity: 0; }
  100% { transform: scale(0.9); opacity: 0; }
`;

export const ContextMenu = styled.div`
  position: fixed; z-index: 9999;
  background: var(--bg-panel); border: 1px solid var(--glass-border);
  border-radius: var(--radius-md); overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 180px;
  animation: ctxFade 0.15s ease;
  @keyframes ctxFade { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }

  .ctx-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px; font-size: var(--text-sm); cursor: pointer;
    color: var(--text-primary); transition: background var(--duration-fast);
    &:hover { background: var(--bg-hover); }
    svg { font-size: 0.85rem; color: var(--text-secondary); }
  }
`;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: ${({ $isCompact }) => $isCompact ? "72px" : "100%"};
  transition: width var(--duration-slow) var(--ease-spring);
  background: var(--bg-surface);
  overflow: hidden;

  @keyframes pulseRing {
    0%   { transform: scale(0.9); opacity: 0.9; }
    70%  { transform: scale(1.1); opacity: 0; }
    100% { transform: scale(0.9); opacity: 0; }
  }

  .skeleton-anim {
    background: linear-gradient(90deg, var(--bg-overlay) 25%, var(--bg-hover) 50%, var(--bg-overlay) 75%);
    background-size: 200% 100%;
    animation: ${shimmer} 1.6s infinite linear;
  }
`;

export const ContactItem = styled.div`
  display: flex; align-items: center; gap: 11px;
  padding: ${({ $isCompact }) => $isCompact ? "10px" : "10px 12px"};
  border-radius: var(--radius-md); cursor: pointer;
  background: transparent; border: 1px solid transparent;
  transition: all var(--duration-fast) var(--ease-out); position: relative;
  justify-content: ${({ $isCompact }) => $isCompact ? "center" : "flex-start"};

  &:hover {
    background: var(--bg-overlay);
    transform: ${({ $isCompact }) => $isCompact ? "scale(1.08)" : "none"};
  }
  &.selected {
    background: var(--bg-hover);
    border-color: var(--border-default);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }
  &.pinned { border-left: 2px solid var(--msg-sent); padding-left: ${({ $isCompact }) => $isCompact ? "10px" : "10px"}; }
  &:hover .pin-btn { opacity: 1 !important; }
  &.pinned .pin-btn { opacity: 1 !important; color: var(--msg-sent) !important; }
`;

export const StoryTray = styled.div`
  flex-shrink: 0; display: flex; gap: 12px;
  padding: 0 16px 14px; overflow-x: auto; -webkit-overflow-scrolling: touch;
  border-bottom: 1px solid var(--border-subtle);
  &::-webkit-scrollbar { display: none; }

  .story-item {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    cursor: pointer; min-width: 58px;
    p {
      font-size: var(--text-2xs); color: var(--text-secondary); font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      max-width: 58px; text-align: center;
    }

    .story-ring {
      width: 54px; height: 54px; border-radius: 50%; padding: 2.5px;
      position: relative; background: var(--border-default);
      transition: transform var(--duration-fast) var(--ease-spring);
      &:hover { transform: scale(1.06); }
      img {
        width: 100%; height: 100%; border-radius: 50%;
        border: 2.5px solid var(--bg-surface); object-fit: cover;
      }
      &.unread {
        background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
        box-shadow: 0 4px 14px rgba(220,39,67,0.3);
      }
      &.empty {
        background: none; border: 1.5px dashed var(--border-default); padding: 2px;
      }
      .add-icon {
        position: absolute; bottom: -2px; right: -2px;
        background: var(--msg-sent); color: white; border-radius: 50%;
        width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;
        font-size: 0.65rem; border: 2px solid var(--bg-surface);
        box-shadow: 0 2px 8px rgba(124,58,237,0.4);
      }
    }
  }
`;

export const StoryPreviewTooltip = styled(motion.div)`
  position: absolute; top: 120px; left: 16px;
  background: var(--glass-noise), var(--bg-panel);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border); border-radius: var(--radius-lg);
  padding: 12px; display: flex; align-items: center; gap: 12px;
  z-index: 50; box-shadow: var(--glass-shadow);

  img { width: 44px; height: 44px; border-radius: var(--radius-sm); object-fit: cover; }
  .info {
    h4 { color: var(--text-primary); font-size: var(--text-sm); font-weight: 700; margin-bottom: 2px; }
    p  { color: var(--text-secondary); font-size: var(--text-xs); }
  }
`;

export const ModalOverlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  z-index: var(--z-modal-overlay);
  display: flex; justify-content: center; align-items: center;
  padding: 1rem;

  .modal-content {
    background: var(--glass-noise), var(--bg-panel);
    border: 1px solid var(--glass-border); border-radius: var(--radius-2xl);
    padding: clamp(1.5rem, 4vw, 2rem); width: min(460px, 95vw);
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 32px 80px rgba(0,0,0,0.5);
    animation: modalIn 0.3s var(--ease-spring);

    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.93) translateY(16px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 99px; }
    &.profile { width: min(520px, 95vw); }

    h3 {
      font-size: var(--text-lg); color: var(--text-primary);
      font-weight: 800; margin-bottom: 1.5rem; text-align: center;
    }

    .section-divider {
      margin: 1.5rem 0 1rem; font-size: var(--text-xs); text-transform: uppercase;
      color: var(--msg-sent); font-weight: 800; letter-spacing: 0.6px;
      display: flex; align-items: center; gap: 8px;
      border-bottom: 1px solid var(--border-subtle); padding-bottom: 8px;
    }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    .input-field {
      margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; position: relative;

      label {
        font-size: var(--text-xs); text-transform: uppercase; font-weight: 700;
        color: var(--text-secondary); letter-spacing: 0.4px;
      }
      .inner-icon { position: absolute; bottom: 13px; left: 13px; color: var(--text-tertiary); }

      input, select, textarea {
        width: 100%; background: var(--input-bg); border: 1px solid var(--border-default);
        color: var(--text-primary); padding: 11px 14px;
        border-radius: var(--radius-md); font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: var(--text-sm); transition: all var(--duration-base); outline: none;
        &:focus {
          border-color: var(--msg-sent); background: rgba(124,58,237,0.06);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }
      }
      textarea { resize: none; height: 90px; }
      .flex-row { display: flex; gap: 10px; }
    }

    .setting-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px; background: var(--input-bg); padding: 14px 16px;
      border-radius: var(--radius-md); border: 1px solid var(--border-subtle);
      .text {
        label { color: var(--text-primary); font-weight: 700; font-size: var(--text-sm); display: block; }
        p { color: var(--text-secondary); font-size: var(--text-xs); margin-top: 2px; }
      }
    }

    .ios-switch {
      width: 48px; height: 28px; border-radius: 28px;
      background: var(--border-strong); position: relative; cursor: pointer; transition: 0.3s; flex-shrink: 0;
      .knob {
        position: absolute; top: 2px; left: 2px;
        width: 24px; height: 24px; background: white; border-radius: 50%;
        transition: 0.3s; box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      }
      &.on { background: var(--color-success); .knob { left: 22px; } }
    }

    .toggle-btn {
      width: 100%; padding: 11px; border-radius: var(--radius-md);
      border: 1px solid var(--border-default); background: var(--input-bg);
      color: var(--text-primary); font-weight: 700; font-size: var(--text-sm);
      font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; transition: all var(--duration-base);
      &.on {
        background: var(--msg-sent); border-color: var(--msg-sent); color: white;
        box-shadow: 0 4px 16px rgba(124,58,237,0.35);
      }
    }

    .member-selection {
      background: var(--input-bg); border-radius: var(--radius-md);
      border: 1px solid var(--border-subtle); overflow: hidden; margin-bottom: 20px;

      label {
        display: block; padding: 10px 14px;
        background: var(--bg-overlay); font-size: var(--text-xs); font-weight: 700;
        color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle);
        text-transform: uppercase; letter-spacing: 0.4px;
      }

      .scroll-list {
        max-height: 200px; overflow-y: auto;
        &::-webkit-scrollbar { width: 4px; }
        &::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 99px; }
      }

      .select-item {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 14px; border-bottom: 1px solid var(--border-subtle);
        cursor: pointer; transition: all var(--duration-fast);
        img { width: 30px; height: 30px; border-radius: 50%; }
        span { flex: 1; font-weight: 600; font-size: var(--text-sm); color: var(--text-primary); }
        .check { color: var(--msg-sent); }
        &:hover { background: var(--bg-overlay); }
        &.selected { background: rgba(124,58,237,0.08); }
      }

      .channel-item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px; border-bottom: 1px solid var(--border-subtle);
        .info {
          h4 { color: var(--text-primary); font-size: var(--text-sm); font-weight: 700; }
          p { color: var(--text-secondary); font-size: var(--text-xs); margin-top: 2px; }
        }
      }

      .center-loading { display: flex; justify-content: center; align-items: center; height: 90px; font-size: 1.4rem; color: var(--msg-sent); }
      .empty-text { text-align: center; color: var(--text-secondary); padding: 28px; font-style: italic; font-size: var(--text-sm); }
    }

    .button-group {
      display: flex; gap: 10px;
      button {
        flex: 1; padding: 13px; border-radius: var(--radius-md);
        font-weight: 700; font-size: var(--text-sm); cursor: pointer;
        transition: all var(--duration-base); border: none;
        display: flex; justify-content: center; align-items: center; gap: 6px;
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      .btn-primary {
        background: linear-gradient(135deg, var(--msg-sent), #6366f1);
        color: white; box-shadow: 0 6px 20px rgba(124,58,237,0.3);
        &:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(124,58,237,0.4); filter: brightness(1.1); }
      }
      .btn-secondary {
        background: transparent; border: 1px solid var(--border-default) !important;
        color: var(--text-primary);
        &:hover { background: var(--input-bg); }
      }
      .small { padding: 8px 14px; flex: none; border-radius: var(--radius-full); font-size: var(--text-xs); }
      .full-width { flex: 1; width: 100%; }
    }
  }
`;