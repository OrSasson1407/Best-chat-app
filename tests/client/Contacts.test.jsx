import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Contacts from '../../client/src/components/Sidebar/Contacts'; //[cite: 1]

// Mocking child components if necessary
vi.mock('../../client/src/components/Sidebar/ContactList/ContactList', () => ({
  default: ({ contacts }) => <div data-testid="contact-list">Contacts: {contacts.length}</div>
}));

describe('Contacts Sidebar Component', () => {
  const mockContactsData = [
    { _id: '1', username: 'Alice' },
    { _id: '2', username: 'Bob' },
    { _id: '3', username: 'Charlie' }
  ];

  it('renders the search bar and passes filtered contacts', () => {
    render(<Contacts initialContacts={mockContactsData} />);
    
    const searchInput = screen.getByPlaceholderText(/search contacts/i);
    expect(searchInput).toBeInTheDocument();
    
    // Initially should show all 3
    expect(screen.getByTestId('contact-list')).toHaveTextContent('Contacts: 3');

    // Type in the search bar
    fireEvent.change(searchInput, { target: { value: 'Ali' } });
    
    // Should filter down to 1 (Alice)
    expect(screen.getByTestId('contact-list')).toHaveTextContent('Contacts: 1');
  });
});