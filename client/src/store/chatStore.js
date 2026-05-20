import { create } from 'zustand';

/**
 * Advanced Zustand Store with Optimistic UI rendering.
 */
const useChatStore = create((set, get) => ({
  messages: [],
  groups: [],
  activeGroup: null,
  isTyping: false,

  setActiveGroup: (groupId) => set({ activeGroup: groupId }),

  // Set messages fetched from the decoupled HTTP backend
  setMessages: (newMessages) => set({ messages: newMessages }),

  // Optimistic UI update: Instantly show message before server ack
  sendMessageOptimistic: (groupId, content, senderId) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      groupId,
      content,
      senderId: { _id: senderId }, // Mock populated user
      status: 'sending',
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, optimisticMessage]
    }));

    return tempId; // Return temp ID so the socket can replace it later
  },

  // Called when Socket acknowledges the real message
  confirmMessageSent: (tempId, realMessage) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg._id === tempId ? { ...realMessage, status: 'sent' } : msg
      )
    }));
  },

  // Called when receiving a message from someone else via Socket
  receiveRealTimeMessage: (message) => {
    const { activeGroup, messages } = get();
    // Only append if it belongs to the currently open chat
    if (message.groupId === activeGroup) {
      set({ messages: [...messages, message] });
    }
  },

  // Rollback function in case the socket/API fails
  rollbackOptimisticMessage: (tempId) => {
    set((state) => ({
      messages: state.messages.filter((msg) => msg._id !== tempId)
    }));
  }
}));

export default useChatStore;
