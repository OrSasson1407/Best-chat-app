import { describe, it, expect, beforeEach } from 'vitest';
import useChatStore from '../../client/src/store/chatStore'; //[cite: 1]

describe('Chat Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useChatStore.setState({ messages: [], activeChat: null, onlineUsers: [] });
  });

  it('should set the active chat', () => {
    const { setActiveChat } = useChatStore.getState();
    const chatData = { _id: 'chat1', name: 'Dev Team' };
    
    setActiveChat(chatData);
    
    expect(useChatStore.getState().activeChat).toEqual(chatData);
  });

  it('should update the online users list', () => {
    const { setOnlineUsers } = useChatStore.getState();
    const users = ['user1', 'user2'];
    
    setOnlineUsers(users);
    
    expect(useChatStore.getState().onlineUsers).toHaveLength(2);
    expect(useChatStore.getState().onlineUsers).toContain('user1');
  });
});