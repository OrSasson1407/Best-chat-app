import styled, { keyframes } from "styled-components";

export const shimmer = keyframes`
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
`;

export const pulseRing = keyframes`
  0%   { transform: scale(0.9); opacity: 0.9; }
  70%  { transform: scale(1.1); opacity: 0; }
  100% { transform: scale(0.9); opacity: 0; }
`;

export const ContactItemWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  background: transparent;

  &:hover { background: var(--input-bg); }
  
  &.selected { 
    background: var(--bg-overlay); 
    box-shadow: inset 4px 0 0 var(--msg-sent); 
  }
  
  &.pinned {
    background: rgba(124, 58, 237, 0.05);
  }

  /* Skeleton animation classes */
  &.skeleton .skeleton-anim {
    background: linear-gradient(90deg, var(--input-bg) 25%, var(--bg-overlay) 50%, var(--input-bg) 75%);
    background-size: 200% 100%;
    animation: ${shimmer} 1.5s infinite;
  }
`;