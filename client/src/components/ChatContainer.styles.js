// client/src/components/ChatContainer.styles.js
import styled, { keyframes, css } from "styled-components";

// --- REFINED ANIMATIONS ---
const springyPop = keyframes`
  0% { transform: scale(0.85) translateY(10px); opacity: 0; }
  70% { transform: scale(1.02) translateY(-2px); opacity: 1; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

const slideUpFade = keyframes`
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
`;

const shimmer = keyframes`
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

const pulse = keyframes`
  0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; }
`;

const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
`;

const pulseBorder = keyframes`
  0% { border-color: rgba(78, 14, 255, 0.4); box-shadow: 0 0 0 rgba(78, 14, 255, 0); }
  50% { border-color: rgba(78, 14, 255, 1); box-shadow: 0 0 20px rgba(78, 14, 255, 0.4); }
  100% { border-color: rgba(78, 14, 255, 0.4); box-shadow: 0 0 0 rgba(78, 14, 255, 0); }
`;

export const Container = styled.div`
  display: grid; 
  /* Adjusted grid to accommodate floating pinned banner naturally */
  grid-template-rows: ${({ $hasPinned }) => $hasPinned ? '10% auto 1fr 10%' : '10% 1fr 10%'}; 
  overflow: hidden;
  height: 100%;
  position: relative;
  
  ${({ $isCompact, $hasPinned }) => $isCompact && css`
      grid-template-rows: ${$hasPinned ? '8% auto 1fr 10%' : '8% 1fr 10%'};
  `}

  .fa-spin { animation: spin 2s infinite linear; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(359deg); } }

  .search-highlight {
      background: #ffcc00; color: #000; padding: 0 2px; border-radius: 4px; font-weight: 600;
      box-shadow: 0 0 10px rgba(255, 204, 0, 0.4);
  }

  /* --- POLISHED: FLOATING PINNED BANNER --- */
  .pinned-banner {
      margin: 12px auto 0 auto;
      width: 96%;
      border-radius: 12px;
      background: rgba(20, 20, 30, 0.45); 
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-left: 4px solid var(--adaptive-accent, #00ff88);
      padding: 0.6rem 1.5rem; 
      display: flex; align-items: center; gap: 1rem; color: var(--adaptive-accent, #00ff88); 
      cursor: pointer;
      backdrop-filter: blur(16px); 
      -webkit-backdrop-filter: blur(16px);
      z-index: 2; 
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      
      &:hover { 
          background: rgba(30, 30, 45, 0.6); 
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.3);
      }
      .pin-content { 
          display: flex; flex-direction: column; 
          .pin-title { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9;} 
          .pin-text { font-size: 0.85rem; color: rgba(255, 255, 255, 0.8); margin-top: 2px;} 
      }
  }

  .chat-header {
    display: flex; justify-content: space-between; align-items: center; 
    padding: 0 2rem;
    background: rgba(255, 255, 255, 0.02); 
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px); z-index: 2;
    
    ${({ $themeType }) => $themeType === 'cyberpunk' && css`border-bottom: 1px solid rgba(0, 255, 136, 0.3);`}
    ${({ $themeType }) => $themeType === 'midnight' && css`border-bottom: 1px solid rgba(255, 255, 255, 0.05);`}
    
    .user-details {
      display: flex; align-items: center; justify-content: space-between; width: 100%;
      
      .header-info {
          display: flex; flex-direction: column;
          h3 { 
              color: white; font-weight: 600; margin-bottom: 2px; letter-spacing: 0.2px;
              ${({ $isCompact }) => $isCompact && css`font-size: 1rem;`} 
          }
          .presence-info {
              display: flex; align-items: center; gap: 6px; margin-top: -2px; margin-bottom: 4px;
              .status-dot {
                  width: 8px; height: 8px; border-radius: 50%; background: #555;
                  transition: all 0.3s ease;
                  &.online { background: #00ff88; box-shadow: 0 0 8px rgba(0, 255, 136, 0.6); }
              }
              span { font-size: 0.75rem; color: #aaa; transition: color 0.3s; &.online { color: #00ff88; } }
          }
          .chat-bio { font-size: 0.75rem; color: rgba(255, 255, 255, 0.5); display: flex; align-items: center; gap: 0.4rem; cursor: help; }
      }
    }
    
    .admin-controls {
        display: flex; align-items: center; gap: 1rem;
        .chat-search-input { background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255, 255, 255, 0.2); padding: 0.5rem 1rem; border-radius: 2rem; outline: none; font-size: 0.85rem; animation: ${springyPop} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); transition: all 0.2s; &:focus { border-color: var(--adaptive-accent, #4e0eff); box-shadow: 0 0 10px rgba(78, 14, 255, 0.2); background: rgba(0,0,0,0.5); } }
        .huddle-btn { background: var(--adaptive-accent, #4e0eff); color: white; border: none; padding: 0.5rem 1rem; border-radius: 2rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; transition: all 0.2s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.2); &:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(78, 14, 255, 0.4); filter: brightness(1.1); } }
        .admin-badge { background: rgba(255, 255, 255, 0.05); color: var(--adaptive-accent, #00ff88); padding: 0.3rem 0.8rem; border-radius: 1rem; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.7rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; backdrop-filter: blur(4px); }
        .action-icon { color: rgba(255,255,255,0.6); cursor: pointer; font-size: 1.2rem; transition: 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); &:hover { transform: scale(1.15); color: white; } &.blocked { color: #ff0055; } }
    }
  }

  .chat-messages-container {
    height: 100%; width: 100%; overflow: hidden; position: relative;
    padding: ${({ $isCompact }) => $isCompact ? '1rem 1.5rem' : '1.5rem 2rem'};
    z-index: 1;

    &::before {
        content: ""; position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: -1; pointer-events: none; opacity: 0.4;
        background-image: radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px);
        background-size: 24px 24px;
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css`
            background-image: linear-gradient(rgba(0, 255, 136, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 136, 0.05) 1px, transparent 1px);
            background-size: 40px 40px; opacity: 0.3;
        `}
        
        ${({ $themeType }) => $themeType === 'midnight' && css`
            background-image: radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px);
            background-size: 15px 15px; opacity: 0.5;
        `}
    }
    
    /* --- FIX: ENFORCE NO HORIZONTAL SCROLLING --- */
    .virtuoso-scroll { 
        height: 100% !important; width: 100% !important; 
        overflow-x: hidden !important; 
        &::-webkit-scrollbar { width: 6px; } 
        &::-webkit-scrollbar-track { background: transparent; }
        &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; transition: background-color 0.2s; } 
        &:hover::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.2); }
    }

    .loading-older { text-align: center; padding: 1rem; color: var(--adaptive-accent, #00ff88); font-size: 0.85rem; font-weight: 500; opacity: 0.8; }
    
    .skeleton-container { display: flex; flex-direction: column; gap: 1.2rem; }
    .skeleton-msg .content { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255,255,255,0.02) !important; border-radius: 1.2rem; box-shadow: none !important; }
    .skeleton-anim { 
        background: linear-gradient(90deg, rgba(255,255,255,0.02) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 75%); 
        background-size: 200% 100%; 
        animation: ${shimmer} 2s infinite ease-in-out; 
    }

    .date-separator {
        display: flex; justify-content: center; align-items: center; margin: 1.5rem 0; position: relative;
        span { 
            background: rgba(20, 20, 30, 0.5); border: 1px solid rgba(255,255,255,0.08); 
            padding: 0.4rem 1.2rem; border-radius: 2rem; font-size: 0.75rem; font-weight: 500;
            color: rgba(255, 255, 255, 0.7); z-index: 1; backdrop-filter: blur(8px); 
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        &::after { 
            content: ""; position: absolute; width: 100%; height: 1px; 
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); 
            top: 50%; z-index: 0; 
        }
    }

    .highlight-flash .content { animation: flashBg 1.5s ease-out; }
    @keyframes flashBg { 0% { background-color: rgba(255, 255, 255, 0.2); box-shadow: 0 0 25px rgba(255,255,255,0.3); transform: scale(1.02); } 100% { background-color: inherit; box-shadow: inherit; transform: scale(1); } }

    .message-wrapper { padding-bottom: 1.2rem; animation: ${slideUpFade} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards; transition: padding 0.2s ease; }
    .message-wrapper.grouped-next { padding-bottom: 4px; }

    .message {
      display: flex; align-items: flex-end; position: relative;
      
      .content {
        max-width: 65%;
        word-wrap: break-word;
        word-break: break-word; /* Prevents long text from breaking flexbox */
        padding: 0.9rem 1.2rem;
        border-radius: 1.2rem;
        color: #fff; line-height: 1.45; display: flex; flex-direction: column;
        position: relative; min-width: 140px; 
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease, border-radius 0.2s ease;
        
        &:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.2); }

        &::before { content: ""; position: absolute; bottom: 0; width: 16px; height: 16px; z-index: -1; }

        /* --- FIX: WHATSAPP-STYLE FLOATING ACTIONS --- */
        .message-actions {
            position: absolute; 
            top: 50%; /* Center vertically to align neatly beside the bubble */
            margin-top: -16px; 
            background: rgba(30, 30, 40, 0.85); padding: 0.4rem 0.6rem; border-radius: 2rem;
            display: flex; gap: 0.6rem; opacity: 0; visibility: hidden; 
            transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 5;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.05);
            
            /* DEFAULT SETTING: Received Messages (Left side of screen) */
            /* Places actions on the outer RIGHT edge of the bubble */
            left: 100%;
            margin-left: 8px;
            transform: translateX(-10px) scale(0.95);
            
            button, .reaction-trigger {
                background: none; border: none; color: rgba(255,255,255,0.6); cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); &:hover { color: #fff; transform: scale(1.15); }
            }

            .reaction-trigger:hover .reaction-menu { display: flex; }
            .reaction-menu {
                display: none; position: absolute; bottom: 130%; left: 50%;
                transform: translateX(-50%); background: rgba(30, 30, 40, 0.95); padding: 0.6rem;
                border-radius: 2rem; gap: 0.8rem; box-shadow: 0 8px 25px rgba(0,0,0,0.4);
                backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1);
                animation: ${springyPop} 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                .reaction-emoji-btn { cursor: pointer; transition: 0.2s; font-size: 1.4rem; display: inline-block; &:hover { transform: scale(1.4) translateY(-4px); } }
            }
        }

        /* Hover reveals the actions for both sent & received naturally */
        &:hover .message-actions { opacity: 1; visibility: visible; transform: translateX(0) scale(1); }

        .reactions-display {
            position: absolute; bottom: -14px; right: 14px;
            display: flex; flex-direction: row-reverse;
            gap: -6px; 
            z-index: 3;
            
            .reaction-pill {
                background: rgba(30, 30, 45, 0.9); padding: 0.15rem 0.4rem; border-radius: 1rem;
                font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 4px 10px rgba(0,0,0,0.2); margin-left: -8px; 
                cursor: pointer; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex; align-items: center; justify-content: center;
                backdrop-filter: blur(5px);
                
                &:hover { transform: scale(1.2) translateY(-4px); z-index: 10; border-color: var(--adaptive-accent, #4e0eff); box-shadow: 0 6px 15px rgba(0,0,0,0.4);}
                .reaction-anim { display: inline-block; animation: ${springyPop} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            }
        }

        .sender-name { font-size: 0.75rem; color: var(--adaptive-accent, #00ff88); font-weight: 700; margin-bottom: 6px; text-transform: capitalize; letter-spacing: 0.3px;}
        .deleted-text { font-style: italic; color: rgba(255,255,255,0.4); font-size: 0.9rem; }
        .edited-tag { font-size: 0.65rem; opacity: 0.5; margin-left: 6px; font-style: italic; }
        .forwarded-tag { font-size: 0.7rem; color: rgba(255,255,255,0.6); margin-bottom: 0.6rem; font-style: italic; display: flex; align-items: center; gap: 0.4rem; font-weight: 500;}
        
        .view-once-btn { background: linear-gradient(135deg, #ff0055, #ff5500); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 0.8rem; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 0.6rem; box-shadow: 0 4px 15px rgba(255,0,85,0.3); transition: 0.2s; &:hover { filter: brightness(1.1); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(255,0,85,0.5);} }

        .link-preview {
            display: flex; flex-direction: column; gap: 0.6rem; margin: 6px 0;
            .preview-card {
                background: rgba(0,0,0,0.25); border-radius: 0.8rem; overflow: hidden; text-decoration: none; color: white; border: 1px solid rgba(255,255,255,0.05); transition: all 0.2s ease;
                &:hover { background: rgba(0,0,0,0.4); transform: translateY(-2px); border-color: rgba(255, 255, 255, 0.15); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
                img { width: 100%; height: 160px; object-fit: cover; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .preview-info { padding: 1rem; h4 { margin: 0; font-size: 0.95rem; font-weight: 600; color: var(--adaptive-accent, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } p { margin: 6px 0 0; font-size: 0.8rem; color: rgba(255,255,255,0.7); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; } }
            }
        }

        .poll-container {
            background: rgba(0,0,0,0.15); padding: 1.2rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.08); min-width: 260px; margin: 6px 0;
            h4 { margin: 0 0 1rem 0; color: #fff; display: flex; align-items: center; gap: 0.6rem; font-size: 1rem; font-weight: 600;}
            .poll-option {
                position: relative; background: rgba(255,255,255,0.05); padding: 0.8rem; border-radius: 0.8rem; margin-bottom: 0.6rem; cursor: pointer; overflow: hidden; display: flex; justify-content: space-between; border: 1px solid transparent; transition: all 0.2s ease;
                &:hover { border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.08); }
                &.voted { border-color: var(--adaptive-accent, #00ff88); background: rgba(255,255,255,0.1); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                .poll-bar { position: absolute; top: 0; left: 0; height: 100%; background: var(--adaptive-accent, rgba(0,255,136,0.2)); opacity: 0.3; z-index: 0; transition: width 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .opt-text, .opt-percent { position: relative; z-index: 1; font-size: 0.9rem; font-weight: 500; }
            }
        }

        .quoted-message {
            background: rgba(0,0,0,0.2); border-left: 4px solid var(--adaptive-accent, #00ff88); padding: 0.6rem 0.8rem; border-radius: 0.4rem 0.8rem 0.8rem 0.4rem; font-size: 0.85rem; margin-bottom: 0.8rem; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: all 0.2s;
            &:hover { background: rgba(0,0,0,0.3); opacity: 1; }
            span { font-weight: 600; color: var(--adaptive-accent, #00ff88); }
        }

        .code-snippet { background: #16161e; padding: 1rem; border-radius: 0.8rem; overflow-x: auto; font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #a9b1d6; border: 1px solid rgba(255,255,255,0.05); margin: 0.6rem 0; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2); code { white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; line-height: 1.5; } }
        .msg-image { max-width: 100%; border-radius: 0.8rem; margin-top: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .msg-image.clickable { cursor: pointer; transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); &:hover { transform: scale(1.02); } }
        .msg-video { max-width: 100%; border-radius: 0.8rem; margin-top: 6px; outline: none; box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .msg-audio { max-width: 240px; margin-top: 6px; height: 40px; }
        .msg-file-link { display: flex; align-items: center; gap: 0.8rem; background: rgba(255,255,255,0.08); padding: 0.8rem 1.2rem; border-radius: 0.8rem; color: #fff; text-decoration: none; margin-top: 6px; font-weight: 600; font-size: 0.9rem; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); border: 1px solid rgba(255,255,255,0.05); &:hover { background: rgba(255,255,255,0.15); transform: translateY(-2px); box-shadow: 0 6px 15px rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.2); } }

        .meta {
            display: flex; justify-content: flex-end; align-items: center;
            gap: 6px; font-size: 0.65rem; opacity: 0.6; margin-top: 8px; font-weight: 500;
            .timer-icon { color: #ff5500; font-size: 0.75rem; animation: ${pulse} 2s infinite; }
            
            .read-status { font-weight: 700; font-size: 0.85rem; display: flex; align-items: center; transition: 0.2s; }
            .read-status-wrapper {
                display: flex; align-items: center; gap: 4px; border-radius: 12px; padding: 2px 6px; transition: 0.2s;
                &.has-avatars { background: rgba(0,0,0,0.15); }
                &:hover.has-avatars { background: rgba(0,0,0,0.3); }
            }
            .reader-avatars { display: flex; align-items: center; margin-right: 2px; }
            .tiny-avatar {
                width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--adaptive-accent, #4e0eff);
                margin-left: -6px; background: #1a1a25; object-fit: cover;
                &:first-child { margin-left: 0; }
            }
            .more-readers { font-size: 0.6rem; color: rgba(255,255,255,0.8); margin-left: 4px; font-weight: 700; }
        }
      }
    }

    .deleted-msg .content {
        background: rgba(0,0,0,0.1) !important; border: 1px dashed rgba(255,255,255,0.2) !important; box-shadow: none !important; backdrop-filter: none;
        &::before { display: none; }
    }

    /* --- SENT MESSAGES (Right side) --- */
    .sended {
      justify-content: flex-end;
      .content {
        background: var(--adaptive-accent, #4e0eff);
        border-bottom-right-radius: 0.3rem; 
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);

        &::before { right: -6px; background: var(--adaptive-accent, #4e0eff); clip-path: polygon(0 0, 0% 100%, 100% 100%); }
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css` background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); border: 1px solid var(--adaptive-accent, #00ff88); box-shadow: 0 0 15px rgba(0,0,0,0.2); &::before { background: var(--adaptive-accent, #00ff88); clip-path: polygon(0 0, 0% 100%, 100% 50%); right: -6px; bottom: 10px; } `}
        ${({ $themeType }) => $themeType === 'midnight' && css` background: var(--adaptive-accent, #2a2a35); box-shadow: 0 4px 10px rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); &::before { background: var(--adaptive-accent, #2a2a35); } `}
        
        /* FIX: Push sent message actions to the LEFT side */
        .message-actions { 
            right: 100%; /* Pushes out to the left */
            left: auto; 
            margin-right: 8px; 
            margin-left: 0;
            transform: translateX(10px) scale(0.95); 
        } 

        .reactions-display { right: auto; left: 14px; flex-direction: row; .reaction-pill { margin-left: 0; margin-right: -8px; } }
      }
      .tail-physics { transform-origin: bottom right; }
    }
    
    .message-wrapper.grouped-next .sended .content {
        border-bottom-right-radius: 1.2rem; 
        &::before { display: none; } 
    }
    .message-wrapper.grouped-prev .sended .content {
        border-top-right-radius: 0.3rem; 
    }

    /* --- RECEIVED MESSAGES (Left side) --- */
    .recieved {
      justify-content: flex-start;
      .content {
        background: rgba(255, 255, 255, 0.08); 
        border-bottom-left-radius: 0.3rem; 
        backdrop-filter: blur(16px); 
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.06);
        box-shadow: 0 4px 15px rgba(0,0,0,0.08);

        &::before { left: -6px; background: rgba(255, 255, 255, 0.08); clip-path: polygon(100% 0, 0 100%, 100% 100%); backdrop-filter: blur(16px); }
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css` background: rgba(255,0,85,0.15); border-radius: 0.8rem; border-color: rgba(255,0,85,0.4); &::before { background: rgba(255,0,85,0.4); clip-path: polygon(100% 0, 100% 100%, 0 50%); left: -6px; bottom: 10px; } `}
        ${({ $themeType }) => $themeType === 'midnight' && css` background: #1a1a25; border-color: rgba(255,255,255,0.03); &::before { background: #1a1a25; } `}
      }
      .tail-physics { transform-origin: bottom left; }
    }

    .message-wrapper.grouped-next .recieved .content {
        border-bottom-left-radius: 1.2rem; 
        &::before { display: none; } 
    }
    .message-wrapper.grouped-prev .recieved .content {
        border-top-left-radius: 0.3rem; 
    }
    
    .typing-dots {
        display: flex; align-items: center; gap: 4px; height: 15px; padding: 0 5px;
        span { width: 6px; height: 6px; background-color: var(--adaptive-accent, #00ff88); border-radius: 50%; animation: ${bounce} 1.4s infinite ease-in-out both; opacity: 0.8; }
        span:nth-child(1) { animation-delay: -0.32s; }
        span:nth-child(2) { animation-delay: -0.16s; }
    }
  }
`;

export const DropOverlay = styled.div`
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(12px);
    z-index: 100; display: flex; justify-content: center; align-items: center;
    border: 4px dashed var(--adaptive-accent, #4e0eff); border-radius: 1.5rem;
    animation: ${pulseBorder} 2s infinite ease-in-out;
    margin: 10px; width: calc(100% - 20px); height: calc(100% - 20px);
    .overlay-content { 
        text-align: center; color: white; animation: ${springyPop} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
        background: rgba(255, 255, 255, 0.05); padding: 3rem 4rem; border-radius: 2rem; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        h2 { margin: 1rem 0; font-weight: 700; } 
        p { color: rgba(255, 255, 255, 0.7); }
    }
`;

export const ScrollButton = styled.button`
    position: absolute; bottom: 90px; right: 30px; width: 48px; height: 48px;
    border-radius: 50%; background: var(--adaptive-accent, #4e0eff); color: white; border: none;
    cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,0.3); 
    animation: ${springyPop} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex; justify-content: center; align-items: center; z-index: 10;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    font-size: 1.1rem;
    &:hover { filter: brightness(1.15); transform: translateY(-4px) scale(1.08); box-shadow: 0 10px 25px rgba(0,0,0,0.4); }

    .unread-badge {
        position: absolute; top: -6px; right: -6px; background: #ff3366; color: white;
        font-size: 0.75rem; font-weight: 700; min-width: 24px; height: 24px; display: flex;
        justify-content: center; align-items: center; border-radius: 12px; padding: 0 6px;
        border: 2px solid #131324; animation: badgeBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        box-shadow: 0 4px 10px rgba(255, 51, 102, 0.4);
    }

    @keyframes badgeBounce {
        0% { transform: scale(0); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1); }
    }
`;

export const Lightbox = styled.div`
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.85); z-index: 1000; display: flex; justify-content: center; align-items: center;
    backdrop-filter: blur(8px);
    img { max-width: 90%; max-height: 90%; border-radius: 12px; box-shadow: 0 15px 50px rgba(0,0,0,0.6); animation: ${springyPop} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .close-btn { position: absolute; top: 30px; right: 30px; background: rgba(255,255,255,0.1); border-radius: 50%; width: 50px; height: 50px; display: flex; justify-content: center; align-items: center; border: none; color: white; font-size: 1.5rem; cursor: pointer; transition: 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); backdrop-filter: blur(4px); &:hover { transform: scale(1.1); background: rgba(255,78,78,0.8); } }
    
    .receipt-modal {
        background: rgba(20, 20, 35, 0.95); padding: 2.5rem; border-radius: 24px; width: 420px;
        border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 25px 60px rgba(0,0,0,0.8); position: relative;
        color: white; animation: ${slideUpFade} 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        backdrop-filter: blur(20px);
        
        .close-btn-small { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.05); border-radius: 50%; width: 32px; height: 32px; display: flex; justify-content: center; align-items: center; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 1rem; transition: 0.2s; &:hover { background: rgba(255,255,255,0.1); color: #ff4e4e; transform: scale(1.1); } }
        
        h3 { margin-bottom: 1.2rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem; font-weight: 700; letter-spacing: 0.5px; }
        
        .msg-preview { background: rgba(0,0,0,0.4); padding: 1.2rem; border-radius: 12px; font-style: italic; color: rgba(255,255,255,0.8); margin-bottom: 2rem; border-left: 4px solid #34B7F1; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2); }
        
        .readers-list {
            max-height: 300px; overflow-y: auto; padding-right: 5px;
            &::-webkit-scrollbar { width: 4px; } &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            h4 { color: #34B7F1; display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.2rem; font-weight: 600; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.5px; }
            .reader-item { 
                display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.03); padding: 0.8rem 1rem; border-radius: 12px; margin-bottom: 10px; transition: all 0.2s ease; border: 1px solid transparent;
                &:hover { background: rgba(255,255,255,0.06); transform: translateX(4px); border-color: rgba(255,255,255,0.05); }
                .reader-info {
                    display: flex; align-items: center; gap: 12px; flex: 1;
                    .reader-avatar-img { width: 36px; height: 36px; border-radius: 50%; background: #1a1a25; border: 2px solid rgba(52, 183, 241, 0.5); object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
                    .reader-name { font-weight: 600; font-size: 0.95rem; }
                }
                .reader-time { font-size: 0.75rem; color: rgba(255,255,255,0.5); font-weight: 500; }
            }
        }
    }
`;

export const SideInfoPanel = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 340px;
  background: rgba(13, 13, 25, 0.85);
  backdrop-filter: blur(25px);
  -webkit-backdrop-filter: blur(25px);
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  z-index: 50;
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: -10px 0 40px rgba(0, 0, 0, 0.4);

  ${({ $themeType }) => $themeType === 'cyberpunk' && css`
    background: rgba(10, 5, 20, 0.9); border-left: 1px solid rgba(0, 255, 136, 0.3); box-shadow: -10px 0 40px rgba(0, 255, 136, 0.1);
  `}

  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .panel-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.02);
    h3 { color: white; font-size: 1.1rem; margin: 0; font-weight: 600; letter-spacing: 0.5px;}
    button { background: rgba(255,255,255,0.05); border-radius: 50%; width: 36px; height: 36px; display: flex; justify-content: center; align-items: center; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 1rem; transition: 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); &:hover { color: #ff4e4e; transform: scale(1.1) rotate(90deg); background: rgba(255,78,78,0.1); } }
  }

  .tabs {
    display: flex; border-bottom: 1px solid rgba(255,255,255,0.05);
    background: rgba(0,0,0,0.2);
    button { flex: 1; background: none; border: none; padding: 1rem; color: rgba(255,255,255,0.5); font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;
      &.active { color: var(--adaptive-accent, #fff); border-bottom: 3px solid var(--adaptive-accent, #4e0eff); background: rgba(255,255,255,0.03); }
      &:hover:not(.active) { color: white; background: rgba(255,255,255,0.05); }
    }
  }

  .panel-content {
    flex: 1; overflow-y: auto; padding: 1.5rem;
    &::-webkit-scrollbar { width: 4px; } &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    
    .loader { display: flex; justify-content: center; align-items: center; height: 100px; color: var(--adaptive-accent, #4e0eff); font-size: 1.5rem; }
    .empty-state { color: rgba(255,255,255,0.4); text-align: center; margin-top: 3rem; font-style: italic; font-size: 0.9rem; }

    .about-section {
        .profile-hero { 
            text-align: center; margin-bottom: 2.5rem; 
            img { width: 110px; height: 110px; border-radius: 50%; border: 3px solid var(--adaptive-accent, #4e0eff); margin-bottom: 1.2rem; object-fit: cover; box-shadow: 0 8px 25px rgba(0,0,0,0.3); } 
            h3 { color: white; margin: 0; font-size: 1.3rem; font-weight: 700; letter-spacing: 0.5px; } 
            .presence { color: var(--adaptive-accent, #00ff88); font-size: 0.85rem; font-weight: 600; margin-top: 8px; display: inline-block; background: rgba(0,255,136,0.1); padding: 4px 12px; border-radius: 12px;} 
        }
        .info-card { 
            background: rgba(255, 255, 255, 0.03); padding: 1.2rem; border-radius: 1.2rem; margin-bottom: 1.2rem; border: 1px solid rgba(255,255,255,0.05); transition: 0.2s;
            &:hover { background: rgba(255,255,255,0.05); transform: translateY(-2px); border-color: rgba(255,255,255,0.1); }
            label { font-size: 0.7rem; text-transform: uppercase; color: var(--adaptive-accent, #888); font-weight: 700; display: block; margin-bottom: 0.6rem; letter-spacing: 0.5px;} 
            p { color: rgba(255,255,255,0.85); font-size: 0.95rem; line-height: 1.6; margin: 0; } 
        }
        .interests-grid { 
            display: flex; flex-wrap: wrap; gap: 8px; 
            .interest-tag { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.9); padding: 6px 14px; border-radius: 2rem; font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.1); font-weight: 500; transition: 0.2s; cursor: default; &:hover { background: rgba(255,255,255,0.1); border-color: var(--adaptive-accent, #4e0eff); transform: translateY(-2px); }} 
        }
    }

    .media-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
      img, video { width: 100%; height: 95px; object-fit: cover; border-radius: 10px; cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); border: 2px solid transparent; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
      img:hover { transform: scale(1.08); border-color: var(--adaptive-accent, #4e0eff); z-index: 2; box-shadow: 0 10px 25px rgba(0,0,0,0.4); }
    }

    .links-list {
      display: flex; flex-direction: column; gap: 12px;
      .link-item {
        display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.03); padding: 14px; border-radius: 12px; text-decoration: none; transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); border: 1px solid rgba(255,255,255,0.03); margin-bottom: 4px;
        &:hover { background: rgba(255,255,255,0.06); border-color: var(--adaptive-accent, rgba(78, 14, 255, 0.4)); transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
        .link-icon { background: rgba(255,255,255,0.05); color: var(--adaptive-accent, #9a86f3); padding: 12px; border-radius: 10px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; }
        .link-info { overflow: hidden; flex: 1; h4 { color: white; font-size: 0.9rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px; margin-top: 0; } p { color: rgba(255,255,255,0.5); font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; } }
      }
    }
  }
`;