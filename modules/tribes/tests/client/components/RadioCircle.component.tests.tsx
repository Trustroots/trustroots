import type { Mock, MockInstance } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import http from '@trustroots/core/http-client';
import {
  act,
  fireEvent,
  render as renderComponent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@/config/client/i18n';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
  type Event,
  type EventTemplate,
} from 'nostr-tools';
import RadioCircle from '@/modules/tribes/client/components/RadioCircle';
import {
  FAVOURITES_KEY,
  LISTENER_TTL,
  type Station,
  fetchRadioAuthorUsernames,
  RadioRoom,
  stations,
} from '@/modules/tribes/client/services/radio.client.service';
import { chatTemplate } from '@/modules/tribes/shared/circle-chat';
import type { UserProfile } from '@/modules/users/client/types';

vi.mock('@tanstack/react-router', async () =>
  (
    await import('@/testutils/client/router-location.testutil')
  ).mockRouterModule(),
);
vi.mock('@/modules/tribes/client/services/radio.client.service', async () => {
  const original = await vi.importActual<
    typeof import('@/modules/tribes/client/services/radio.client.service')
  >('@/modules/tribes/client/services/radio.client.service');
  return {
    ...original,
    // Service tests cover the complete catalogue; player tests use three stations.
    stations: [
      ...original.stations.slice(0, 2),
      original.stations.find(
        (station: { id: string }) => station.id === 'paradise',
      ),
    ],
    stationGroups: [
      { name: 'SomaFM', stations: original.stations.slice(0, 2) },
      {
        name: 'Radio Paradise',
        stations: original.stations.filter(
          (station: { id: string }) => station.id === 'paradise',
        ),
      },
    ],
    fetchRadioAuthorUsernames: vi.fn(),
    RadioRoom: vi.fn(),
  };
});
vi.mock('@trustroots/core/http-client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
const secret = generateSecretKey();
const user: UserProfile = {
  _id: 'fictional-member-id',
  username: 'fictional-member',
  nostrNpub: nip19.npubEncode(getPublicKey(secret)),
  displayName: 'Fictional Member',
};
const event = (template: EventTemplate) => finalizeEvent(template, secret);
const station = stations[0];
function listeningTemplate(station: Station, content: string): EventTemplate {
  return {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    content,
    tags: [
      ['t', 'radiostr'],
      ['t', 'nowplaying'],
      ['radiostr_station', station.id],
    ],
  };
}

function radioChatTemplate(
  station: Station | undefined,
  content: string,
  timestamp?: number,
) {
  const template = chatTemplate('radio', content, station?.id);
  if (timestamp !== undefined) template.created_at = timestamp;
  return template;
}

let receive: (event: Event) => void;
let relayFailure: () => void;
let room: {
  open: Mock;
  close: Mock;
};
let play: MockInstance;
let pause: MockInstance;
let load: MockInstance;
let queryClient: QueryClient;
const queryKey = ['circle-chat', 'radio', user._id];

function render(element: React.ReactElement) {
  return renderComponent(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>,
  );
}

function privateChat(...messages: Event[]) {
  const data = { messages, servicePubkey: 'service' };
  vi.mocked(http.get).mockResolvedValue({ data });
  act(() => {
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData(queryKey, data);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  vi.mocked(http.get).mockResolvedValue({ data: { messages: [] } });
  vi.mocked(fetchRadioAuthorUsernames).mockResolvedValue({});
  localStorage.clear();
  window.history.replaceState(null, '', '/circles/radio');
  play = vi
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined);
  pause = vi
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => {});
  load = vi
    .spyOn(HTMLMediaElement.prototype, 'load')
    .mockImplementation(() => {});
  room = {
    open: vi.fn(async () => {}),
    close: vi.fn(),
  };
  vi.mocked(RadioRoom).mockImplementation(function (onEvent, onError) {
    receive = onEvent;
    relayFailure = onError;
    return room as unknown as RadioRoom;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function emit(...events: Event[]) {
  act(() => events.forEach(item => receive(item)));
}
function row() {
  return within(screen.getByRole('region', { name: 'SomaFM' }));
}

it('links station artwork to station websites separately from playback', () => {
  render(<RadioCircle />);

  const beatblender = row().getByRole('link', { name: 'Beatblender website' });
  expect(beatblender).toHaveAttribute('href', 'https://somafm.com/beatblender');
  expect(beatblender.querySelector('img')).toHaveAttribute(
    'src',
    'https://somafm.com/img/blender.gif',
  );
  expect(beatblender.closest('button')).toBeNull();
  fireEvent.click(beatblender);
  expect(play).not.toHaveBeenCalled();

  const paradise = within(
    screen.getByRole('region', { name: 'Radio Paradise' }),
  ).getByRole('link', { name: 'Paradise website' });
  expect(paradise).toHaveAttribute('href', 'https://www.radioparadise.com/');
  expect(paradise.querySelector('img')).toHaveAttribute(
    'src',
    'https://radioparadise.com/apple-touch-icon.png',
  );
});

it('shows initials in the play button when a station has no artwork', () => {
  render(<RadioCircle />);

  const playStation = row().getByRole('button', { name: 'Play 7soul' });
  expect(playStation.querySelector('.radio-station-art')).toHaveTextContent(
    '7s',
  );
  expect(playStation.querySelector('img')).toBeNull();
});

it('keeps initials visible when station artwork fails to load', () => {
  render(<RadioCircle />);

  const artworkLink = row().getByRole('link', { name: 'Beatblender website' });
  const image = artworkLink.querySelector('img')!;
  fireEvent.error(image);

  expect(image).toHaveAttribute('hidden');
  expect(artworkLink).toHaveTextContent('Be');
  expect(artworkLink).toBeInTheDocument();
});

it('shows public playback and shared count, hiding chat and listener identities', () => {
  render(<RadioCircle />);
  expect(room.open).toHaveBeenCalledWith();
  expect(
    screen.queryByRole('region', { name: 'Radio chat' }),
  ).not.toBeInTheDocument();
  const listening = event(listeningTemplate(station, 'Music'));
  emit(listening, listening);
  expect(screen.getByText('One shared listener')).toBeInTheDocument();
  expect(
    screen.queryByText(
      `${listening.pubkey.slice(0, 8)}…${listening.pubkey.slice(-4)}`,
    ),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Log in to see listeners.' }),
  ).toHaveAttribute('href', '/signin?redirect=/circles/radio');
});

it('counts local playback before a shared event and deduplicates a linked key', async () => {
  const listening = event(listeningTemplate(station, 'Music'));
  render(
    <RadioCircle
      user={{ ...user, nostrNpub: nip19.npubEncode(listening.pubkey) }}
    />,
  );
  fireEvent.click(row().getByRole('button', { name: `Play ${station.title}` }));
  expect(
    await screen.findByText('One listener, including you on this device'),
  ).toBeVisible();
  emit(listening);
  expect(screen.getByText('One shared listener')).toBeVisible();
  expect(
    screen.queryByText(/including you on this device/),
  ).not.toBeInTheDocument();
});

it('plays, pauses, persists local favourites, follows station hashes and cleans up', async () => {
  const { container, unmount } = render(<RadioCircle />);
  const button = row().getByRole('button', { name: `Play ${station.title}` });
  fireEvent.click(button);
  await screen.findByRole('button', { name: 'Pause' });
  expect(container.querySelector('audio')).toHaveAttribute('src', station.url);
  expect(window.location.hash).toBe(`#${station.id}`);
  fireEvent.click(
    row().getByRole('button', { name: `Pause ${station.title}` }),
  );
  await screen.findByRole('button', { name: 'Play' });
  fireEvent.click(row().getByRole('button', { name: `Star ${station.title}` }));
  expect(JSON.parse(localStorage.getItem(FAVOURITES_KEY)!)).toEqual([
    station.id,
  ]);
  expect(screen.getByRole('region', { name: 'Favourites' })).toBeVisible();
  fireEvent.click(
    row().getByRole('button', { name: `Unstar ${station.title}` }),
  );
  expect(
    screen.queryByRole('region', { name: 'Favourites' }),
  ).not.toBeInTheDocument();
  act(() => {
    window.history.pushState(null, '', '#paradise');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('heading', { name: 'Paradise' })).toBeVisible();
  act(() => {
    window.history.pushState(null, '', '#unknown');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('heading', { name: 'Paradise' })).toBeVisible();
  unmount();
  expect(room.close).toHaveBeenCalled();
  expect(pause).toHaveBeenCalled();
  expect(load).toHaveBeenCalled();
});
it('selects deep links without autoplay and handles playback failure and media events', async () => {
  window.history.replaceState(null, '', `#${station.id}`);
  const { container } = render(<RadioCircle />);
  expect(play).not.toHaveBeenCalled();
  play.mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await screen.findByText(
    'This station could not be played. Try again or choose another station.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await screen.findByRole('button', { name: 'Pause' });
  fireEvent.pause(container.querySelector('audio')!);
  expect(screen.getByRole('button', { name: 'Play' })).toBeVisible();
  fireEvent.ended(container.querySelector('audio')!);
  fireEvent.error(container.querySelector('audio')!);
  expect(screen.getByRole('alert')).toHaveTextContent('could not be played');
});
it('ignores stale play promises and results after unmount', async () => {
  let resolve!: () => void;
  play.mockImplementationOnce(
    () =>
      new Promise<void>(done => {
        resolve = done;
      }),
  );
  const { unmount } = render(<RadioCircle />);
  fireEvent.click(row().getByRole('button', { name: `Play ${station.title}` }));
  unmount();
  await act(async () => resolve());
});
it('keeps playback available when relays fail and restores room status on events', () => {
  render(<RadioCircle />);
  act(() => relayFailure());
  expect(screen.getByRole('status')).toHaveTextContent('unavailable');
  emit(event(listeningTemplate(station, 'Music')));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('allows logged-in members to read chat and listeners without a signer', async () => {
  render(
    <RadioCircle user={{ ...user, nostrNpub: undefined }} isCircleMember />,
  );
  expect(room.open).toHaveBeenCalledWith();
  expect(screen.getByText('No shared listening activity yet.')).toBeVisible();
  const listening = event(listeningTemplate(station, 'Music'));
  const message = event(
    radioChatTemplate(
      station,
      '<script>fictional message</script>',
      1785751500,
    ),
  );
  vi.mocked(fetchRadioAuthorUsernames).mockResolvedValue({
    [message.pubkey]: user.username,
  });
  emit(listening, {
    ...listening,
    id: 'older',
    created_at: listening.created_at - 1,
  });
  privateChat(message);
  expect(
    await screen.findByText('<script>fictional message</script>'),
  ).toBeVisible();
  expect(screen.getByText('2026-08-03 10:05')).toHaveAttribute(
    'datetime',
    '2026-08-03T10:05:00.000Z',
  );
  const npub = nip19.npubEncode(message.pubkey);
  const messageRow = screen.getByText(message.content).closest('li')!;
  const profileLink = await within(messageRow).findByRole('link', {
    name: 'fictional-member@trustroots.org',
  });
  expect(profileLink).toHaveAttribute('href', '/profile/fictional-member');
  expect(profileLink).toHaveAttribute('title', npub);
  expect(screen.getByRole('link', { name: `#${station.id}` })).toHaveAttribute(
    'href',
    `/circles/radio#${station.id}`,
  );
  expect(screen.getByLabelText('Message')).toBeEnabled();
  const listeningNow = screen.getByRole('region', { name: 'Listening now' });
  expect(listeningNow).toHaveTextContent(station.title);
  const listenerIdentity = within(listeningNow).getByRole('link', {
    name: 'fictional-member@trustroots.org',
  });
  expect(listenerIdentity).toHaveAttribute('href', '/profile/fictional-member');
  expect(listenerIdentity).toHaveAttribute('title', npub);
});
it('resolves a known listener identity without any chat from that key', async () => {
  const listening = event(listeningTemplate(station, 'Music'));
  const npub = nip19.npubEncode(listening.pubkey);
  vi.mocked(fetchRadioAuthorUsernames).mockResolvedValueOnce({
    [listening.pubkey]: user.username,
  });
  render(<RadioCircle user={user} isCircleMember />);
  emit(listening);

  const listeningNow = screen.getByRole('region', { name: 'Listening now' });
  const identity = await within(listeningNow).findByRole('link', {
    name: 'fictional-member@trustroots.org',
  });
  expect(identity).toHaveAttribute('href', '/profile/fictional-member');
  expect(identity).toHaveAttribute('title', npub);
  expect(
    screen.queryByText('No shared listening activity yet.'),
  ).not.toBeInTheDocument();
  expect(document.querySelector('.radio-chat-log')).toBeEmptyDOMElement();
});
it('keeps chat readable as plain npubs if the author lookup fails', async () => {
  render(<RadioCircle user={user} isCircleMember />);
  const message = event(radioChatTemplate(station, 'Fictional message'));
  const npub = nip19.npubEncode(message.pubkey);
  vi.mocked(fetchRadioAuthorUsernames).mockResolvedValueOnce({
    [message.pubkey]: user.username,
  });
  privateChat(message);
  const verifiedAuthor = await screen.findByRole('link', {
    name: 'fictional-member@trustroots.org',
  });
  expect(verifiedAuthor).toHaveAttribute('title', npub);

  vi.mocked(fetchRadioAuthorUsernames).mockRejectedValueOnce(
    new Error('offline'),
  );
  privateChat(
    message,
    finalizeEvent(
      radioChatTemplate(station, 'Another message'),
      generateSecretKey(),
    ),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('link', { name: 'fictional-member@trustroots.org' }),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByText(npub)).toBeVisible();
  expect(screen.getByText('Fictional message')).toBeVisible();
});

it('uses a full plain npub for an unknown chat author and radio listener', async () => {
  vi.mocked(fetchRadioAuthorUsernames).mockResolvedValueOnce({});
  render(<RadioCircle user={user} isCircleMember />);
  const listening = event(listeningTemplate(station, 'Music'));
  const message = event(radioChatTemplate(station, 'Unknown author message'));
  emit(listening);
  privateChat(message);
  await screen.findByText(message.content);

  const npub = nip19.npubEncode(message.pubkey);
  const listeningNow = screen.getByRole('region', { name: 'Listening now' });
  expect(listeningNow).toHaveTextContent(npub);
  expect(
    within(listeningNow).queryByRole('link', { name: npub }),
  ).not.toBeInTheDocument();
  const chatLog = screen.getByRole('region', { name: 'Radio chat' });
  expect(within(chatLog).getByText(npub)).toBeVisible();
  expect(within(chatLog).getByText('Unknown author message')).toBeVisible();
  expect(
    within(chatLog).queryByRole('link', { name: npub }),
  ).not.toBeInTheDocument();
});

it('does not look up authors until a signed-in member has room events', () => {
  render(<RadioCircle user={user} />);
  expect(fetchRadioAuthorUsernames).not.toHaveBeenCalled();
});

it('does not look up public room identities for a guest', () => {
  render(<RadioCircle />);
  expect(fetchRadioAuthorUsernames).not.toHaveBeenCalled();
  expect(screen.queryByText(/^npub1/)).not.toBeInTheDocument();
});

it.each([false, true])(
  'aborts pending author lookups on unmount (rejected: %o)',
  async reject => {
    let finish!: () => void;
    const lookup = vi.mocked(fetchRadioAuthorUsernames).mockImplementationOnce(
      () =>
        new Promise((resolve, fail) => {
          finish = () => (reject ? fail(new Error('offline')) : resolve({}));
        }),
    );
    const { unmount } = render(<RadioCircle user={user} />);
    emit(event(listeningTemplate(station, 'Pending author')));
    await waitFor(() => expect(lookup).toHaveBeenCalled());
    const [, signal] = lookup.mock.calls[0];
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish());
  },
);

it('preserves the circle URL when the document has a root base URL', async () => {
  const base = document.createElement('base');
  base.href = '/';
  document.head.append(base);
  window.history.replaceState(null, '', '/circles/radio?example=1');
  try {
    render(<RadioCircle />);
    fireEvent.click(
      row().getByRole('button', { name: `Play ${station.title}` }),
    );
    await screen.findByRole('button', { name: 'Pause' });
    expect(window.location.pathname).toBe('/circles/radio');
    expect(window.location.search).toBe('?example=1');
  } finally {
    base.remove();
  }
});
it('expires stale shared listeners while the radio is open', async () => {
  vi.useFakeTimers();
  render(<RadioCircle user={user} />);
  emit(event(listeningTemplate(station, 'Music')));
  expect(screen.getByText('One shared listener')).toBeVisible();
  await act(async () => vi.advanceTimersByTime((LISTENER_TTL + 15) * 1000));
  expect(screen.getByText('No shared listening activity yet.')).toBeVisible();
});

it('switches to a station from chat and keeps playing on repeated activation', async () => {
  render(<RadioCircle user={user} isCircleMember />);
  const next = stations[1];
  privateChat(event(radioChatTemplate(next, 'A station recommendation')));
  const hashtag = await screen.findByRole('link', { name: `#${next.id}` });

  fireEvent.click(row().getByRole('button', { name: `Play ${station.title}` }));
  await screen.findByRole('button', { name: 'Pause' });
  fireEvent.click(hashtag);
  await screen.findByRole('button', { name: `Pause ${next.title}` });
  expect(window.location.hash).toBe(`#${next.id}`);
  expect(play).toHaveBeenCalledTimes(2);

  fireEvent.click(hashtag);
  expect(
    screen.getByRole('button', { name: `Pause ${next.title}` }),
  ).toBeVisible();
  expect(play).toHaveBeenCalledTimes(2);
  expect(fireEvent.click(hashtag, { ctrlKey: true })).toBe(true);
});

it('sorts chat, omits unknown station links', async () => {
  render(<RadioCircle user={user} isCircleMember />);
  const now = Math.floor(Date.now() / 1000);
  privateChat(
    event(radioChatTemplate(undefined, 'First', now - 1)),
    event(radioChatTemplate(station, 'Second', now)),
    {
      ...event(radioChatTemplate(undefined, 'Without expiry', now - 2)),
      tags: [['t', 'radiostr']],
    },
  );
  emit(
    event({
      ...listeningTemplate(station, 'Unknown station'),
      tags: [
        ['t', 'radiostr'],
        ['t', 'nowplaying'],
        ['radiostr_station', 'unknown'],
      ],
    }),
  );
  expect(screen.getByRole('link', { name: 'Unknown station' })).toBeVisible();
  await screen.findByText('Second');
  expect(
    screen
      .getAllByRole('listitem')
      .filter(
        item =>
          item.textContent?.includes('First') ||
          item.textContent?.includes('Second'),
      )
      .map(item => item.textContent),
  ).toEqual([
    expect.stringContaining('First'),
    expect.stringContaining('Second'),
  ]);
  fireEvent.submit(screen.getByLabelText('Message').closest('form')!);
  expect(http.post).not.toHaveBeenCalled();
});

it('ignores playback rejection after unmount', async () => {
  let fail!: () => void;
  play.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        fail = () => reject(new Error('offline'));
      }),
  );
  const { unmount } = render(<RadioCircle />);
  fireEvent.click(row().getByRole('button', { name: `Play ${station.title}` }));
  unmount();
  await act(async () => fail());
});

it.each(['invalid', nip19.noteEncode('ab'.repeat(32))])(
  'counts local playback alongside shared activity with a non-npub key (%s)',
  async nostrNpub => {
    render(<RadioCircle user={{ ...user, nostrNpub }} />);
    emit(event(listeningTemplate(station, 'Music')));
    fireEvent.click(
      row().getByRole('button', { name: `Play ${station.title}` }),
    );
    expect(
      await screen.findByText('2 listeners, including you on this device'),
    ).toBeVisible();
  },
);
