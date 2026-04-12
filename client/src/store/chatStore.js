import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

const idbStorage = {
  getItem:    async (name) => (await idbGet(name)) || null,
  setItem:    async (name, value) => await idbSet(name, value),
  removeItem: async (name) => await idbDel(name),
};

const useChatStore = create(
  persist(
    (set, get) => ({

      // ── Hydration ──────────────────────────────────────────────────────────
      _hasHydrated: false,
      setHasHydrated: (val) => set({ _hasHydrated: val }),

      // ── 1. Auth & User ─────────────────────────────────────────────────────
      currentUser: undefined,
      setCurrentUser: (user) => set({ currentUser: user }),
      updateCurrentUser: (updates) => set((state) => ({
        currentUser: state.currentUser ? { ...state.currentUser, ...updates } : undefined,
      })),

      // ── 2. Active Chat ─────────────────────────────────────────────────────
      currentChat: undefined,
      setCurrentChat: (chat) => set({ currentChat: chat }),

      onlineUsers: [],
      setOnlineUsers: (usersOrUpdater) => set((state) => ({
        onlineUsers: typeof usersOrUpdater === 'function'
          ? usersOrUpdater(state.onlineUsers)
          : usersOrUpdater,
      })),

      globalTypingUsers: [],
      setGlobalTypingUsers: (updater) => set((state) => ({
        globalTypingUsers: typeof updater === 'function' ? updater(state.globalTypingUsers) : updater,
      })),

      // ── 3. UI Toggle States (New: Replaces prop-drilling) ──────────────────
      showSearch: false,
      setShowSearch: (val) => set({ showSearch: val }),
      
      searchQuery: "",
      setSearchQuery: (val) => set({ searchQuery: val }),
      
      showSidePanel: false,
      setShowSidePanel: (val) => set({ showSidePanel: val }),
      
      activeSideTab: "about",
      setActiveSideTab: (val) => set({ activeSideTab: val }),
      
      showCallModal: false,
      setShowCallModal: (val) => set({ showCallModal: val }),
      
      incomingCallData: null,
      setIncomingCallData: (val) => set({ incomingCallData: val }),
      
      showGlobalSearchModal: false,
      setShowGlobalSearchModal: (val) => set({ showGlobalSearchModal: val }),

      // ── Sprint 1: Unread counts ────────────────────────────────────────────
      unreadCounts: {},
      incrementUnread: (chatId) => set((state) => ({
        unreadCounts: { ...state.unreadCounts, [chatId]: (state.unreadCounts[chatId] || 0) + 1 },
      })),
      clearUnread: (chatId) => set((state) => {
        const next = { ...state.unreadCounts };
        delete next[chatId];
        return { unreadCounts: next };
      }),

      // ── Sprint 2: Muted chats ─────────────────────────────────────────────
      mutedChats: {},
      setMutedChats: (mutedArr) => {
        const map = {};
        (mutedArr || []).forEach(({ chatId, until }) => {
          map[String(chatId)] = until ? new Date(until) : null;
        });
        set({ mutedChats: map });
      },
      isChatMuted: (chatId) => {
        const { mutedChats } = get();
        const until = mutedChats[String(chatId)];
        if (until === undefined) return false;    
        if (until === null) return true;          
        return new Date(until) > new Date();      
      },

      // ── Sprint 2: Chat folders ─────────────────────────────────────────────
      chatFolders: [],
      setChatFolders: (folders) => set({ chatFolders: folders }),

      // ── Sprint 2: Friend requests badge ───────────────────────────────────
      pendingRequestCount: 0,
      setPendingRequestCount: (n) => set({ pendingRequestCount: n }),

      // ── 4. UI Preferences (persisted) ──────────────────────────────────────
      theme: "glass",
      setTheme: (theme) => set({ theme }),

      isCompact: false,
      setIsCompact: (isCompact) => set({ isCompact }),

      // ── 5. Offline Message Cache ───────────────────────────────────────────
      offlineMessages: {},

      loadOfflineMessages: async (chatId) => {
        try {
          const cached = await idbGet(`chat_history_${chatId}`);
          if (cached) { set((state) => ({ offlineMessages: { ...state.offlineMessages, [chatId]: cached } })); return cached; }
          return [];
        } catch (error) { console.error("Failed to load offline messages", error); return []; }
      },

      cacheMessages: async (chatId, messages) => {
        // FIX BUG 7: Merge into existing offlineMessages instead of replacing the
        // whole object — otherwise caching one chat wipes all other chats' caches.
        set((state) => ({ offlineMessages: { ...state.offlineMessages, [chatId]: messages } }));
        await idbSet(`chat_history_${chatId}`, messages);
      },

      addMessage: async (chatId, incomingMsg) => {
        // Normalize real-time socket payloads — socket sends `msg`, UI reads `message`.
        const normalizedMsg = {
          ...incomingMsg,
          id: incomingMsg.id || incomingMsg._id,
          message: typeof incomingMsg.message === "object"
            ? incomingMsg.message.text
            : (incomingMsg.message ?? incomingMsg.msg),
        };

        // FIX BUG 7: Use set() with an updater function so we always read the latest
        // state snapshot. The old pattern did get() then set() in two separate steps —
        // if two messages arrived in quick succession the second get() could read stale
        // state and the first message would be lost from the IndexedDB cache.
        let newMessages;
        set((state) => {
          newMessages = [...(state.offlineMessages[chatId] || []), normalizedMsg];
          return { offlineMessages: { ...state.offlineMessages, [chatId]: newMessages } };
        });
        await idbSet(`chat_history_${chatId}`, newMessages);
      },

      updateMessageStatus: async (chatId, localId, dbId, status) => {
        // FIX BUG 7: Same merge fix — use updater function and spread existing chats.
        let newMessages;
        set((state) => {
          newMessages = (state.offlineMessages[chatId] || []).map((msg) =>
            msg.localId === localId ? { ...msg, _id: dbId, status } : msg
          );
          return { offlineMessages: { ...state.offlineMessages, [chatId]: newMessages } };
        });
        await idbSet(`chat_history_${chatId}`, newMessages);
      },

      // ── 6. Secure Cleanup ─────────────────────────────────────────────────
      clearCache: async (userId) => {
        if (userId) {
          const { keys, del } = await import('idb-keyval');
          const allKeys = await keys();
          await Promise.all(
            allKeys
              .filter((k) => typeof k === 'string' && (k.includes(userId) || k.startsWith('chat_history_')))
              .map((k) => del(k))
          );
        }
        set({
          offlineMessages: {}, currentUser: undefined, currentChat: undefined,
          onlineUsers: [], globalTypingUsers: [],
          mutedChats: {}, chatFolders: [], pendingRequestCount: 0,
          showSearch: false, searchQuery: "", showSidePanel: false, 
          showCallModal: false, showGlobalSearchModal: false
        });
      },
    }),
    {
      // CRITICAL FIX: Use a static versioned key to prevent UI preference loss on token refresh
      name: 'best-chat-app-settings-v1',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ theme: state.theme, isCompact: state.isCompact }),
      onRehydrateStorage: () => (state) => { if (state) state.setHasHydrated(true); },
    }
  )
);

export default useChatStore;