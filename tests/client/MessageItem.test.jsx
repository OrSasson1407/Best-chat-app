import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MessageItem from '../../client/src/components/Chat/MessageWindow/MessageItem';

describe('MessageItem Component', () => {
  const mockMessage = {
    _id: '1',
    text: 'Test chat message',
    sender: { username: 'Alice' },
    createdAt: new Date().toISOString()
  };

  it('renders the message text and sender correctly', () => {
    render(<MessageItem message={mockMessage} isOwnMessage={false} />);
    
    expect(screen.getByText('Test chat message')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('applies the correct styling for own messages', () => {
    // Assuming your component uses a specific CSS class for the user's own messages
    const { container } = render(<MessageItem message={mockMessage} isOwnMessage={true} />);
    
    // Check if the specific class (e.g., 'own-message') is applied
    expect(container.firstChild).toHaveClass('own-message'); 
  });
});