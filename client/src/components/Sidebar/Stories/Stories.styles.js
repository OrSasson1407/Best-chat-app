import styled from "styled-components";
import { motion } from "framer-motion";

export const StoryTray = styled.div`
  display: flex;
  gap: 14px;
  padding: 0 20px 15px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  border-bottom: 1px solid var(--glass-border);
  margin-bottom: 10px;

  &::-webkit-scrollbar {
    display: none;
  }

  .story-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    flex-shrink: 0;
    width: 60px;
    
    p {
      font-size: 0.7rem;
      color: var(--text-main);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      width: 100%;
      text-align: center;
    }
  }

  .story-ring {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    padding: 3px;
    position: relative;
    
    img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid var(--bg-panel);
    }
    
    &.unread {
      background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
    }
    
    &.read {
      background: var(--glass-border);
    }
    
    &.empty {
      background: transparent;
      border: 2px dashed var(--glass-border);
      padding: 2px;
    }
    
    .add-icon {
      position: absolute;
      bottom: 0;
      right: 0;
      background: var(--msg-sent);
      color: white;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      border: 2px solid var(--bg-panel);
    }
  }
`;

export const StoryPreviewTooltip = styled(motion.div)`
  position: absolute;
  top: 90px;
  left: 20px;
  z-index: 100;
  background: var(--bg-panel);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  
  img {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    object-fit: cover;
  }
  
  .info {
    h4 {
      margin: 0 0 4px 0;
      color: var(--text-main);
      font-size: 0.9rem;
    }
    p {
      margin: 0;
      color: var(--text-dim);
      font-size: 0.75rem;
    }
  }
`;