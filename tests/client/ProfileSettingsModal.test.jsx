import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProfileSettingsModal from '../../client/src/components/Sidebar/Modals/ProfileSettingsModal'; //[cite: 1]

describe('Profile Settings Modal Component', () => {
  const mockUser = {
    username: 'Noy',
    status: 'Available',
    email: 'test@test.com'
  };

  it('renders the user\'s current information', () => {
    render(<ProfileSettingsModal user={mockUser} isOpen={true} onClose={() => {}} />);
    
    expect(screen.getByDisplayValue('Noy')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Available')).toBeInTheDocument();
    expect(screen.getByText('test@test.com')).toBeInTheDocument();
  });

  it('calls the update handler when saving changes', () => {
    const handleSaveMock = vi.fn();
    render(<ProfileSettingsModal user={mockUser} isOpen={true} onClose={() => {}} onSave={handleSaveMock} />);
    
    const statusInput = screen.getByDisplayValue('Available');
    const saveButton = screen.getByRole('button', { name: /save/i });

    // Update status
    fireEvent.change(statusInput, { target: { value: 'In a meeting' } });
    fireEvent.click(saveButton);
    
    expect(handleSaveMock).toHaveBeenCalledTimes(1);
    expect(handleSaveMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'In a meeting'
    }));
  });
});