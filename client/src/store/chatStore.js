import { create } from 'zustand';
import { set, get, del, keys } from 'idb-keyval';
import { triggerHaptic } from '../utils/haptics';

const useChatStore = create((setStore, getStore) => ({
  messages: [],
  groups: [],
  activeGroup: null,
  offlineQueueCount: 0,
  pendingTimeouts: {}, // Track timeouts to clear them if successful

  setActiveGroup: (groupId) => setStore({ activeGroup: groupId }),
  setMessages: (newMessages) => setStore({ messages: newMessages }),

  loadOfflineQueueCount: async () => {
    const dbKeys = await keys();
    const msgKeys = dbKeys.filter(k => k.toString().startsWith('msg-'));
    setStore({ offlineQueueCount: msgKeys.length });
  },

  sendMessageOptimistic: async (groupId, content, senderId) => {
    const tempId = `temp-${Date.now()}`;
    const isOnline = navigator.onLine;

    const optimisticMessage = {
      _id: tempId,
      groupId,
      content,
      senderId: { _id: senderId },
      status: isOnline ? 'sending' : 'queued',
      createdAt: new Date().toISOString(),
    };

    setStore((state) => ({ messages: [...state.messages, optimisticMessage] }));

    if (!isOnline) {
      await set(`msg-${tempId}`, { groupId, content, senderId, tempId });
      setStore((state) => ({ offlineQueueCount: state.offlineQueueCount + 1 }));
      triggerHaptic('error'); 
    } else {
      // 🔥 High Impact: 10-second timeout auto-rollback if socket ack fails
      const timeoutId = setTimeout(() => {
        getStore().rollbackOptimisticMessage(tempId);
        // You could trigger a global toast here: "Message failed to send"
      }, 10000);
      
      setStore(state => ({
        pendingTimeouts: { ...state.pendingTimeouts, [tempId]: timeoutId }
      }));
    }

    return tempId;
  },

  confirmMessageSent: async (tempId, realMessage) => {
    await del(`msg-${tempId}`);
    
    // Clear the rollback timeout
    const { pendingTimeouts } = getStore();
    if (pendingTimeouts[tempId]) {
      clearTimeout(pendingTimeouts[tempId]);
      const newTimeouts = { ...pendingTimeouts };
      delete newTimeouts[tempId];
      setStore({ pendingTimeouts: newTimeouts });
    }

    setStore((state) => ({
      messages: state.messages.map((msg) =>
        msg._id === tempId ? { ...realMessage, status: 'sent' } : msg
      ),
      offlineQueueCount: Math.max(0, state.offlineQueueCount - 1)
    }));
  },

  receiveRealTimeMessage: (message) => {
    const { activeGroup, messages } = getStore();
    triggerHaptic('message');
    if (message.groupId === activeGroup && !messages.find(m => m._id === message._id)) {
      setStore({ messages: [...messages, message] });
    }
  },

  rollbackOptimisticMessage: (tempId) => {
    setStore((state) => ({
      messages: state.messages.map((msg) => 
        msg._id === tempId ? { ...msg, status: 'failed' } : msg
      )
    }));
  }
}));

export default useChatStore;
