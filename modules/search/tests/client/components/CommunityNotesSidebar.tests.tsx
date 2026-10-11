import React from 'react';
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import CommunityNotesSidebar from '@/modules/search/client/components/CommunityNotesSidebar.component';
import { nostrService } from '@/modules/search/client/services/nostr.client.service';

type CommunityNoteEvent = React.ComponentProps<
  typeof CommunityNotesSidebar
>['notes'][number];
type NostrNoteFixture = Pick<
  CommunityNoteEvent,
  'id' | 'content' | 'pubkey' | 'created_at' | 'tags'
> &
  Partial<CommunityNoteEvent>;
type SidebarProps = React.ComponentProps<typeof CommunityNotesSidebar>;

jest.mock('@/modules/search/client/services/nostr.client.service', () => {
  return {
    __esModule: true,
    default: class NostrService {},
    nostrService: {
      resolveNpubToUsername: jest.fn((pubkey: string) => {
        if (pubkey.startsWith('pubkey1111')) {
          return Promise.resolve('alice');
        }
        return Promise.resolve(null);
      }),
    },
  };
});

jest.mock(
  '@/modules/core/client/components/NostrootsActionModal.component',
  () => {
    function MockNostrootsActionModal({
      isOpen,
      onClose,
    }: React.ComponentProps<
      typeof import('@/modules/core/client/components/NostrootsActionModal.component').default
    >) {
      if (!isOpen) return null;
      return (
        <div data-testid="nostroots-modal">
          <button type="button" onClick={onClose}>
            Close modal
          </button>
        </div>
      );
    }

    return { __esModule: true, default: MockNostrootsActionModal };
  },
);

const resolveNpubToUsername = jest.mocked(nostrService.resolveNpubToUsername);

const NOTES: NostrNoteFixture[] = [
  {
    id: 'note-older',
    content: 'Older note at this spot',
    pubkey: 'validationserver1111111111111111111111111111111111111111111111',
    authorPubkey:
      'pubkey1111111111111111111111111111111111111111111111111111111111',
    created_at: Math.floor(Date.now() / 1000) - 7200,
    tags: [],
  },
  {
    id: 'note-newer',
    content: 'Newer note at this spot',
    pubkey: 'pubkey2222222222222222222222222222222222222222222222222222222222',
    created_at: Math.floor(Date.now() / 1000) - 60,
    tags: [],
  },
];

function renderNotes(notes?: NostrNoteFixture[]) {
  // Note fixtures intentionally omit unused Nostr event fields. Passing
  // undefined also preserves the component's missing-notes regression case.
  const props = {
    ...(notes === undefined
      ? {}
      : { notes: notes as unknown as SidebarProps['notes'] }),
    plusCode: '9F2X+3Q',
  } as unknown as SidebarProps;
  return render(<CommunityNotesSidebar {...props} />);
}

describe('CommunityNotesSidebar', () => {
  beforeEach(() => {
    resolveNpubToUsername.mockClear();
    resolveNpubToUsername.mockImplementation(pubkey => {
      if (pubkey.startsWith('pubkey1111')) {
        return Promise.resolve('alice');
      }
      return Promise.resolve(null);
    });
  });

  it('renders thread header with note count and plus code', () => {
    renderNotes(NOTES);

    expect(screen.getByText('Community Notes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('9F2X+3Q')).toBeInTheDocument();
  });

  it('renders notes with the newest message lowest', () => {
    renderNotes(NOTES);

    const contents = screen.getAllByText(/note at this spot/);
    expect(contents[0]).toHaveTextContent('Older note at this spot');
    expect(contents[1]).toHaveTextContent('Newer note at this spot');
  });

  it('resolves author usernames and links to profiles', async () => {
    renderNotes(NOTES);

    await waitFor(() => {
      expect(resolveNpubToUsername).toHaveBeenCalledWith(
        'pubkey1111111111111111111111111111111111111111111111111111111111',
      );
      expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute(
        'href',
        '/profile/alice',
      );
    });
  });

  it('opens the Nostroots action modal when Reply is clicked', () => {
    renderNotes(NOTES);

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    expect(screen.getByTestId('nostroots-modal')).toBeInTheDocument();
  });

  it('closes the Nostroots action modal', () => {
    renderNotes(NOTES);

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }));

    expect(screen.queryByTestId('nostroots-modal')).not.toBeInTheDocument();
  });

  it('renders nothing when notes are empty', () => {
    const { container } = renderNotes([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when notes are missing', () => {
    const { container } = renderNotes();
    expect(container).toBeEmptyDOMElement();
  });

  it('does not resolve usernames when notes have no author pubkey', () => {
    renderNotes([
      {
        id: 'note-without-author',
        content: 'Anonymous-looking note',
        pubkey: '',
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
      },
    ]);

    expect(resolveNpubToUsername).not.toHaveBeenCalled();
  });

  it('keeps the pubkey fallback when username lookup fails', async () => {
    resolveNpubToUsername.mockRejectedValueOnce(new Error('relay unavailable'));

    renderNotes(NOTES);

    await waitFor(() => expect(resolveNpubToUsername).toHaveBeenCalled());
    expect(screen.getByText('pubkey222222...')).toBeInTheDocument();
  });

  it('ignores username lookups that settle after unmount', async () => {
    let resolveLookup!: (name: string | null) => void;
    resolveNpubToUsername.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveLookup = resolve;
        }),
    );

    const { unmount } = renderNotes(NOTES);

    unmount();

    await act(async () => {
      resolveLookup('alice');
      await Promise.resolve();
    });

    expect(resolveNpubToUsername).toHaveBeenCalled();
  });
});
