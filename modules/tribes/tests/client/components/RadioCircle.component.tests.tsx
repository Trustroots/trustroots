import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import '@/config/client/i18n';
import {
  finalizeEvent,
  generateSecretKey,
  type Event,
  type EventTemplate,
} from 'nostr-tools';
import RadioCircle from '@/modules/tribes/client/components/RadioCircle';
import {
  connectRadioSigner,
  FAVOURITES_KEY,
  RadioRoom,
  roomTemplate,
  stations,
} from '@/modules/tribes/client/services/radio.client.service';
import type { UserProfile } from '@/modules/users/client/types';

jest.mock('@/modules/tribes/client/services/radio.client.service', () => {
  const original = jest.requireActual(
    '@/modules/tribes/client/services/radio.client.service',
  );
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
    connectRadioSigner: jest.fn(),
    RadioRoom: jest.fn(),
  };
});
const user: UserProfile = {
  _id: 'fictional-member-id',
  username: 'fictional-member',
  displayName: 'Fictional Member',
};
const secret = generateSecretKey();
const event = (template: EventTemplate) => finalizeEvent(template, secret);
const station = stations[0];
let receive: (event: Event) => void;
let relayFailure: () => void;
let room: {
  open: jest.Mock;
  close: jest.Mock;
  publish: jest.Mock;
  setSigner: jest.Mock;
  loadFavourites: jest.Mock;
};
let play: jest.SpyInstance;
let pause: jest.SpyInstance;
let load: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.history.replaceState(null, '', '/circles/radio');
  play = jest
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockResolvedValue(undefined);
  pause = jest
    .spyOn(HTMLMediaElement.prototype, 'pause')
    .mockImplementation(() => {});
  load = jest
    .spyOn(HTMLMediaElement.prototype, 'load')
    .mockImplementation(() => {});
  room = {
    open: jest.fn(async () => {}),
    close: jest.fn(),
    publish: jest.fn(async () => {}),
    setSigner: jest.fn(),
    loadFavourites: jest.fn(),
  };
  jest.mocked(RadioRoom).mockImplementation((onEvent, onError) => {
    receive = onEvent;
    relayFailure = onError;
    return room as unknown as RadioRoom;
  });
  jest.mocked(connectRadioSigner).mockResolvedValue({
    publicKey: event(roomTemplate('chat', station, '')).pubkey,
    sign: async template => event(template),
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
function emit(...events: Event[]) {
  act(() => events.forEach(item => receive(item)));
}
function row() {
  return within(screen.getByRole('region', { name: 'SomaFM' }));
}
async function connect() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Connect Nostr identity' }),
  );
  await screen.findByText(/Connected as fictional-member@trustroots.org/);
}

