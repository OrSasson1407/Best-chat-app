/**
 * CENTRALIZED THEME TOKENS
 * ---------------------------------------------------
 * Import this object into any styled-component or React file.
 * It maps directly to the CSS variables in index.css.
 * * Usage example:
 * import theme from '../utils/theme';
 * * const DeleteButton = styled.button`
 * color: ${theme.colors.danger};
 * background: ${theme.glass.bg};
 * font-size: ${theme.typography.sm};
 * `;
 */

export const theme = {
  colors: {
    bg: 'var(--bg-color)',
    layout: 'var(--bg-layout)',
    panel: 'var(--bg-panel)',
    textMain: 'var(--text-main)',
    textDim: 'var(--text-dim)',
    msgSent: 'var(--msg-sent)',
    msgReceived: 'var(--msg-received)',
    inputBg: 'var(--input-bg)',
    
    // Semantic Status Colors
    success: 'var(--color-success)',
    danger: 'var(--color-danger)',
    warning: 'var(--color-warning)',
    info: 'var(--color-info)',
    
    // Specific Brand/Feature Colors
    readTick: 'var(--color-read-tick)',
    star: 'var(--color-star)',
    adaptiveAccent: 'var(--adaptive-accent)',
  },
  glass: {
    bg: 'var(--glass-bg)',
    border: 'var(--glass-border)',
    shadow: 'var(--glass-shadow)',
    blur: 'var(--glass-blur)',
    noise: 'var(--glass-noise)',
  },
  typography: {
    xs: 'var(--text-xs)',
    sm: 'var(--text-sm)',
    base: 'var(--text-base)',
    lg: 'var(--text-lg)',
    xl: 'var(--text-xl)',
    xxl: 'var(--text-2xl)',
  },
  transitions: {
    speed: 'var(--transition-speed)',
  },
  zIndex: {
    base: 'var(--z-base)',
    dropdown: 'var(--z-dropdown)',
    sticky: 'var(--z-sticky)',
    modalOverlay: 'var(--z-modal-overlay)',
    modal: 'var(--z-modal)',
    toast: 'var(--z-toast)',
  }
};

export default theme;