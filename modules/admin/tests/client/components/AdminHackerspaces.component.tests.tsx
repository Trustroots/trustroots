import type {
  UnsignedNostrEvent,
  SignedNostrEvent,
} from '@/modules/users/client/services/nostr-signers.client';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminHackerspaces from '@/modules/admin/client/components/AdminHackerspaces.component';

jest.mock(
  '@/modules/admin/client/components/AdminHeader.component',
  () =>
    function MockAdminHeader() {
      return <header />;
    },
);
jest.mock('@/modules/core/client/api/http-client.js', () => ({
  ...jest.requireActual('@/modules/core/client/api/http-client.js'),
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('@/modules/search/client/services/nostr.client.service', () => ({
  nostrService: {
    fetchHackerPlaceEvents: jest.fn(),
    connectHackerPlaceRelays: jest.fn(),
  },
}));

const http = jest.requireMock('@/modules/core/client/api/http-client.js')
  .default as {
  get: jest.Mock;
};
const service = jest.requireMock(
  '@/modules/search/client/services/nostr.client.service',
).nostrService as {
  fetchHackerPlaceEvents: jest.Mock;
  connectHackerPlaceRelays: jest.Mock;
};
const space = (endpoint = 'https://workshop.example.test/api') => ({
  endpoint,
  valid: true,
  eligible: true,
  name: 'Example Workshop',
  website: 'https://workshop.example.test',
  latitude: 42,
  longitude: 12,
  address: '1 Fictional Road',
  addressParts: ['1 Fictional Road', '', '', '', ''],
  description: 'A shared workshop',
  open: 'open',
  fetchedAt: '2026-10-12T10:00:00Z',
  spaceType: 'makerspace',
});
const event = (endpoint: string, tags: string[][] = []) => ({
  id: endpoint,
  created_at: 1,
  pubkey: 'fictional-author',
  content: 'Last-known description',
  tags: [['d', `spaceapi:${endpoint}`], ...tags],
});
const fetchPreview = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Fetch preview' }));
const publishChanges = () =>
  fireEvent.click(
    screen.getByRole('button', { name: 'Sign and publish approved changes' }),
  );

describe('administrator place import', () => {
  const publish = jest.fn();
  const publishNomadwiki = jest.fn();
  const closeTrustroots = jest.fn();
  const closeNomadwiki = jest.fn();
  const signEvent = jest.fn(async (unsigned: UnsignedNostrEvent) => ({
    ...unsigned,
    id: 'signed-event',
    pubkey: 'fictional-key',
    sig: 'fictional-signature',
  }));
  const getPublicKey = jest.fn();
  beforeEach(() => {
    jest.resetAllMocks();
    http.get.mockResolvedValue({ data: [space()] });
    service.fetchHackerPlaceEvents.mockResolvedValue([]);
    service.connectHackerPlaceRelays.mockResolvedValue([
      {
        url: 'wss://relay.trustroots.org',
        relay: { publish, close: closeTrustroots },
      },
      {
        url: 'wss://relay.nomadwiki.org',
        relay: { publish: publishNomadwiki, close: closeNomadwiki },
      },
    ]);
    publish.mockResolvedValue(undefined);
    publishNomadwiki.mockResolvedValue(undefined);
    signEvent.mockImplementation(async unsigned => ({
      ...unsigned,
      id: 'signed-event',
      pubkey: 'fictional-key',
      sig: 'fictional-signature',
    }));
    getPublicKey.mockResolvedValue('fictional-key');
    window.nostr = { getPublicKey, signEvent };
  });
  afterEach(() => {
    delete window.nostr;
  });

  it('previews additions, updates, retained endpoints and directory removals', async () => {
    http.get.mockResolvedValue({
      data: [
        space(),
        {
          ...space('https://updated.example.test/api'),
          name: 'Updated Workshop',
          website: '',
        },
        {
          ...space('https://offline.example.test/api'),
          name: '',
          address: '',
          eligible: false,
          valid: false,
          website: 'javascript:invalid',
        },
      ],
    });
    service.fetchHackerPlaceEvents.mockResolvedValue([
      event('https://updated.example.test/api'),
      event('https://offline.example.test/api'),
      event('https://removed.example.test/api', [['name', 'Removed Workshop']]),
      event('https://unnamed.example.test/api'),
      event('https://inactive.example.test/api', [
        ['meta', 'status', 'inactive'],
      ]),
      { tags: [['name', 'Unrelated place']], content: '' },
      { tags: [['d', 'other-source:place']], content: '' },
    ]);
    render(<AdminHackerspaces />);
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeDisabled();
    fetchPreview();
    expect(await screen.findByText(/1 additions, 1 updates/)).toHaveTextContent(
      '2 removals',
    );
    expect(http.get).toHaveBeenCalledWith('/api/admin/hackerspaces/preview');
    expect(screen.getByRole('cell', { name: 'Addition' })).toBeVisible();
    expect(screen.getByRole('cell', { name: 'Update' })).toBeVisible();
    expect(
      screen.getByRole('cell', { name: /Temporarily invalid/ }),
    ).toBeVisible();
    expect(
      screen.getAllByRole('cell', { name: /Closed or removed/ }),
    ).toHaveLength(2);
    expect(
      screen.getByText('spaceapi:https://unnamed.example.test/api'),
    ).toBeVisible();
    expect(
      screen.getAllByRole('link', { name: 'https://workshop.example.test' }),
    ).toHaveLength(1);
    publishChanges();
    await screen.findByText(/Published 4 place events; 0 failed/);
    expect(signEvent).toHaveBeenCalledTimes(4);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'signed-event', kind: 33000 }),
    );
    expect(publishNomadwiki.mock.calls).toEqual(publish.mock.calls);
    expect(closeTrustroots).toHaveBeenCalledTimes(1);
    expect(closeNomadwiki).toHaveBeenCalledTimes(1);
    expect(signEvent.mock.calls[2][0]).toMatchObject({
      tags: expect.arrayContaining([['meta', 'status', 'inactive']]),
      content: 'Last-known description',
    });
  });

  it('skips closed additions and retires previously published closed spaces', async () => {
    http.get.mockResolvedValue({
      data: [
        {
          ...space('https://closed-new.example.test/api'),
          name: 'Closed new workshop',
          open: 'closed',
        },
        {
          ...space('https://closed-existing.example.test/api'),
          name: 'Closed existing workshop',
          open: 'closed',
          eligible: false,
        },
        {
          ...space('https://closed-inactive.example.test/api'),
          name: 'Already inactive workshop',
          open: 'closed',
          eligible: false,
        },
      ],
    });
    service.fetchHackerPlaceEvents.mockResolvedValue([
      event('https://closed-existing.example.test/api', [
        ['meta', 'status', 'active'],
      ]),
      event('https://closed-inactive.example.test/api', [
        ['meta', 'status', 'inactive'],
      ]),
    ]);
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(/0 additions, 0 updates/);
    expect(
      screen.getAllByRole('cell', { name: 'Closed; skip publication' }),
    ).toHaveLength(2);
    expect(
      screen.getByRole('cell', { name: 'Closed or removed; mark inactive' }),
    ).toBeVisible();
    publishChanges();
    await screen.findByText(/Published 1 place events; 0 failed/);
    expect(signEvent).toHaveBeenCalledTimes(1);
    expect(signEvent.mock.calls[0][0]).toMatchObject({
      tags: expect.arrayContaining([
        ['d', 'spaceapi:https://closed-existing.example.test/api'],
        ['meta', 'status', 'inactive'],
      ]),
    });
  });

  it('reports Collector failures and leaves publication disabled', async () => {
    http.get.mockRejectedValue(new Error('unavailable'));
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(
      'Could not fetch the SpaceAPI Collector. No events were changed.',
    );
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeDisabled();
  });

  it('clears a previous preview when refreshing fails', async () => {
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(/Preview: 1 additions/);
    http.get.mockRejectedValueOnce({
      response: {
        status: 502,
        data: { message: 'Collector request timed out.' },
      },
    });
    fetchPreview();
    await screen.findByText(
      'Could not fetch the SpaceAPI Collector: Collector request timed out. No events were changed.',
    );
    expect(
      screen.queryByRole('cell', { name: 'Example Workshop' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeDisabled();
    expect(signEvent).not.toHaveBeenCalled();
  });

  it.each([401, 403])('explains access failures (%s)', async status => {
    http.get.mockRejectedValueOnce({ response: { status } });
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(/Administrator access is required/);
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeDisabled();
  });

  it.each([undefined, 12, ''])(
    'handles an absent or invalid server error message (%s)',
    async message => {
      http.get.mockRejectedValueOnce({
        response: { status: 502, data: { message } },
      });
      render(<AdminHackerspaces />);
      fetchPreview();
      await screen.findByText(
        'Could not fetch the SpaceAPI Collector. No events were changed.',
      );
    },
  );

  it('distinguishes processing errors from Collector request failures', async () => {
    http.get.mockResolvedValueOnce({ data: {} });
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(
      'Could not prepare the import preview. No events were changed.',
    );
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeDisabled();
  });

  it('allows publication when the only change is a removed directory entry', async () => {
    http.get.mockResolvedValue({ data: [] });
    service.fetchHackerPlaceEvents.mockResolvedValue([
      {
        ...event('https://removed.example.test/api', [
          ['meta', 'status', 'active'],
        ]),
        created_at: 3,
      },
      {
        ...event('https://removed.example.test/api', [
          ['meta', 'status', 'inactive'],
        ]),
        created_at: 1,
      },
    ]);
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(/1 removals/);
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeEnabled();
    publishChanges();
    await screen.findByText(/Published 1 place events; 0 failed/);
    expect(signEvent.mock.calls[0][0]).toMatchObject({
      tags: expect.arrayContaining([['meta', 'status', 'inactive']]),
    });
  });

  it('allows additions when the published-event query fails', async () => {
    service.fetchHackerPlaceEvents.mockRejectedValue(
      new Error('relay unavailable'),
    );
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(/1 additions, 0 updates/);
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeEnabled();
  });

  it.each([undefined, {}, { getPublicKey: jest.fn() }])(
    'requires a complete NIP-07 signer: %p',
    async signer => {
      window.nostr = signer;
      render(<AdminHackerspaces />);
      fetchPreview();
      await screen.findByText('Example Workshop');
      publishChanges();
      expect(
        await screen.findByText('A NIP-07 signer is required.'),
      ).toBeVisible();
      expect(service.connectHackerPlaceRelays).not.toHaveBeenCalled();
    },
  );

  it.each(['signer', 'relay'])(
    'reports a failed initial %s connection',
    async failing => {
      if (failing === 'signer')
        getPublicKey.mockRejectedValue(new Error('denied'));
      else
        service.connectHackerPlaceRelays.mockRejectedValue(
          new Error('offline'),
        );
      render(<AdminHackerspaces />);
      fetchPreview();
      await screen.findByText('Example Workshop');
      publishChanges();
      await screen.findByText('Could not connect to the relay or signer.');
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it('continues after per-place signing and publication failures', async () => {
    http.get.mockResolvedValue({
      data: [
        space(),
        space('https://second.example.test/api'),
        space('https://third.example.test/api'),
      ],
    });
    signEvent.mockRejectedValueOnce(new Error('signature denied'));
    publish.mockRejectedValueOnce(new Error('relay rejected'));
    publishNomadwiki.mockRejectedValueOnce(new Error('relay rejected'));
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(/3 additions/);
    publishChanges();
    await screen.findByText(/Published 1 place events; 2 failed/);
    expect(signEvent).toHaveBeenCalledTimes(3);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('disables repeat actions while fetching and awaiting the signer', async () => {
    let finishFetch!: (value: { data: ReturnType<typeof space>[] }) => void;
    http.get.mockReturnValue(
      new Promise(resolve => {
        finishFetch = resolve;
      }),
    );
    let finishSigning!: (value: SignedNostrEvent) => void;
    window.nostr!.signEvent = jest.fn(
      () =>
        new Promise(resolve => {
          finishSigning = resolve;
        }),
    );
    render(<AdminHackerspaces />);
    fetchPreview();
    expect(
      screen.getByRole('button', { name: 'Fetch preview' }),
    ).toBeDisabled();
    finishFetch({ data: [space()] });
    await screen.findByText('Example Workshop');
    publishChanges();
    await screen.findByText(/Signing and publishing 1 of 1/);
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeDisabled();
    finishSigning({
      kind: 33000,
      created_at: 0,
      tags: [],
      content: '',
      id: 'signed-event',
      pubkey: 'fictional-key',
      sig: 'fictional-signature',
    });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Fetch preview' }),
      ).toBeEnabled(),
    );
  });

  it.each(['connection', 'publication'])(
    'reports a Nomadwiki %s failure while Trustroots succeeds',
    async failure => {
      if (failure === 'connection') {
        service.connectHackerPlaceRelays.mockResolvedValue([
          {
            url: 'wss://relay.trustroots.org',
            relay: { publish, close: closeTrustroots },
          },
          { url: 'wss://relay.nomadwiki.org', relay: null },
        ]);
      } else publishNomadwiki.mockRejectedValue('blocked: unsupported kind');
      render(<AdminHackerspaces />);
      fetchPreview();
      await screen.findByText('Example Workshop');
      publishChanges();
      await screen.findByText(/Published 1 place events; 0 failed/);
      expect(
        screen.getByText('wss://relay.trustroots.org: 1 published; 0 failed'),
      ).toBeVisible();
      expect(
        screen.getByText(/wss:\/\/relay.nomadwiki.org: 0 published; 1 failed/),
      ).toBeVisible();
      expect(signEvent).toHaveBeenCalledTimes(1);
      if (failure !== 'connection')
        expect(screen.getByText(/blocked: unsupported kind/)).toBeVisible();
      expect(closeTrustroots).toHaveBeenCalledTimes(1);
    },
  );

  it('does not request signatures when neither relay is reachable', async () => {
    service.connectHackerPlaceRelays.mockResolvedValue([
      { url: 'wss://relay.trustroots.org', relay: null },
      { url: 'wss://relay.nomadwiki.org', relay: null },
    ]);
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText('Example Workshop');
    publishChanges();
    await screen.findByText('Could not connect to the relay or signer.');
    expect(signEvent).not.toHaveBeenCalled();
    expect(screen.getAllByText(/connection unavailable/)).toHaveLength(2);
  });
});
