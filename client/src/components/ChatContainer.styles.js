// client/src/components/ChatContainer.styles.js
import styled, { keyframes, css } from "styled-components";

const popIn = keyframes`
  0% { transform: scale(0.8) translateY(10px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
`;

const shimmer = keyframes`
  0% { background-position: -468px 0; }
  100% { background-position: 468px 0; }
`;

const pulse = keyframes`
  0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; }
`;

// --- NEW: BOUNCING DOTS ANIMATION ---
const bounce = keyframes`
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-5px); }
`;

export const Container = styled.div`
  display: grid; 
  grid-template-rows: ${({ $hasPinned }) => $hasPinned ? '10% auto 1fr 10%' : '10% 1fr 10%'}; 
  overflow: hidden;
  height: 100%;
  position: relative;
  
  ${({ $isCompact, $hasPinned }) => $isCompact && css`
      grid-template-rows: ${$hasPinned ? '8% auto 1fr 10%' : '8% 1fr 10%'};
  `}

  .fa-spin { animation: spin 2s infinite linear; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(359deg); } }

  /* --- NEW: SEARCH HIGHLIGHT STYLING --- */
  .search-highlight {
      background: #ffcc00; color: #000; padding: 0 2px; border-radius: 3px; font-weight: bold;
      box-shadow: 0 0 8px rgba(255, 204, 0, 0.6);
  }

  .pinned-banner {
      background: rgba(0, 255, 136, 0.1); border-bottom: 1px solid rgba(0, 255, 136, 0.3);
      padding: 0.5rem 2rem; display: flex; align-items: center; gap: 1rem; color: #00ff88; cursor: pointer;
      backdrop-filter: blur(10px); z-index: 2; transition: background 0.2s;
      &:hover { background: rgba(0, 255, 136, 0.15); }
      .pin-content { 
          display: flex; flex-direction: column; 
          .pin-title { font-size: 0.7rem; font-weight: bold; } 
          .pin-text { font-size: 0.85rem; color: #ccc; } 
      }
  }

  .chat-header {
    display: flex; justify-content: space-between; align-items: center; 
    padding: 0 2rem;
    background: rgba(255, 255, 255, 0.02); 
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(5px); z-index: 2;
    
    ${({ $themeType }) => $themeType === 'cyberpunk' && css`border-bottom: 1px solid #00ff88;`}
    ${({ $themeType }) => $themeType === 'midnight' && css`border-bottom: 1px solid #333;`}
    
    .user-details {
      display: flex; align-items: center; justify-content: space-between; width: 100%;
      
      .header-info {
          display: flex; flex-direction: column;
          h3 { 
              color: white; font-weight: 500; margin-bottom: 2px;
              ${({ $isCompact }) => $isCompact && css`font-size: 1rem;`} 
          }
          .presence-info {
              display: flex; align-items: center; gap: 6px; margin-top: -2px; margin-bottom: 4px;
              .status-dot {
                  width: 8px; height: 8px; border-radius: 50%; background: #555;
                  &.online { background: #00ff88; box-shadow: 0 0 5px #00ff88; }
              }
              span { font-size: 0.75rem; color: #aaa; &.online { color: #00ff88; } }
          }
          .chat-bio { font-size: 0.75rem; color: #aaa; display: flex; align-items: center; gap: 0.3rem; cursor: help; }
      }
    }
    
    .admin-controls {
        display: flex; align-items: center; gap: 1rem;
        .chat-search-input { background: rgba(0,0,0,0.3); color: white; border: 1px solid #00ff88; padding: 0.4rem 0.8rem; border-radius: 1rem; outline: none; font-size: 0.8rem; animation: ${popIn} 0.2s ease-out;}
        .huddle-btn { background: #4e0eff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-weight: bold; transition: 0.2s; &:hover { background: #00ff88; color: black; box-shadow: 0 4px 15px rgba(0, 255, 136, 0.4); } }
        .admin-badge { background: rgba(0, 255, 136, 0.1); color: #00ff88; padding: 0.3rem 0.6rem; border-radius: 0.5rem; border: 1px solid #00ff88; font-size: 0.7rem; font-weight: bold; display: flex; align-items: center; gap: 0.3rem; }
        .action-icon { color: #00ff88; cursor: pointer; font-size: 1.2rem; transition: 0.2s; &:hover { transform: scale(1.1); color: white; } &.blocked { color: #ff0055; } }
    }
  }

  .chat-messages-container {
    height: 100%; width: 100%; overflow: hidden; position: relative;
    padding: ${({ $isCompact }) => $isCompact ? '1rem 1.5rem' : '1.5rem 2rem'};
    z-index: 1;

    /* --- NEW: THEMED CHAT WALLPAPERS --- */
    &::before {
        content: ""; position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: -1; pointer-events: none; opacity: 0.4;
        /* Default Glass Theme */
        background-image: radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px);
        background-size: 20px 20px;
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css`
            background-image: 
                linear-gradient(rgba(0, 255, 136, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 136, 0.1) 1px, transparent 1px);
            background-size: 30px 30px;
            opacity: 0.2;
        `}
        
        ${({ $themeType }) => $themeType === 'midnight' && css`
            background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
            background-size: 15px 15px;
            opacity: 0.5;
        `}
    }
    
    .virtuoso-scroll { 
        height: 100% !important; width: 100% !important; 
        &::-webkit-scrollbar { width: 4px; } 
        &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 1rem; } 
    }

    .loading-older { text-align: center; padding: 1rem; color: #00ff88; font-size: 0.85rem; }
    
    .skeleton-container { display: flex; flex-direction: column; gap: 1.2rem; }
    .skeleton-msg .content { background: #2a2a35; border: none !important; border-radius: 1rem; }
    .skeleton-anim { background-image: linear-gradient(to right, #2a2a35 0%, #3a3a45 20%, #2a2a35 40%, #2a2a35 100%); background-repeat: no-repeat; background-size: 800px 100%; animation: ${shimmer} 1.5s infinite linear forwards; }

    .date-separator {
        display: flex; justify-content: center; align-items: center; margin: 1.5rem 0; position: relative;
        span { 
            background: rgba(13, 13, 30, 0.6); border: 1px solid rgba(255,255,255,0.1); 
            padding: 0.3rem 1rem; border-radius: 2rem; font-size: 0.75rem; 
            color: #aaa; z-index: 1; backdrop-filter: blur(5px); 
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
        &::after { 
            content: ""; position: absolute; width: 100%; height: 1px; 
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); 
            top: 50%; z-index: 0; 
        }
    }

    .highlight-flash .content { animation: flashBg 1.5s ease-out; }
    @keyframes flashBg { 0% { background-color: rgba(255, 255, 255, 0.4); box-shadow: 0 0 20px rgba(255,255,255,0.5); } 100% { background-color: inherit; box-shadow: inherit; } }

    .message-wrapper { padding-bottom: 1.2rem; animation: ${popIn} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards; transition: padding 0.2s ease; }
    .message-wrapper.grouped-next { padding-bottom: 3px; }

    .message {
      display: flex; align-items: center; position: relative;
      
      .content {
        max-width: 65%;
        padding: 0.9rem 1.2rem;
        border-radius: 1.5rem;
        color: #fff; line-height: 1.4; display: flex; flex-direction: column;
        position: relative; min-width: 140px; 
        transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease, border-radius 0.2s ease;
        
        &:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }

        &::before { content: ""; position: absolute; bottom: 0; width: 16px; height: 16px; z-index: -1; }

        .sender-name { font-size: 0.75rem; color: #00ff88; font-weight: bold; margin-bottom: 4px; text-transform: capitalize; }
        .deleted-text { font-style: italic; color: rgba(255,255,255,0.4); font-size: 0.9rem; }
        .edited-tag { font-size: 0.6rem; opacity: 0.5; margin-left: 5px; font-style: italic; }
        .forwarded-tag { font-size: 0.7rem; color: #aaa; margin-bottom: 0.5rem; font-style: italic; display: flex; align-items: center; gap: 0.3rem; }
        
        .view-once-btn { background: linear-gradient(90deg, #ff0055, #ff5500); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 15px rgba(255,0,85,0.4); }

        .link-preview {
            display: flex; flex-direction: column; gap: 0.6rem; margin: 4px 0;
            .preview-card {
                background: rgba(0,0,0,0.25); border-radius: 0.8rem; overflow: hidden; text-decoration: none; color: white; border: 1px solid rgba(255,255,255,0.1); transition: 0.2s;
                &:hover { background: rgba(0,0,0,0.4); transform: scale(1.01); border-color: var(--adaptive-accent, rgba(78, 14, 255, 0.5)); }
                img { width: 100%; height: 160px; object-fit: cover; }
                .preview-info { padding: 0.8rem; h4 { margin: 0; font-size: 0.95rem; color: #00ff88; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } p { margin: 6px 0 0; font-size: 0.8rem; color: #ccc; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3; } }
            }
        }

        .poll-container {
            background: rgba(0,0,0,0.2); padding: 1.2rem; border-radius: 1rem; border: 1px solid rgba(255,255,255,0.1); min-width: 260px; margin: 6px 0;
            h4 { margin: 0 0 1rem 0; color: #00ff88; display: flex; align-items: center; gap: 0.6rem; font-size: 1rem; }
            .poll-option {
                position: relative; background: rgba(255,255,255,0.06); padding: 0.7rem; border-radius: 0.6rem; margin-bottom: 0.6rem; cursor: pointer; overflow: hidden; display: flex; justify-content: space-between; border: 1px solid transparent; transition: 0.2s;
                &:hover { border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); }
                &.voted { border-color: #00ff88; background: rgba(0,255,136,0.05); box-shadow: 0 0 10px rgba(0,255,136,0.1); }
                .poll-bar { position: absolute; top: 0; left: 0; height: 100%; background: rgba(0,255,136,0.2); z-index: 0; transition: width 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .opt-text, .opt-percent { position: relative; z-index: 1; font-size: 0.9rem; font-weight: 500; }
            }
        }

        .quoted-message {
            background: rgba(0,0,0,0.25); border-left: 4px solid #00ff88; padding: 0.6rem; border-radius: 0.4rem; font-size: 0.8rem; margin-bottom: 0.6rem; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: 0.2s;
            &:hover { background: rgba(0,0,0,0.4); border-color: #fff; }
            span { font-weight: bold; color: #00ff88; }
        }

        .code-snippet { background: #1e1e1e; padding: 1rem; border-radius: 0.6rem; overflow-x: auto; font-family: 'JetBrains Mono', 'Fira Code', monospace; color: #00ff88; border: 1px solid #333; margin: 0.6rem 0; box-shadow: inset 0 0 10px rgba(0,0,0,0.5); code { white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; } }
        .msg-image { max-width: 100%; border-radius: 0.8rem; margin-top: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .msg-image.clickable { cursor: pointer; transition: transform 0.2s; &:hover { transform: scale(1.02); } }
        .msg-video { max-width: 100%; border-radius: 0.8rem; margin-top: 6px; outline: none; }
        .msg-audio { max-width: 240px; margin-top: 6px; height: 40px; }
        .msg-file-link { display: flex; align-items: center; gap: 0.6rem; background: rgba(255,255,255,0.1); padding: 0.6rem 1.2rem; border-radius: 0.6rem; color: #00ff88; text-decoration: none; margin-top: 6px; font-weight: bold; font-size: 0.9rem; transition: 0.2s; &:hover { background: rgba(255,255,255,0.2); color: #fff; transform: translateY(-2px); } }

        .meta {
            display: flex; justify-content: flex-end; align-items: center;
            gap: 6px; font-size: 0.65rem; opacity: 0.6; margin-top: 8px;
            .timer-icon { color: #ff5500; font-size: 0.75rem; animation: ${pulse} 2s infinite; }
            
            .read-status { font-weight: bold; font-size: 0.8rem; display: flex; align-items: center; transition: 0.2s; }
            .read-status-wrapper {
                display: flex; align-items: center; gap: 4px; border-radius: 12px; padding: 2px 6px; transition: 0.2s;
                &.has-avatars { background: rgba(0,0,0,0.2); }
                &:hover.has-avatars { background: rgba(0,0,0,0.4); }
            }
            .reader-avatars { display: flex; align-items: center; margin-right: 2px; }
            .tiny-avatar {
                width: 14px; height: 14px; border-radius: 50%; border: 1px solid #4e0eff;
                margin-left: -6px; background: #1a1a25; object-fit: cover;
                &:first-child { margin-left: 0; }
            }
            .more-readers { font-size: 0.55rem; color: #aaa; margin-left: 3px; font-weight: bold; }
        }

        .message-actions {
            position: absolute; top: -18px; right: 10px;
            background: #1a1a25; padding: 0.4rem 0.6rem; border-radius: 2rem;
            display: flex; gap: 0.6rem; opacity: 0; visibility: hidden; 
            transition: 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.6); z-index: 5;
            transform: translateY(10px);
            
            button, .reaction-trigger {
                background: none; border: none; color: #888; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: 0.2s; &:hover { color: #fff; transform: scale(1.1); }
            }

            .reaction-trigger:hover .reaction-menu { display: flex; }
            .reaction-menu {
                display: none; position: absolute; bottom: 130%; left: 50%;
                transform: translateX(-50%); background: #1a1a25; padding: 0.5rem;
                border-radius: 2rem; gap: 0.6rem; box-shadow: 0 4px 15px rgba(0,0,0,0.6);
                animation: ${popIn} 0.2s ease-out;
                .reaction-emoji-btn { cursor: pointer; transition: 0.2s; font-size: 1.3rem; display: inline-block; &:hover { transform: scale(1.4) translateY(-2px); } }
            }
        }

        &:hover .message-actions { opacity: 1; visibility: visible; transform: translateY(0); }

        .reactions-display {
            position: absolute; bottom: -12px; right: 14px;
            display: flex; flex-direction: row-reverse;
            gap: -6px; 
            z-index: 3;
            
            .reaction-pill {
                background: #1a1a25; padding: 0.1rem 0.3rem; border-radius: 1rem;
                font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 2px 5px rgba(0,0,0,0.4); margin-left: -8px; 
                cursor: pointer; transition: 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex; align-items: center; justify-content: center;
                
                &:hover { transform: scale(1.25) translateY(-2px); z-index: 10; border-color: var(--adaptive-accent, #4e0eff); }
                .reaction-anim { display: inline-block; animation: ${popIn} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
            }
        }
      }
    }

    .deleted-msg .content {
        background: transparent !important; border: 1px dashed rgba(255,255,255,0.2) !important; box-shadow: none !important;
        &::before { display: none; }
    }

    /* --- MERGE UPDATE: ADAPTIVE THEME BUBBLES --- */
    .sended {
      justify-content: flex-end;
      .content {
        background: var(--adaptive-accent, #4e0eff);
        border-bottom-right-radius: 0.2rem;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);

        &::before { right: -7px; background: var(--adaptive-accent, #4e0eff); clip-path: polygon(0 0, 0% 100%, 100% 100%); }
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css` background: transparent; border: 1px solid var(--adaptive-accent, #00ff88); box-shadow: 0 0 15px rgba(0,0,0,0.3); &::before { background: var(--adaptive-accent, #00ff88); clip-path: polygon(0 0, 0% 100%, 100% 50%); right: -6px; bottom: 10px; } `}
        ${({ $themeType }) => $themeType === 'midnight' && css` background: var(--adaptive-accent, #222); box-shadow: none; border: 1px solid #444; &::before { background: var(--adaptive-accent, #444); } `}
      }
      .message-actions { right: auto; left: 10px; } 
      .reactions-display { right: auto; left: 14px; flex-direction: row; .reaction-pill { margin-left: 0; margin-right: -8px; } }
      .tail-physics { transform-origin: bottom right; }
    }
    
    .message-wrapper.grouped-next .sended .content {
        border-bottom-right-radius: 1.5rem; 
        &::before { display: none; } 
    }
    .message-wrapper.grouped-prev .sended .content {
        border-top-right-radius: 0.2rem; 
    }

    .recieved {
      justify-content: flex-start;
      .content {
        background: rgba(255, 255, 255, 0.07); 
        border-bottom-left-radius: 0.2rem; 
        backdrop-filter: blur(12px); 
        border: 1px solid rgba(255,255,255,0.05);

        &::before { left: -7px; background: rgba(255, 255, 255, 0.07); clip-path: polygon(100% 0, 0 100%, 100% 100%); }
        
        ${({ $themeType }) => $themeType === 'cyberpunk' && css` background: rgba(255,0,85,0.1); border-radius: 0.5rem; border-color: #ff0055; &::before { background: #ff0055; clip-path: polygon(100% 0, 100% 100%, 0 50%); left: -6px; bottom: 10px; } `}
        ${({ $themeType }) => $themeType === 'midnight' && css` background: #111; border-color: #222; &::before { background: #222; } `}
      }
      .tail-physics { transform-origin: bottom left; }
    }

    .message-wrapper.grouped-next .recieved .content {
        border-bottom-left-radius: 1.5rem; 
        &::before { display: none; } 
    }
    .message-wrapper.grouped-prev .recieved .content {
        border-top-left-radius: 0.2rem; 
    }
    
    /* --- NEW: IN-CHAT TYPING BUBBLE STYLES --- */
    .typing-dots {
        display: flex; align-items: center; gap: 4px; height: 15px; padding: 0 5px;
        span { width: 6px; height: 6px; background-color: #00ff88; border-radius: 50%; animation: ${bounce} 1.4s infinite ease-in-out both; }
        span:nth-child(1) { animation-delay: -0.32s; }
        span:nth-child(2) { animation-delay: -0.16s; }
    }
  }
`;

export const DropOverlay = styled.div`
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(78, 14, 255, 0.1); backdrop-filter: blur(8px);
    z-index: 100; display: flex; justify-content: center; align-items: center;
    border: 3px dashed #4e0eff; border-radius: 2rem;
    .overlay-content { text-align: center; color: white; animation: ${popIn} 0.4s ease; h2 { margin: 1rem 0; } }
`;

export const ScrollButton = styled.button`
    position: absolute; bottom: 90px; right: 30px; width: 45px; height: 45px;
    border-radius: 50%; background: var(--adaptive-accent, #4e0eff); color: white; border: none;
    cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.4); animation: ${popIn} 0.3s ease;
    display: flex; justify-content: center; align-items: center; z-index: 10;
    transition: 0.3s;
    &:hover { filter: brightness(1.2); transform: translateY(-3px) scale(1.05); }

    .unread-badge {
        position: absolute; top: -5px; right: -5px; background: #ff4e4e; color: white;
        font-size: 0.75rem; font-weight: bold; width: 22px; height: 22px; display: flex;
        justify-content: center; align-items: center; border-radius: 50%;
        border: 2px solid #131324; animation: badgeBounce 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes badgeBounce {
        0% { transform: scale(0); }
        50% { transform: scale(1.3); }
        100% { transform: scale(1); }
    }
`;

export const Lightbox = styled.div`
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.9); z-index: 1000; display: flex; justify-content: center; align-items: center;
    backdrop-filter: blur(5px);
    img { max-width: 90%; max-height: 90%; border-radius: 10px; box-shadow: 0 0 30px rgba(0,0,0,0.5); animation: ${popIn} 0.3s ease; }
    .close-btn { position: absolute; top: 20px; right: 20px; background: none; border: none; color: white; font-size: 2.5rem; cursor: pointer; transition: 0.2s; &:hover { transform: scale(1.2); color: #ff4e4e; } }
    
    .receipt-modal {
        background: #0d0d30; padding: 2rem; border-radius: 1.5rem; width: 400px;
        border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 15px 40px rgba(0,0,0,0.6); position: relative;
        color: white; animation: ${popIn} 0.3s ease;
        .close-btn-small { position: absolute; top: 15px; right: 15px; background: none; border: none; color: #aaa; cursor: pointer; font-size: 1.2rem; transition: 0.2s; &:hover { color: #ff4e4e; transform: scale(1.2); } }
        h3 { margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; font-weight: 600; }
        .msg-preview { background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 0.5rem; font-style: italic; color: #ccc; margin-bottom: 1.5rem; border-left: 3px solid #34B7F1; }
        .readers-list {
            h4 { color: #34B7F1; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
            .reader-item { 
                display: flex; align-items: center; gap: 0.8rem; background: rgba(255,255,255,0.05); padding: 0.8rem; border-radius: 0.5rem; margin-bottom: 8px; transition: 0.2s;
                &:hover { background: rgba(255,255,255,0.1); transform: translateX(5px); }
                .reader-info {
                    display: flex; align-items: center; gap: 10px; flex: 1;
                    .reader-avatar-img { width: 30px; height: 30px; border-radius: 50%; background: #1a1a25; border: 1px solid #4e0eff; object-fit: cover; }
                    .reader-name { font-weight: 500; font-size: 0.95rem; }
                }
                .reader-time { font-size: 0.75rem; color: #888; font-style: italic; }
            }
        }
    }
`;

// --- NEW: SIDE INFO PANEL (Replaced MediaGalleryPanel) ---
export const SideInfoPanel = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 340px;
  background: rgba(13, 13, 35, 0.98);
  backdrop-filter: blur(25px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 50;
  display: flex;
  flex-direction: column;
  animation: slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: -10px 0 40px rgba(0, 0, 0, 0.7);

  ${({ $themeType }) => $themeType === 'cyberpunk' && css`
    background: rgba(13, 2, 33, 0.98); border-left: 1px solid #00ff88; box-shadow: -10px 0 40px rgba(0, 255, 136, 0.1);
  `}

  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  .panel-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);
    h3 { color: white; font-size: 1.1rem; margin: 0; }
    button { background: none; border: none; color: #888; cursor: pointer; font-size: 1.2rem; transition: 0.2s; &:hover { color: #ff4e4e; transform: scale(1.1) rotate(90deg); } }
  }

  .tabs {
    display: flex; border-bottom: 1px solid rgba(255,255,255,0.05);
    button { flex: 1; background: none; border: none; padding: 1rem; color: #888; font-weight: bold; cursor: pointer; transition: 0.2s;
      &.active { color: var(--adaptive-accent, #4e0eff); border-bottom: 3px solid var(--adaptive-accent, #4e0eff); background: rgba(78, 14, 255, 0.05); }
      &:hover:not(.active) { color: white; background: rgba(255,255,255,0.05); }
    }
  }

  .panel-content {
    flex: 1; overflow-y: auto; padding: 1.5rem;
    &::-webkit-scrollbar { width: 4px; } &::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 10px; }
    
    .loader { display: flex; justify-content: center; align-items: center; height: 100px; color: var(--adaptive-accent, #4e0eff); font-size: 1.5rem; }
    .empty-state { color: #666; text-align: center; margin-top: 2rem; font-style: italic; font-size: 0.9rem; }

    .about-section {
        .profile-hero { 
            text-align: center; margin-bottom: 2rem; 
            img { width: 100px; height: 100px; border-radius: 50%; border: 3px solid var(--adaptive-accent, #4e0eff); margin-bottom: 1rem; object-fit: cover; } 
            h3 { color: white; margin: 0; font-size: 1.2rem; } 
            .presence { color: #00ff88; font-size: 0.85rem; font-style: italic; margin-top: 5px; } 
        }
        .info-card { 
            background: rgba(255, 255, 255, 0.03); padding: 1.2rem; border-radius: 1rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05); 
            label { font-size: 0.7rem; text-transform: uppercase; color: var(--adaptive-accent, #4e0eff); font-weight: bold; display: block; margin-bottom: 0.5rem; } 
            p { color: #ccc; font-size: 0.95rem; line-height: 1.5; margin: 0; } 
        }
        .interests-grid { 
            display: flex; flex-wrap: wrap; gap: 8px; 
            .interest-tag { background: rgba(78, 14, 255, 0.2); color: #9a86f3; padding: 4px 12px; border-radius: 1rem; font-size: 0.8rem; border: 1px solid rgba(78, 14, 255, 0.3); } 
        }
    }

    .media-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
      img, video { width: 100%; height: 90px; object-fit: cover; border-radius: 8px; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
      img:hover { transform: scale(1.05); border-color: var(--adaptive-accent, #4e0eff); z-index: 2; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
    }

    .links-list {
      display: flex; flex-direction: column; gap: 10px;
      .link-item {
        display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 10px; text-decoration: none; transition: 0.2s; border: 1px solid transparent; margin-bottom: 8px;
        &:hover { background: rgba(255,255,255,0.08); border-color: rgba(78, 14, 255, 0.3); transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .link-icon { background: rgba(78, 14, 255, 0.2); color: #9a86f3; padding: 10px; border-radius: 8px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; }
        .link-info { overflow: hidden; h4 { color: white; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; margin-top: 0; } p { color: #888; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; } }
      }
    }
  }
`;