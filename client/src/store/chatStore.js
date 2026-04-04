import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
// CRITICAL FIX: Alias the idb-keyval imports to prevent collision with Zustand's (set, get)
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'; // keys/del imported dynamically in clearCache

// --- CUSTOM INDEXED-DB STORAGE ENGINE ---
const idbStorage = {
  getItem: async (name) => (await idbGet(name)) || null,
  setItem: async (name, value) => await idbSet(name, value),
  removeItem: async (name) => await idbDel(name),
};

const useChatStore = create(
  persist(
    (set, get) => ({
      // --- HYDRATION FLAG: true once IDB has finished loading ---
      _hasHydrated: false,
      setHasHydrated: (val) => set({ _hasHydrated: val }),

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
      setOnlineUsers: (usersOrUpdater) => set((state) => ({
        onlineUsers: typeof usersOrUpdater === 'function'
          ? usersOrUpdater(state.onlineUsers)
          : usersOrUpdater
      })),

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
            // MEMORY EVICTION FIX: Replace the whole object instead of spreading.
            // This ensures ONLY the active chat sits in RAM; old ones are garbage collected.
            set({ offlineMessages: { [chatId]: cached } });
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
        // MEMORY EVICTION FIX: Keep only the active chat in memory
        set({ offlineMessages: { [chatId]: messages } });
        
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
        
        // Update memory immediately (respecting eviction constraint)
        set({ offlineMessages: { [chatId]: newMessages } });
        
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

        // Update memory immediately (respecting eviction constraint)
        set({ offlineMessages: { [chatId]: newMessages } });
        
        await idbSet(`chat_history_${chatId}`, newMessages);
      },

      // =================================================================

      // --- 5. SECURE CLEANUP ---
      clearCache: async (userId) => {
        // FIX: Don't use idbClear() — it wipes the ENTIRE IndexedDB origin, destroying
        // other tabs' chat history too. Instead delete only keys owned by this user.
        if (userId) {
          const { keys } = await import('idb-keyval');
          const allKeys = await keys();
          const userKeys = allKeys.filter(k => 
            typeof k === 'string' && k.includes(userId)
          );
          const { del } = await import('idb-keyval');
          await Promise.all(userKeys.map(k => del(k)));
        }
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
      // FIX: Use a tab-scoped key so each tab has its own isolated settings store.
      // sessionStorage.getItem returns null in other tabs, giving a unique-enough key
      // per tab. Falls back to a shared name only on first load (before sessionStorage
      // is written), which is fine because currentUser is no longer persisted here.
      name: `best-chat-app-settings-${sessionStorage.getItem('chat-app-token')?.slice(-8) || 'default'}`,
      storage: createJSONStorage(() => idbStorage), 
      // FIX: Do NOT persist currentUser here. IDB is shared across all tabs of the
      // same origin, so persisting currentUser here causes Tab A's user to bleed into
      // Tab B when it rehydrates. Identity must come exclusively from sessionStorage
      // (which IS tab-isolated by the browser spec) — see Chat.jsx mount effect.
      partialize: (state) => ({ 
        theme: state.theme, 
        isCompact: state.isCompact,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.setHasHydrated(true);
      },
    }
  )
);

export default useChatStore;