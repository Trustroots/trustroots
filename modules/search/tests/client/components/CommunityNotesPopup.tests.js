import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

import CommunityNotesPopup from '@/modules/search/client/components/CommunityNotesPopup.component';

const BASE_PROPS = {
  content: 'Great camping spot near the river.',
  pubkey: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
  createdAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  verified: false,
  username: null,
  onActionGate: jest.fn(),
};

describe('CommunityNotesPopup', () => {
  beforeEach(() => {
    BASE_PROPS.onActionGate.mockClear();
  });

  it('renders note content', () => {
    render(<CommunityNotesPopup {...BASE_PROPS} />);
    expect(
      screen.getByText('Great camping spot near the river.'),
    ).toBeInTheDocument();
  });

  it('shows verified indicator when verified=true', () => {
    render(<CommunityNotesPopup {...BASE_PROPS} verified={true} />);
    expect(screen.getByText(/verified/i)).toBeInTheDocument();
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('does not show verified indicator when verified=false', () => {
    render(<CommunityNotesPopup {...BASE_PROPS} verified={false} />);
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
  });

  it('links to Trustroots profile when username is known', () => {
    render(<CommunityNotesPopup {...BASE_PROPS} username="alice" />);
    const links = screen.getAllByRole('link', { name: 'alice' });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute('href', '/profile/alice');
  });

  it('shows truncated pubkey when no username is provided', () => {
    render(<CommunityNotesPopup {...BASE_PROPS} username={null} />);
    // Truncated form of the pubkey: first 6 chars + ellipsis + last 4 chars
    expect(screen.getByText(/abcdef.*90ab/)).toBeInTheDocument();
  });

  it('shows "via Nostroots" attribution', () => {
    render(<CommunityNotesPopup {...BASE_PROPS} />);
    expect(screen.getByText(/via Nostroots/i)).toBeInTheDocument();
  });

  it('calls onActionGate when "Reply on Nostroots" is clicked', () => {
    render(<CommunityNotesPopup {...BASE_PROPS} />);
    const replyBtn = screen.getByRole('button', {
      name: /reply on nostroots/i,
    });
    fireEvent.click(replyBtn);
    expect(BASE_PROPS.onActionGate).toHaveBeenCalledTimes(1);
  });

  it('shows "View profile" link when username is known', () => {
    render(<CommunityNotesPopup {...BASE_PROPS} username="bob" />);
    const viewProfileLink = screen.getByRole('link', { name: /view profile/i });
    expect(viewProfileLink).toHaveAttribute('href', '/profile/bob');
  });

  it('does not show "View profile" link when username is null', () => {
    render(<CommunityNotesPopup {...BASE_PROPS} username={null} />);
    expect(
      screen.queryByRole('link', { name: /view profile/i }),
    ).not.toBeInTheDocument();
  });
});
