import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

// --- CUSTOM INDEXED-DB STORAGE ENGINE ---
// This allows Zustand to store massive amounts of chat history offline
// without blocking the main UI thread (unlike localStorage).
const idbStorage = {
  getItem: async (name) => {
    const value = await get(name);
    return value || null;
  },
  setItem: async (name, value) => {
    await set(name, value);
  },
  removeItem: async (name) => {
    await del(name);
  },
};

const useChatStore = create(
  persist(
    (set) => ({
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

      // Theme & Compact states
      theme: "glass", // Default, will be overwritten by persist
      setTheme: (theme) => set({ theme }),

      isCompact: false, // Default, will be overwritten by persist
      setIsCompact: (isCompact) => set({ isCompact }),

      // --- OFFLINE MESSAGE CACHING ---
      // Store messages keyed by chatId: { "chatId_123": [msg1, msg2], ... }
      offlineMessages: {},
      
      // Save fetched messages to local device for offline viewing
      cacheMessages: (chatId, messages) => set((state) => ({
        offlineMessages: {
          ...state.offlineMessages,
          [chatId]: messages
        }
      })),

      // Clear cache when logging out
      clearCache: () => set({ offlineMessages: {}, currentUser: undefined, currentChat: undefined })
    }),
    {
      name: 'best-chat-app-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => idbStorage), 
      // Only save specific fields to IndexedDB to avoid saving volatile socket states
      partialize: (state) => ({ 
          currentUser: state.currentUser, 
          theme: state.theme, 
          isCompact: state.isCompact,
          offlineMessages: state.offlineMessages 
      }),
    }
  )
);

export default useChatStore;