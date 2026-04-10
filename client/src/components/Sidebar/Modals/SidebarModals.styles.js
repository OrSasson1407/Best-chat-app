import styled from "styled-components";

export const ModalOverlay = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  z-index: 9999; display: flex; justify-content: center; align-items: center; padding: 20px;

  .modal-content {
    background: var(--bg-panel); border-radius: var(--radius-lg); padding: 24px;
    width: 100%; max-width: 400px; border: 1px solid var(--glass-border);
    box-shadow: 0 20px 40px rgba(0,0,0,0.4); display: flex; flexDirection: column; gap: 16px;

    h3 { margin: 0 0 10px 0; color: var(--text-main); font-size: 1.25rem; font-weight: 800; text-align: center; }

    .input-field {
      display: flex; flexDirection: column; gap: 8px; position: relative;
      label { font-size: var(--text-xs); color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
      input, textarea {
        background: var(--input-bg); border: 1px solid var(--glass-border); border-radius: var(--radius-md);
        padding: 12px 14px; color: var(--text-main); font-size: var(--text-sm); outline: none; transition: 0.2s;
        &:focus { border-color: var(--msg-sent); box-shadow: 0 0 0 2px rgba(124,58,237,0.2); }
      }
      .inner-icon { position: absolute; left: 14px; top: 38px; color: var(--text-dim); }
    }

    .scroll-list {
      max-height: 250px; overflow-y: auto; background: var(--input-bg); border: 1px solid var(--glass-border);
      border-radius: var(--radius-md); padding: 8px; display: flex; flexDirection: column; gap: 4px;
      
      .select-item {
        display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; cursor: pointer; transition: 0.2s;
        img { width: 32px; height: 32px; border-radius: 50%; }
        span { color: var(--text-main); font-size: 0.9rem; flex: 1; }
        .check { color: var(--msg-sent); }
        &:hover { background: var(--bg-overlay); }
        &.selected { background: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.3); }
      }
    }

    .center-loading { display: flex; justify-content: center; align-items: center; height: 90px; font-size: 1.4rem; color: var(--msg-sent); }
    
    .button-group {
      display: flex; gap: 10px;
      button {
        flex: 1; padding: 13px; border-radius: var(--radius-md); font-weight: 700; font-size: 0.9rem;
        cursor: pointer; transition: 0.2s; border: none;
      }
      .btn-primary { background: var(--msg-sent); color: white; }
      .btn-secondary { background: var(--bg-overlay); color: var(--text-main); border: 1px solid var(--glass-border); }
    }
  }
`;