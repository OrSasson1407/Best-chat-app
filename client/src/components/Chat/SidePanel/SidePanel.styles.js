import styled from "styled-components";

export const SideInfoPanel = styled.div`
  position: absolute; top: 0; right: 0; height: 100%;
  width: clamp(280px, 30%, 360px);
  background: var(--glass-noise), var(--bg-panel);
  border-left: 1px solid var(--glass-border); z-index: 50;
  display: flex; flex-direction: column;
  animation: slideInRight 0.35s var(--ease-spring);
  box-shadow: -8px 0 32px rgba(0,0,0,0.2);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  overflow: hidden;

  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
  }

  .panel-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 16px 20px; border-bottom: 1px solid var(--glass-border);
    h3 { font-size: var(--text-base); font-weight: 700; color: var(--text-primary); }
  }

  .tabs {
    display: flex; border-bottom: 1px solid var(--glass-border);
    button {
      flex: 1; background: none; border: none;
      padding: 12px; color: var(--text-secondary); font-weight: 600; cursor: pointer;
      transition: all var(--duration-base); font-size: var(--text-2xs);
      text-transform: uppercase; letter-spacing: 0.6px;
      font-family: 'Plus Jakarta Sans', sans-serif;
      border-bottom: 2px solid transparent;
      &.active {
        color: var(--text-primary); border-bottom-color: var(--msg-sent);
        background: rgba(124,58,237,0.06);
      }
      &:hover:not(.active) { color: var(--text-primary); background: var(--input-bg); }
    }
  }

  .panel-content {
    flex: 1; overflow-y: auto; overflow-x: hidden; padding: 16px 20px;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 99px; }

    .loader { display: flex; justify-content: center; align-items: center; height: 80px; color: var(--msg-sent); font-size: 1.5rem; }
    .empty-state { color: var(--text-secondary); text-align: center; margin-top: 2.5rem; font-style: italic; font-size: var(--text-sm); }
    .tab-search {
      display: flex; align-items: center;
      background: var(--input-bg); border: 1px solid var(--glass-border);
      border-radius: var(--radius-md); padding: 8px 12px; margin-bottom: 16px;
      .icon { color: var(--text-tertiary); margin-right: 8px; }
      input { background: none; border: none; color: var(--text-primary); outline: none; width: 100%; font-size: var(--text-sm); font-family: 'Plus Jakarta Sans', sans-serif; }
    }
  }

  @media (max-width: 640px) {
    width: 100%;
    position: fixed; top: 0; right: 0; z-index: var(--z-modal);
  }

  .fa-spin { animation: spin 1.2s infinite linear; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
