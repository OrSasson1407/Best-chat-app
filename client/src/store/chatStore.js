import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
// CRITICAL FIX: Alias the idb-keyval imports to prevent collision with Zustand's (set, get)
import { get as idbGet, set as idbSet, del as idbDel, clear as idbClear } from 'idb-keyval'; 

// --- CUSTOM INDEXED-DB STORAGE ENGINE ---
const idbStorage = {
  getItem: async (name) => (await idbGet(name)) || null,
  setItem: async (name, value) => await idbSet(name, value),
  removeItem: async (name) => await idbDel(name),
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
          // FIX: Use idbGet instead of Zustand's get()
          const cached = await idbGet(`chat_history_${chatId}`);
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
        // FIX: Use idbSet instead of Zustand's set() to prevent destroying the global state
        await idbSet(`chat_history_${chatId}`, messages);
      },

      // =================================================================
      // --- 4.5. TRIPLE HANDSHAKE MERGE: OPTIMISTIC UI STATE ACTIONS ---
      // =================================================================

      // 1. Instantly push a pending message into the UI state (Clock Icon)
      addMessage: async (chatId, message) => {
        const state = get();
        const currentMessages = state.offlineMessages[chatId] || [];
        const newMessages = [...currentMessages, message];
        
        // Update memory immediately
        set({
            offlineMessages: { ...state.offlineMessages, [chatId]: newMessages }
        });
        
        // Update IDB in the background so it survives a refresh
        await idbSet(`chat_history_${chatId}`, newMessages);
      },

      // 2. Replace the localId with the real dbId when the server acknowledges (One Checkmark)
      updateMessageStatus: async (chatId, localId, dbId, status) => {
        const state = get();
        const currentMessages = state.offlineMessages[chatId] || [];
        
        const newMessages = currentMessages.map((msg) => 
            msg.localId === localId 
                ? { ...msg, _id: dbId, status: status } 
                : msg
        );

        set({
            offlineMessages: { ...state.offlineMessages, [chatId]: newMessages }
        });
        
        await idbSet(`chat_history_${chatId}`, newMessages);
      },

      // =================================================================

      // --- 5. SECURE CLEANUP ---
      clearCache: async () => {
        // FIX: Use idbClear instead of clear()
        await idbClear(); 
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