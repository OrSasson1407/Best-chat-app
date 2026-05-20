import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AppShell from '../../client/src/components/Common/AppShell';

// Mocking child components and theme context
jest.mock('../../client/src/components/Common/ThemeToggle', () => () => <button data-testid="theme-toggle">Toggle</button>);
jest.mock('../../client/src/components/Common/OfflineBanner', () => ({ isOffline }) => isOffline ? <div data-testid="offline-banner">Offline</div> : null);

describe('AppShell Component UI Tests', () => {
  // Test 11
  it('11. renders child components properly within the shell layout', () => {
    render(<AppShell><div data-testid="child-content">Child Content</div></AppShell>);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  // Test 12
  it('12. renders the theme toggle button in the header', () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
  });

  // Test 13
  it('13. displays the offline banner when network is disconnected', () => {
    // Simulate offline state (implementation depends on context, assuming prop injection for testing)
    render(<AppShell isOffline={true}>Content</AppShell>);
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
  });

  // Test 14
  it('14. opens the user profile modal when clicking the avatar', () => {
    render(<AppShell>Content</AppShell>);
    const avatarBtn = screen.getByRole('button', { name: /user profile/i });
    fireEvent.click(avatarBtn);
    expect(screen.getByText(/profile settings/i)).toBeInTheDocument();
  });

  // Test 15
  it('15. triggers the logout flow when logout button is clicked', () => {
    const mockLogout = jest.fn();
    render(<AppShell onLogout={mockLogout}>Content</AppShell>);
    const logoutBtn = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutBtn);
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});