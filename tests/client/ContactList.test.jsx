import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ContactList from '../../client/src/components/Sidebar/ContactList/ContactList';

describe('ContactList Component', () => {
  const mockContacts = [
    { _id: '1', username: 'Alice', isOnline: true },
    { _id: '2', username: 'Bob', isOnline: false }
  ];

  it('renders a list of contacts', () => {
    render(<ContactList contacts={mockContacts} onContactSelect={() => {}} />);
    
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('fires the selection callback when a contact is clicked', () => {
    const onSelectMock = vi.fn();
    render(<ContactList contacts={mockContacts} onContactSelect={onSelectMock} />);
    
    const aliceElement = screen.getByText('Alice');
    fireEvent.click(aliceElement);
    
    expect(onSelectMock).toHaveBeenCalledTimes(1);
    expect(onSelectMock).toHaveBeenCalledWith(mockContacts[0]);
  });
});