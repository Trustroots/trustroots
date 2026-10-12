import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { nostrService } from '@/modules/search/client/services/nostr.client.service';
import type NostrootsActionModal from '@/modules/core/client/components/NostrootsActionModal.component';
import ProfileNostrBadge from '@/modules/users/client/components/ProfileNostrBadge.component';

type NostrEvent = Awaited<
  ReturnType<typeof nostrService.fetchUserNotes>
>[number];
const fetchUserNotesMock = jest.mocked(nostrService.fetchUserNotes);

function note(id: string, content: string, createdAt: number): NostrEvent {
  return {
    id,
    pubkey: 'fictional-author-key',
    created_at: createdAt,
    kind: 1,
    tags: [],
    content,
    sig: 'fictional-signature',
  };
}

const recentNotes = [
  note('note1', 'Great spot near Prague!', 1_700_000_000),
  note('note2', 'Free camping by the river', 1_700_000_001),
];

jest.mock('@/modules/search/client/services/nostr.client.service', () => ({
  __esModule: true,
  default: class NostrService {},
  nostrService: {
    fetchUserNotes: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  },
}));

jest.mock(
  '@/modules/core/client/components/NostrootsActionModal.component',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');

    function MockNostrootsActionModal({
      isOpen,
      onClose,
    }: React.ComponentProps<typeof NostrootsActionModal>) {
      if (!isOpen) return null;
      return React.createElement(
        'div',
        { 'data-testid': 'nostroots-modal' },
        React.createElement(
          'button',
          { type: 'button', onClick: onClose },
          'Close modal',
        ),
      );
    }

    return { __esModule: true, default: MockNostrootsActionModal };
  },
);

describe('ProfileNostrBadge', () => {
  beforeEach(() => {
    fetchUserNotesMock.mockClear();
    fetchUserNotesMock.mockResolvedValue(recentNotes);
  });

  it('renders badge with "Nostroots" text when user has notes', async () => {
    render(<ProfileNostrBadge npubHex="abc123def456" />);
    await waitFor(() => {
      expect(screen.getByText('Nostroots')).toBeInTheDocument();
    });
  });

  it('renders recent notes content', async () => {
    render(<ProfileNostrBadge npubHex="abc123def456" />);
    await waitFor(() => {
      expect(screen.getByText('Great spot near Prague!')).toBeInTheDocument();
      expect(screen.getByText('Free camping by the river')).toBeInTheDocument();
    });
    expect(screen.getByText('Recent community notes')).toBeInTheDocument();
  });

  it('renders nothing when npubHex is not provided', () => {
    const { container } = render(<ProfileNostrBadge npubHex={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens and closes the Nostroots action modal from the notes link', async () => {
    render(<ProfileNostrBadge npubHex="abc123def456" />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: /See all notes on Nostroots/,
      }),
    );

    expect(screen.getByTestId('nostroots-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(screen.queryByTestId('nostroots-modal')).not.toBeInTheDocument();
  });

  it('renders nothing when note fetching fails', async () => {
    fetchUserNotesMock.mockRejectedValueOnce(new Error('relay unavailable'));

    const { container } = render(<ProfileNostrBadge npubHex="abc123def456" />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('ignores note results that arrive after unmount', async () => {
    let resolveNotes!: (notes: NostrEvent[]) => void;
    fetchUserNotesMock.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveNotes = resolve;
        }),
    );

    const { unmount } = render(<ProfileNostrBadge npubHex="abc123def456" />);

    unmount();

    resolveNotes([note('late-note', 'Late note', 1_700_000_002)]);
    await Promise.resolve();
  });
});
