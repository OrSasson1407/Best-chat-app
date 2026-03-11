import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del, clear } from 'idb-keyval'; // Added 'clear'

// --- CUSTOM INDEXED-DB STORAGE ENGINE ---
const idbStorage = {
  getItem: async (name) => (await get(name)) || null,
  setItem: async (name, value) => await set(name, value),
  removeItem: async (name) => await del(name),
};

const useChatStore = create(
  persist(
    (set, get) => ({
      // --- 1. AUTH & USER STATE ---
      currentUser: undefined,
      setCurrentUser: (user) => set({ currentUser: user }),
      
      // Helper to update specific user fields (e.g., changing avatar) without overwriting the token
      updateCurrentUser: (updates) => set((state) => ({
        currentUser: state.currentUser ? { ...state.currentUser, ...updates } : undefined
      })),

      // --- 2. ACTIVE CHAT STATE (Volatile, never persisted) ---
      currentChat: undefined,
      setCurrentChat: (chat) => set({ currentChat: chat }),

      onlineUsers: [],
      setOnlineUsers: (users) => set({ onlineUsers: users }),

      globalTypingUsers: [],
      setGlobalTypingUsers: (updater) => set((state) => ({
        globalTypingUsers: typeof updater === 'function' ? updater(state.globalTypingUsers) : updater
      })),

      // --- 3. UI PREFERENCES (Persisted globally) ---
      theme: "glass", 
      setTheme: (theme) => set({ theme }),

      isCompact: false, 
      setIsCompact: (isCompact) => set({ isCompact }),

      // --- 4. HEAVY OFFLINE CACHING (Optimized Direct IDB Access) ---
      // Kept in memory for fast UI access, but saved to IDB individually to avoid lag
      offlineMessages: {},
      
      // Fetches a specific chat's history from IndexedDB into memory
      loadOfflineMessages: async (chatId) => {
        try {
          const cached = await get(`chat_history_${chatId}`);
          if (cached) {
            set((state) => ({
              offlineMessages: { ...state.offlineMessages, [chatId]: cached }
            }));
            return cached;
          }
          return [];
        } catch (error) {
          console.error("Failed to load offline messages", error);
          return [];
        }
      },

      // Caches messages directly to their own IDB key, bypassing Zustand's heavy global stringify
      cacheMessages: async (chatId, messages) => {
        // 1. Update memory for instant UI rendering
        set((state) => ({
          offlineMessages: { ...state.offlineMessages, [chatId]: messages }
        }));
        // 2. Write directly to IDB asynchronously
        await set(`chat_history_${chatId}`, messages);
      },

      // --- 5. SECURE CLEANUP ---
      clearCache: async () => {
        await clear(); // Completely wipes all IndexedDB data (including all separate chat histories)
        set({ 
            offlineMessages: {}, 
            currentUser: undefined, 
            currentChat: undefined,
            onlineUsers: [],
            globalTypingUsers: []
        });
      }
    }),
    {
      name: 'best-chat-app-settings', 
      storage: createJSONStorage(() => idbStorage), 
      // CRITICAL FIX: We exclude offlineMessages here so Zustand only saves the lightweight UI/Auth state
      partialize: (state) => ({ 
        currentUser: state.currentUser, 
        theme: state.theme, 
        isCompact: state.isCompact,
      }),
    }
  )
);

export default useChatStore;