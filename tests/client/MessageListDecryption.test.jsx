import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MessageList from '../../client/src/components/Chat/MessageWindow/MessageList';
import * as cryptoUtils from '../../client/src/utils/crypto'; // Import to mock

// Mock the decryption utility to simulate async lag
vi.mock('../../client/src/utils/crypto', () => ({
  decryptMessage: vi.fn()
}));

describe('MessageList Decryption Rendering', () => {
  const mockMessages = [
    { _id: '1', text: 'U2FsdGVkX19+encryp7edD4t4', isEncrypted: true, sender: { username: 'Bob' } }
  ];

  it('shows a loading state, then decrypts and renders the message safely', async () => {
    // Delay the mock decryption to simulate real CPU work
    cryptoUtils.decryptMessage.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve('Decrypted Secret Message'), 100))
    );

    render(<MessageList messages={mockMessages} />);

    // 1. Immediately after render, the raw ciphertext MUST NOT be visible
    expect(screen.queryByText('U2FsdGVkX19+encryp7edD4t4')).not.toBeInTheDocument();
    
    // 2. A fallback or loader should be visible while decrypting
    expect(screen.getByText(/decrypting/i)).toBeInTheDocument();

    // 3. Wait for the async effect to resolve and update the DOM
    await waitFor(() => {
      expect(screen.getByText('Decrypted Secret Message')).toBeInTheDocument();
    });
    
    // Ensure the loader is gone
    expect(screen.queryByText(/decrypting/i)).not.toBeInTheDocument();
  });
});