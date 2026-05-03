import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatInput from '../../client/src/components/Chat/InputArea/ChatInput';

describe('ChatInput Component', () => {
  it('updates the input field when typing', () => {
    render(<ChatInput onSendMessage={() => {}} />);
    
    const inputElement = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(inputElement, { target: { value: 'Hello World' } });
    
    expect(inputElement.value).toBe('Hello World');
  });

  it('calls onSendMessage and clears input when form is submitted', () => {
    const onSendMessageMock = vi.fn();
    render(<ChatInput onSendMessage={onSendMessageMock} />);
    
    const inputElement = screen.getByPlaceholderText(/type a message/i);
    const sendButton = screen.getByRole('button', { name: /send/i });

    // Type a message
    fireEvent.change(inputElement, { target: { value: 'Test Message' } });
    
    // Click send
    fireEvent.click(sendButton);
    
    expect(onSendMessageMock).toHaveBeenCalledTimes(1);
    expect(onSendMessageMock).toHaveBeenCalledWith('Test Message');
    expect(inputElement.value).toBe(''); // Should clear after sending
  });
});