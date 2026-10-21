import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom';

import AdminHackerspaces from '@/modules/admin/client/components/AdminHackerspaces.component';
import { fetchSigningIdentity } from '@/modules/admin/client/services/hackerspaces-signer.client.service';

jest.mock(
  '@/modules/admin/client/services/hackerspaces-signer.client.service',
  () => ({
    displayNostrKey: (key: string) => `npub:${key}`,
    fetchSigningIdentity: jest.fn(),
  }),
);

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
const connectSigner = async () => {
  const button = screen.getByRole('button', {
    name: 'Connect or refresh signer',
  });
  fireEvent.click(button);
  await waitFor(() => expect(button).toBeEnabled());
};
const publishChanges = async () => {
  await connectSigner();
  fireEvent.click(
    screen.getByRole('button', { name: 'Sign and publish approved changes' }),
  );
};

describe('administrator place import', () => {
  const publish = jest.fn();
  const publishNomadwiki = jest.fn();
  const closeTrustroots = jest.fn();
  const closeNomadwiki = jest.fn();
  const signEvent = jest.fn(async (unsigned: Record<string, unknown>) => ({
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
    jest.mocked(fetchSigningIdentity).mockImplementation(async publicKey => ({
      publicKey,
      npub: `npub:${publicKey}`,
    }));
    window.nostr = { getPublicKey, signEvent };
  });
  afterEach(() => {
    delete window.nostr;
  });

  it('sorts every preview column in both directions without changing publication', async () => {
    http.get.mockResolvedValue({
      data: [
        {
          ...space('https://z.example.test'),
          name: 'Z Workshop',
          address: 'Z Road',
          website: 'https://z.example.test',
          eligible: false,
        },
        {
          ...space('https://a.example.test'),
          name: 'A Workshop',
          address: 'A Road',
          website: 'https://a.example.test',
        },
      ],
    });
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText('A Workshop');
    const names = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map(row => within(row).getAllByRole('cell')[0].textContent);
    expect(names()).toEqual(['A Workshop', 'Z Workshop']);
    for (const column of ['Space', 'Location', 'Preview action', 'Website']) {
      if (column !== 'Space')
        fireEvent.click(screen.getByRole('button', { name: column }));
      expect(names()).toEqual(['A Workshop', 'Z Workshop']);
      expect(
        screen.getByRole('columnheader', { name: column }),
      ).toHaveAttribute('aria-sort', 'ascending');
      fireEvent.click(screen.getByRole('button', { name: column }));
      expect(names()).toEqual(['Z Workshop', 'A Workshop']);
      expect(
        screen.getByRole('columnheader', { name: column }),
      ).toHaveAttribute('aria-sort', 'descending');
    }
    await publishChanges();
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(signEvent.mock.calls[0][0]).toMatchObject({ kind: 33000 });
  });

  it('excludes new country listings and deletes discovered events only with their original key', async () => {
    http.get.mockResolvedValue({
      data: [
        {
          ...space('https://excluded.example.test'),
          addressParts: ['', '', '', '', 'RU'],
        },
        {
          ...space('https://new-excluded.example.test'),
          address: 'Example Road, Israel',
        },
      ],
    });
    service.fetchHackerPlaceEvents.mockResolvedValue([
      {
        ...event('https://excluded.example.test'),
        id: 'own-listing',
        pubkey: 'fictional-key',
      },
      { ...event('https://excluded.example.test'), id: 'another-author' },
      {
        ...event('https://removed-excluded.example.test', [
          ['address', '', '', '', '', 'IL'],
          ['name', 'Removed excluded workshop'],
        ]),
        pubkey: 'fictional-key',
      },
    ]);
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(/3 country-excluded events/);
    expect(
      screen.getByRole('region', { name: 'Proposed deletion requests' }),
    ).toHaveTextContent('Removed excluded workshop');
    await publishChanges();
    await screen.findByText(
      /1 deletion requests require the original author key/,
    );
    expect(signEvent).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(publishNomadwiki).toHaveBeenCalledTimes(2);
    for (const [unsigned] of signEvent.mock.calls) {
      expect(unsigned).toMatchObject({ kind: 5, content: '' });
      expect(unsigned.tags).toContainEqual(['k', '33000']);
    }
  });

  it('sorts malformed numeric names without failing the preview', async () => {
    http.get.mockResolvedValue({
      data: [
        { ...space('https://numeric.example.test'), name: 123 },
        { ...space('https://other.example.test'), name: 'Other workshop' },
      ],
    });
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(/2 additions/);
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getAllByRole('cell')[0]).toHaveTextContent('123');
    fireEvent.click(screen.getByRole('button', { name: 'Space' }));
    expect(
      within(screen.getAllByRole('row')[1]).getAllByRole('cell')[0],
    ).toHaveTextContent('Other workshop');
  });

  it('sorts missing addresses and unsafe website values as their displayed fallback', async () => {
    http.get.mockResolvedValue({
      data: [
        {
          ...space('https://first.example.test'),
          address: '',
          website: 'javascript:invalid',
        },
        { ...space('https://second.example.test'), address: '', website: '' },
      ],
    });
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText(/2 additions/);
    fireEvent.click(screen.getByRole('button', { name: 'Location' }));
    expect(screen.getAllByRole('cell', { name: /No address/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Website' }));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
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
    await publishChanges();
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
    await publishChanges();
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
    await connectSigner();
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeEnabled();
    await publishChanges();
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
    await connectSigner();
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
      await publishChanges();
      expect(
        await screen.findByText('A NIP-07 signer is required.'),
      ).toBeVisible();
      expect(service.connectHackerPlaceRelays).not.toHaveBeenCalled();
    },
  );

  it('shows the matching Trustroots NIP-05 identity before signing', async () => {
    jest.mocked(fetchSigningIdentity).mockResolvedValue({
      publicKey: 'fictional-key',
      npub: 'npub:fictional-key',
      nip05: 'workshop@trustroots.org',
    });
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText('Example Workshop');
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeDisabled();
    await connectSigner();
    expect(screen.getByText('npub:fictional-key')).toBeVisible();
    expect(
      screen.getByText('workshop@trustroots.org (matches this key)'),
    ).toBeVisible();
    expect(signEvent).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeEnabled();
  });

  it('distinguishes a failed identity lookup', async () => {
    jest.mocked(fetchSigningIdentity).mockResolvedValue({
      publicKey: 'fictional-key',
      npub: 'npub:fictional-key',
      lookupFailed: true,
    });
    render(<AdminHackerspaces />);
    await connectSigner();
    expect(screen.getByText(/Trustroots identity lookup failed/)).toBeVisible();
  });

  it.each(['before signing', 'during signing'])(
    'stops when the key changes %s',
    async when => {
      render(<AdminHackerspaces />);
      fetchPreview();
      await screen.findByText('Example Workshop');
      await connectSigner();
      if (when === 'before signing')
        getPublicKey.mockResolvedValue('different-key');
      else
        signEvent.mockResolvedValue({
          pubkey: 'different-key',
          id: 'different-event',
          sig: '',
        });
      fireEvent.click(screen.getByRole('button', { name: /Sign and publish/ }));
      await screen.findByText(/The signing key changed/);
      expect(publish).not.toHaveBeenCalled();
      expect(publishNomadwiki).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: /Sign and publish/ }),
      ).toBeDisabled();
    },
  );

  it('reports an extension disconnected after connecting', async () => {
    render(<AdminHackerspaces />);
    fetchPreview();
    await screen.findByText('Example Workshop');
    await connectSigner();
    delete window.nostr;
    fireEvent.click(screen.getByRole('button', { name: /Sign and publish/ }));
    await screen.findByText('A NIP-07 signer is required.');
    expect(publish).not.toHaveBeenCalled();
  });

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
      await publishChanges();
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
    await publishChanges();
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
    let finishSigning!: (value: Record<string, unknown>) => void;
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
    await publishChanges();
    await screen.findByText(/Signing and publishing 1 of 1/);
    expect(
      screen.getByRole('button', { name: /Sign and publish/ }),
    ).toBeDisabled();
    finishSigning({ kind: 33000 });
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
      await publishChanges();
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
    await publishChanges();
    await screen.findByText('Could not connect to the relay or signer.');
    expect(signEvent).not.toHaveBeenCalled();
    expect(screen.getAllByText(/connection unavailable/)).toHaveLength(2);
  });
});