it('shows public playback and shared count, hiding chat and listener identities', () => {
  render(<RadioCircle />);
  expect(room.open).toHaveBeenCalledWith(false);
  expect(
    screen.queryByRole('region', { name: 'Radio chat' }),
  ).not.toBeInTheDocument();
  const listening = event(roomTemplate('listening', station, 'Music'));
  emit(listening, listening);
  expect(screen.getByText('One shared listener')).toBeInTheDocument();
  expect(
    screen.queryByText(
      `${listening.pubkey.slice(0, 8)}…${listening.pubkey.slice(-4)}`,
    ),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Log in to see listeners and chat.' }),
  ).toHaveAttribute('href', '/signin?redirect=/circles/radio');
});
it('plays, pauses, persists local favourites, follows station hashes and cleans up', async () => {
  const { container, unmount } = render(<RadioCircle />);
  const button = row().getByRole('button', { name: `Play ${station.title}` });
  fireEvent.click(button);
  await screen.findByRole('button', { name: 'Pause', exact: true });
  expect(container.querySelector('audio')).toHaveAttribute('src', station.url);
  expect(window.location.hash).toBe(`#${station.id}`);
  fireEvent.click(
    row().getByRole('button', { name: `Pause ${station.title}` }),
  );
  await screen.findByRole('button', { name: 'Play', exact: true });
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
    window.location.hash = '#paradise';
    window.dispatchEvent(new Event('hashchange'));
  });
  expect(screen.getByRole('heading', { name: 'Paradise' })).toBeVisible();
  act(() => {
    window.location.hash = '#unknown';
    window.dispatchEvent(new Event('hashchange'));
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
  fireEvent.click(screen.getByRole('button', { name: 'Play', exact: true }));
  await screen.findByText(
    'This station could not be played. Try again or choose another station.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play', exact: true }));
  await screen.findByRole('button', { name: 'Pause', exact: true });
  fireEvent.pause(container.querySelector('audio')!);
  expect(
    screen.getByRole('button', { name: 'Play', exact: true }),
  ).toBeVisible();
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
  emit(event(roomTemplate('listening', station, 'Music')));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('allows logged-in members to read chat and listeners without a signer', () => {
  render(<RadioCircle user={user} />);
  expect(room.open).toHaveBeenCalledWith(true);
  expect(screen.getByText('No shared listening activity yet.')).toBeVisible();
  const listening = event(roomTemplate('listening', station, 'Music'));
  emit(
    listening,
    { ...listening, id: 'older', created_at: listening.created_at - 1 },
    event(roomTemplate('chat', station, '<script>fictional message</script>')),
  );
  expect(screen.getByText('<script>fictional message</script>')).toBeVisible();
  expect(screen.getByRole('link', { name: `#${station.id}` })).toHaveAttribute(
    'href',
    `#${station.id}`,
  );
  expect(screen.getByLabelText('Message')).toBeDisabled();
  expect(
    screen.getByRole('region', { name: 'Listening now' }),
  ).toHaveTextContent(station.title);
});
it('connects a matching signer, restores remote favourites and publishes messages and stars', async () => {
  render(<RadioCircle user={user} />);
  await connect();
  expect(room.loadFavourites).toHaveBeenCalled();
  emit(event(roomTemplate('favourite', station, 'Favourite')));
  expect(screen.getByRole('region', { name: 'Favourites' })).toHaveTextContent(
    station.title,
  );
  fireEvent.click(
    row().getByRole('button', { name: `Unstar ${station.title}` }),
  );
  expect(room.publish).toHaveBeenCalledWith(
    expect.objectContaining({
      tags: expect.arrayContaining([['radiostr_action', 'unstar']]),
    }),
  );
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: ' Hello room ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByLabelText('Message')).toHaveValue(''));
  expect(room.publish).toHaveBeenCalledWith(
    expect.objectContaining({ content: 'Hello room' }),
  );
});
it('keeps drafts and local favourites when relay publication fails', async () => {
  render(<RadioCircle user={user} />);
  await connect();
  room.publish.mockRejectedValue(new Error('offline'));
  fireEvent.click(row().getByRole('button', { name: `Star ${station.title}` }));
  await screen.findByText(
    'Favourite saved on this device, but could not be shared.',
  );
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'Keep my draft' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText('Message could not be sent. Try again.');
  expect(screen.getByLabelText('Message')).toHaveValue('Keep my draft');
});

it('retains local favourite actions when old history arrives or sharing fails', async () => {
  render(<RadioCircle user={user} />);
  await connect();
  emit(event(roomTemplate('favourite', station, 'Unstarred', false)));
  room.publish.mockRejectedValue(new Error('offline'));
  fireEvent.click(row().getByRole('button', { name: `Star ${station.title}` }));
  await screen.findByRole('alert');
  emit(event(roomTemplate('chat', undefined, 'Room update')));
  expect(
    row().getByRole('button', { name: `Unstar ${station.title}` }),
  ).toHaveAttribute('aria-pressed', 'true');
  emit(
    event(
      roomTemplate(
        'favourite',
        station,
        'Remote star',
        true,
        Math.floor(Date.now() / 1000) + 1,
      ),
    ),
  );
  fireEvent.click(
    row().getByRole('button', { name: `Unstar ${station.title}` }),
  );
  await act(async () => {});
  emit(
    event(roomTemplate('favourite', station, 'Old star', true)),
    event(roomTemplate('chat', undefined, 'Another update')),
  );
  expect(
    row().getByRole('button', { name: `Star ${station.title}` }),
  ).toHaveAttribute('aria-pressed', 'false');
  emit(
    event(
      roomTemplate(
        'favourite',
        station,
        'Remote unstar',
        false,
        Math.floor(Date.now() / 1000) + 2,
      ),
    ),
  );
  expect(
    row().getByRole('button', { name: `Star ${station.title}` }),
  ).toHaveAttribute('aria-pressed', 'false');
});

