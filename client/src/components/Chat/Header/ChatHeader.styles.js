import styled, { keyframes } from "styled-components";

const springyPop = keyframes`
  0%   { transform: scale(0.85) translateY(10px); opacity: 0; }
  70%  { transform: scale(1.02) translateY(-2px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

export const StyledChatHeader = styled.header`
  display: flex; align-items: center;
  padding: 0 clamp(1rem, 2.5vw, 1.75rem);
  background: var(--glass-noise), rgba(13,17,23,0.6);
  border-bottom: 1px solid var(--glass-border);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  z-index: 10; position: relative;

  [data-theme='light'] & {
    background: var(--glass-noise), rgba(255,255,255,0.7);
  }

  .user-details {
    display: flex; align-items: center; justify-content: space-between; width: 100%;

    .header-info {
      display: flex; flex-direction: column; cursor: pointer;
      padding: 6px 0;

      h3 {
        color: var(--text-primary); font-size: var(--text-base);
        font-weight: 700; line-height: 1.2; margin-bottom: 2px;
        display: flex; align-items: center; gap: 8px;
      }

      .presence-info {
        display: flex; align-items: center; gap: 6px; margin-top: 1px;
        .status-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--text-tertiary); transition: all 0.3s;
          &.online { background: var(--color-success); box-shadow: 0 0 6px rgba(34,211,165,0.6); }
        }
        span {
          font-size: var(--text-xs); color: var(--text-secondary); transition: color 0.3s;
          &.online { color: var(--color-success); font-weight: 600; }
        }
      }

      .chat-bio {
        font-size: var(--text-xs); color: var(--text-tertiary);
        display: flex; align-items: center; gap: 5px; margin-top: 2px;
        cursor: help; max-width: 280px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
    }
  }

  .admin-controls {
    display: flex; align-items: center; gap: clamp(8px, 1.5vw, 16px); flex-shrink: 0;

    .chat-search-input {
      background: var(--input-bg); color: var(--text-primary);
      border: 1px solid var(--glass-border);
      padding: 8px 16px; border-radius: var(--radius-full);
      font-family: 'Plus Jakarta Sans', sans-serif; font-size: var(--text-sm);
      outline: none; transition: all var(--duration-base);
      &:focus { border-color: var(--msg-sent); box-shadow: 0 0 0 3px rgba(124,58,237,0.12); }
      animation: ${springyPop} 0.3s var(--ease-spring);
    }

    .huddle-btn {
      background: var(--msg-sent); color: white; border: none;
      padding: 8px 16px; border-radius: var(--radius-full);
      font-family: 'Plus Jakarta Sans', sans-serif; font-size: var(--text-xs);
      font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;
      transition: all var(--duration-base) var(--ease-out);
      box-shadow: 0 4px 16px rgba(124,58,237,0.35);
      white-space: nowrap;
      &:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(124,58,237,0.45); filter: brightness(1.1); }
      &:disabled { opacity: 0.6; cursor: not-allowed; }
    }

    .admin-badge {
      background: rgba(124,58,237,0.12); color: var(--msg-sent);
      padding: 5px 12px; border-radius: var(--radius-full);
      border: 1px solid rgba(124,58,237,0.25);
      font-size: var(--text-2xs); font-weight: 800; letter-spacing: 0.5px;
      display: flex; align-items: center; gap: 5px; text-transform: uppercase;
    }

    .action-icon {
      color: var(--text-secondary); cursor: pointer; font-size: 1.1rem;
      transition: all var(--duration-fast) var(--ease-spring);
      padding: 6px; border-radius: var(--radius-sm);
      &:hover { color: var(--text-primary); transform: scale(1.15); background: var(--input-bg); }
      &.blocked { color: var(--color-danger); }
    }

    @media (max-width: 640px) {
      .huddle-btn span { display: none; }
      gap: 8px;
    }
  }
`;
