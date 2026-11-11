import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/config/client/i18n';
import HackersCircleChat from '@/modules/tribes/client/components/HackersCircleChat';
import {
  connectRadioSigner,
  fetchRadioAuthorUsernames,
  HACKERS_CHAT_TOPIC,
  RadioRoom,
} from '@/modules/tribes/client/services/radio.client.service';
import type { UserProfile } from '@/modules/users/client/types';
import type { Event } from 'nostr-tools';
import { npubEncode } from 'nostr-tools/nip19';

jest.mock('@/modules/tribes/client/services/radio.client.service', () => {
  const actual = jest.requireActual(
    '@/modules/tribes/client/services/radio.client.service',
  );
  return {
    ...actual,
    connectRadioSigner: jest.fn(),
    fetchRadioAuthorUsernames: jest.fn().mockResolvedValue({}),
    RadioRoom: jest.fn(),
  };
});

const user: UserProfile = {
  _id: 'fictional-member-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
};
const publicKey = 'ab'.repeat(32);
const signer = {
  publicKey,
  sign: jest.fn(async () => {
    throw new Error('This fixture publishes through the mocked room.');
  }),
};
let receive: (event: Event) => void;
let relayFailure: () => void;
let room: {
  open: jest.Mock;
  close: jest.Mock;
  publish: jest.Mock;
  setSigner: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  room = {
    open: jest.fn(async () => {}),
    close: jest.fn(),
    publish: jest.fn(async () => {}),
    setSigner: jest.fn(),
  };
  jest.mocked(RadioRoom).mockImplementation((onEvent, onError) => {
    receive = onEvent;
    relayFailure = onError;
    return room as unknown as RadioRoom;
  });
  jest.mocked(connectRadioSigner).mockResolvedValue(signer);
});

it('does not create a room for a guest', () => {
  render(<HackersCircleChat />);

  expect(RadioRoom).not.toHaveBeenCalled();
  expect(
    screen.getByRole('link', { name: 'Log in to see chat.' }),
  ).toHaveAttribute('href', '/signin?redirect=/circles/hackers');
});

it('opens a room for a signed-in member and deduplicates received events', async () => {
  jest.mocked(fetchRadioAuthorUsernames).mockResolvedValueOnce({
    [publicKey]: user.username,
  });
  render(<HackersCircleChat user={user} />);

  expect(RadioRoom).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
    HACKERS_CHAT_TOPIC,
  );
  expect(room.open).toHaveBeenCalledWith(true);
  const event: Event = {
    id: 'event-1',
    pubkey: publicKey,
    created_at: 1_800_000_000,
    kind: 1,
    tags: [],
    content: 'A fictional chat message.',
    sig: 'signature',
  };
  act(() => {
    receive(event);
    receive(event);
  });

  expect(await screen.findByText(event.content)).toBeInTheDocument();
  expect(screen.getAllByText(event.content)).toHaveLength(1);
  const identity = await screen.findByRole('link', {
    name: 'fictional-member@trustroots.org',
  });
  expect(identity).toHaveAttribute('href', '/profile/fictional-member');
  expect(identity).toHaveAttribute('title', npubEncode(publicKey));
});

it('shows an unknown author as a plain full npub', async () => {
  const unknownKey = 'cd'.repeat(32);
  const event: Event = {
    id: 'unknown-event',
    pubkey: unknownKey,
    created_at: 1_800_000_000,
    kind: 1,
    tags: [],
    content: 'A message from an unknown author.',
    sig: 'signature',
  };
  render(<HackersCircleChat user={user} />);
  act(() => receive(event));

  const npub = npubEncode(unknownKey);
  expect(await screen.findByText(npub)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: npub })).not.toBeInTheDocument();
});

it('keeps sending disabled until the linked signer connects', async () => {
  render(<HackersCircleChat user={user} />);

  expect(screen.getByLabelText('Message')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Connect Nostr identity' }),
  );
  expect(
    await screen.findByText('Connected as fictional-member@trustroots.org.'),
  ).toBeInTheDocument();
  expect(room.setSigner).toHaveBeenCalledWith(signer);
  expect(screen.getByLabelText('Message')).toBeEnabled();
});

it('publishes trimmed text with the hackers chat topic tag', async () => {
  render(<HackersCircleChat user={user} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Connect Nostr identity' }),
  );
  await screen.findByText('Connected as fictional-member@trustroots.org.');
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: '  A fictional message.  ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));

  await waitFor(() => expect(screen.getByLabelText('Message')).toHaveValue(''));
  expect(room.publish).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: 1,
      tags: [['t', HACKERS_CHAT_TOPIC]],
      content: 'A fictional message.',
    }),
  );
});

it('keeps the draft and shows an error when publishing fails', async () => {
  room.publish.mockRejectedValueOnce(new Error('relay unavailable'));
  render(<HackersCircleChat user={user} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Connect Nostr identity' }),
  );
  await screen.findByText('Connected as fictional-member@trustroots.org.');
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'Keep this draft.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));

  expect(
    await screen.findByText('Message could not be sent. Try again.'),
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Message')).toHaveValue('Keep this draft.');
});

it('reports relay errors and closes the room on unmount', () => {
  const { unmount } = render(<HackersCircleChat user={user} />);

  act(() => relayFailure());
  expect(screen.getByRole('status')).toHaveTextContent(
    'The Hackers chat is unavailable.',
  );
  unmount();
  expect(room.close).toHaveBeenCalledTimes(1);
});

it('orders different messages and shows signer connection errors', async () => {
  jest
    .mocked(connectRadioSigner)
    .mockRejectedValueOnce(new Error('Signer denied access.'));
  render(<HackersCircleChat user={user} />);
  const sample: Event = {
    id: 'new',
    pubkey: publicKey,
    created_at: 2,
    kind: 1,
    tags: [],
    content: 'New',
    sig: 'signature',
  };
  act(() => {
    receive(sample);
    receive({ ...sample, id: 'old', content: 'Old', created_at: 1 });
  });
  expect(
    screen
      .getAllByRole('listitem')
      .map(item => item.querySelector('p')?.textContent),
  ).toEqual(['Old', 'New']);
  fireEvent.submit(screen.getByLabelText('Message').closest('form')!);
  expect(room.publish).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Connect Nostr identity' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Signer denied access.',
  );
});

it.each(['resolve', 'reject'])(
  'ignores a publish that will %s after leaving',
  async outcome => {
    let finish!: () => void;
    room.publish.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          finish = () =>
            outcome === 'resolve'
              ? resolve(undefined)
              : reject(new Error('Offline'));
        }),
    );
    const { unmount } = render(<HackersCircleChat user={user} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect Nostr identity' }),
    );
    await screen.findByText('Connected as fictional-member@trustroots.org.');
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'Hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    unmount();
    await act(async () => finish());
  },
);
