import { create } from 'zustand';

const useChatStore = create((set) => ({
  currentUser: undefined,
  setCurrentUser: (user) => set({ currentUser: user }),

  currentChat: undefined,
  setCurrentChat: (chat) => set({ currentChat: chat }),

  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),

  globalTypingUsers: [],
  setGlobalTypingUsers: (updater) => set((state) => ({
    globalTypingUsers: typeof updater === 'function' ? updater(state.globalTypingUsers) : updater
  })),

  // UI State Management mapped to LocalStorage
  theme: localStorage.getItem("chat-theme") || "glass",
  setTheme: (theme) => {
    localStorage.setItem("chat-theme", theme);
    set({ theme });
  },

  isCompact: localStorage.getItem("chat-compact") === "true",
  setIsCompact: (isCompact) => {
    localStorage.setItem("chat-compact", isCompact);
    set({ isCompact });
  },
}));

export default useChatStore;