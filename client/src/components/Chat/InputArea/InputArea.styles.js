// InputArea styles are defined inline within ChatInput.jsx using styled-components.
// This file re-exports them for any consumers that need them separately,
// and provides the QuickReplies fa-spin keyframe for consistency.

import { keyframes } from "styled-components";

export const faSpin = keyframes`
  to { transform: rotate(360deg); }
`;
