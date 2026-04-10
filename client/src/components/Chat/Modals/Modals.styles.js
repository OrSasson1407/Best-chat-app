import styled from "styled-components";

// ── MODAL OVERLAY (shared base for SummaryModal & GlobalSearchModal) ─────────
export const ModalOverlay = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.9); z-index: var(--z-modal);
  display: flex; justify-content: center; align-items: center;
  backdrop-filter: blur(12px);
  animation: fadeIn 0.2s var(--ease-out);
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .modal-card {
    background: var(--glass-noise), var(--bg-panel); padding: 2rem;
    border-radius: var(--radius-xl); width: min(400px, 92vw);
    border: 1px solid var(--glass-border); box-shadow: var(--glass-shadow);
    position: relative; color: var(--text-primary);
    animation: slideUp 0.3s var(--ease-spring);
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

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
      display: flex; align-items: center;
    }
  }

  .fa-spin { animation: spin 1.2s infinite linear; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