it('preserves the circle URL and router state when the document has a root base URL', async () => {
  const base = document.createElement('base');
  base.href = '/';
  document.head.append(base);
  window.history.replaceState(
    { fictionalRouterState: 'preserve' },
    '',
    '/circles/radio?example=1',
  );
  try {
    render(<RadioCircle />);
    fireEvent.click(
      row().getByRole('button', { name: `Play ${station.title}` }),
    );
    await screen.findByRole('button', { name: 'Pause', exact: true });
    expect(window.location.pathname).toBe('/circles/radio');
    expect(window.location.search).toBe('?example=1');
    expect(window.history.state).toEqual({ fictionalRouterState: 'preserve' });
  } finally {
    base.remove();
  }
});
it.each([new Error('Fictional mismatch'), 'failure'])(
  'explains signer connection failures',
  async cause => {
    jest.mocked(connectRadioSigner).mockRejectedValue(cause);
    render(<RadioCircle user={user} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect Nostr identity' }),
    );
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Message')).toBeDisabled();
  },
);
it('shares after ten seconds, heartbeats while playing and expires stale listeners', async () => {
  jest.useFakeTimers();
  render(<RadioCircle user={user} />);
  await connect();
  fireEvent.click(row().getByRole('button', { name: `Play ${station.title}` }));
  await act(async () => {});
  expect(room.publish).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(10000);
  });
  expect(room.publish).toHaveBeenCalledTimes(1);
  expect(room.publish).toHaveBeenCalledWith(
    expect.objectContaining({
      tags: expect.arrayContaining([['t', 'nowplaying']]),
    }),
  );
  await act(async () => {
    jest.advanceTimersByTime(300000);
  });
  expect(room.publish).toHaveBeenCalledTimes(2);
  emit(event(roomTemplate('listening', station, 'Music')));
  room.publish.mockRejectedValue(new Error('offline'));
  await act(async () => {
    jest.advanceTimersByTime(300000);
  });
  expect(screen.getByRole('alert')).toHaveTextContent('Could not share');
  fireEvent.click(screen.getByRole('button', { name: 'Pause', exact: true }));
  await act(async () => {
    jest.advanceTimersByTime(800000);
  });
  expect(room.publish).toHaveBeenCalledTimes(3);
  expect(screen.getByText('No shared listening activity yet.')).toBeVisible();
});

it('sorts chat, omits unknown station links and expires messages', () => {
  render(<RadioCircle user={user} />);
  const now = Math.floor(Date.now() / 1000);
  emit(
    event(roomTemplate('chat', undefined, 'First', true, now - 1)),
    event(roomTemplate('chat', station, 'Second', true, now)),
    {
      ...event(
        roomTemplate('chat', undefined, 'Without expiry', true, now - 2),
      ),
      tags: [['t', 'radiostr']],
    },
    event({
      ...roomTemplate('chat', undefined, 'Old'),
      tags: [
        ['t', 'radiostr'],
        ['expiration', '1'],
      ],
    }),
    event({
      ...roomTemplate('listening', station, 'Unknown station'),
      tags: [
        ['t', 'radiostr'],
        ['t', 'nowplaying'],
        ['radiostr_station', 'unknown'],
      ],
    }),
  );
  expect(screen.getByRole('link', { name: 'Unknown station' })).toBeVisible();
  expect(screen.queryByText('Old')).not.toBeInTheDocument();
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
  expect(room.publish).not.toHaveBeenCalled();
});

it.each([false, true])(
  'ignores connection completion after unmount (rejected: %p)',
  async reject => {
    let finish!: () => void;
    jest.mocked(connectRadioSigner).mockImplementationOnce(
      () =>
        new Promise((resolve, fail) => {
          finish = () =>
            reject
              ? fail(new Error('offline'))
              : resolve({
                  publicKey: 'key',
                  sign: async template => event(template),
                });
        }),
    );
    const { unmount } = render(<RadioCircle user={user} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect Nostr identity' }),
    );
    unmount();
    await act(async () => finish());
    expect(room.setSigner).not.toHaveBeenCalled();
  },
);

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

it.each([false, true])(
  'cleans up pending chat and favourite publications (rejected: %p)',
  async reject => {
    const { unmount } = render(<RadioCircle user={user} />);
    await connect();
    const finishes: Array<() => void> = [];
    room.publish.mockImplementation(
      () =>
        new Promise<void>((resolve, fail) =>
          finishes.push(() =>
            reject ? fail(new Error('offline')) : resolve(),
          ),
        ),
    );
    // Programmatic submits must obey the same guards as the disabled button.
    const input = screen.getByLabelText('Message');
    const form = input.closest('form')!;
    fireEvent.change(input, { target: { value: 'Pending' } });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(room.publish).toHaveBeenCalledTimes(1);
    fireEvent.click(
      row().getByRole('button', { name: `Star ${station.title}` }),
    );
    unmount();
    await act(async () => finishes.forEach(finish => finish()));
  },
);

it.each([false, true])(
  'does not schedule another heartbeat after unmount (rejected: %p)',
  async reject => {
    jest.useFakeTimers();
    const { unmount } = render(<RadioCircle user={user} />);
    await connect();
    let finish!: () => void;
    room.publish.mockImplementation(
      () =>
        new Promise<void>((resolve, fail) => {
          finish = () => (reject ? fail(new Error('offline')) : resolve());
        }),
    );
    fireEvent.click(
      row().getByRole('button', { name: `Play ${station.title}` }),
    );
    await act(async () => {});
    await act(async () => {
      jest.advanceTimersByTime(10000);
    });
    unmount();
    await act(async () => finish());
    expect(jest.getTimerCount()).toBe(0);
  },
);
