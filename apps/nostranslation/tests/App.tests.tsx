import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import QRCode from 'qrcode';
import App from '../client/App.tsx';
import {
  authorisation,
  browserSigner,
  bunkerSigner,
  remoteConnection,
} from '../client/signers.ts';
import type { Catalogue } from '../shared.ts';

jest.mock('../client/signers.ts', () => ({
  authorisation: jest.fn(),
  browserSigner: jest.fn(),
  bunkerSigner: jest.fn(),
  remoteConnection: jest.fn(),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn() }));

function data(): Catalogue {
  return {
    locale: 'de',
    revision: 'revision',
    entries: [
      {
        id: 'users:Welcome',
        namespace: 'users',
        key: 'Welcome',
        source: 'Welcome {{name}}',
        sourceHash: 'a'.repeat(64),
        original: null,
        needsReview: true,
        suggestion: 'Willkommen {{name}}',
        model: 'test-model',
      },
      {
        id: 'pages:Hello',
        namespace: 'pages',
        key: 'Hello',
        source: 'Hello',
        sourceHash: 'b'.repeat(64),
        original: 'Hallo',
        needsReview: false,
      },
      {
        id: 'users:Bye',
        namespace: 'users',
        key: 'Bye',
        source: 'Bye',
        sourceHash: 'c'.repeat(64),
        original: null,
        needsReview: true,
      },
    ],
  };
}
let current: Catalogue;
let fetchMock: jest.Mock;
let signer: { getPublicKey: jest.Mock; signEvent: jest.Mock; close: jest.Mock };
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  current = data();
  signer = {
    getPublicKey: jest.fn(async () => 'a'.repeat(64)),
    signEvent: jest.fn(),
    close: jest.fn(async () => {}),
  };
  jest.mocked(browserSigner).mockReturnValue(signer);
  jest.mocked(bunkerSigner).mockResolvedValue(signer);
  jest.mocked(authorisation).mockResolvedValue('Nostr signed');
  fetchMock = jest.fn(async (input: string) => ({
    ok: true,
    json: async () =>
      input.endsWith('/api/languages')
        ? [
            { code: 'de', label: 'Deutsch', english: 'German' },
            { code: 'ar', label: 'العربية', english: 'Arabic' },
          ]
        : input.endsWith('/api/reviews')
          ? { url: 'https://github.com/Trustroots/trustroots/pull/99999' }
          : JSON.parse(JSON.stringify(current)),
  }));
  globalThis.fetch = fetchMock;
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

async function ready() {
  render(<App />);
  await screen.findByText('Proofread translations');
}
const fields = () => screen.getAllByLabelText('Your proposed translation');
const buttons = (name: string) => screen.getAllByRole('button', { name });
function edit(index: number, value: string) {
  fireEvent.change(fields()[index], { target: { value } });
}
async function review() {
  fireEvent.click(buttons('Approve translation')[0]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Review approved translations' }),
  );
}
async function connect() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Connect browser signer' }),
  );
  await screen.findByText(/Connected key:/);
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Connect browser signer' }),
    ).not.toBeDisabled(),
  );
}

describe('proofreading and improvements', () => {
  it('lets reviewers skip a string without losing their correction', async () => {
    await ready();
    edit(0, 'Hallo {{name}}');
    fireEvent.click(buttons('Skip for now')[0]);
    expect(fields()).toHaveLength(1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh translations' }),
    );
    await waitFor(() => expect(fields()).toHaveLength(2));
    expect(fields()[0]).toHaveValue('Hallo {{name}}');
    expect(screen.getByText(/0 approved/)).toBeInTheDocument();
  });
  it('shows published wording alongside an AI revision for comparison', async () => {
    current.entries[1].suggestion = 'Guten Tag';
    current.entries[1].needsReview = true;
    await ready();
    expect(screen.getByText('Published: Hallo')).toBeInTheDocument();
  });
  it('supports search, language and section selection, published improvements, validation and approval', async () => {
    await ready();
    expect(fields()).toHaveLength(2);
    expect(fields()[0]).toHaveValue('Willkommen {{name}}');
    edit(0, 'Missing placeholder');
    expect(screen.getByText(/Keep every/)).toBeInTheDocument();
    expect(buttons('Approve translation')[0]).toBeDisabled();
    edit(0, '');
    expect(screen.queryByText(/Keep every/)).not.toBeInTheDocument();
    fireEvent.click(buttons('Reset')[0]);
    expect(fields()[0]).toHaveValue('Willkommen {{name}}');
    fireEvent.click(buttons('Reset')[1]);
    expect(fields()[1]).toHaveValue('');
    edit(1, 'Tschüss');
    fireEvent.click(buttons('Approve translation')[1]);
    expect(screen.getByText(/1 approved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo approval' }));
    expect(screen.getByText(/0 approved/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Show'), {
      target: { value: 'all' },
    });
    expect(fields()).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'HALLO' },
    });
    expect(fields()).toHaveLength(1);
    edit(0, 'Guten Tag');
    fireEvent.click(buttons('Approve translation')[0]);
    expect(screen.getByText(/1 approved/)).toBeInTheDocument();
    edit(0, 'Guten Morgen');
    expect(screen.getByText(/0 approved/)).toBeInTheDocument();
    fireEvent.click(buttons('Reset')[0]);
    expect(fields()[0]).toHaveValue('Hallo');
    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Section'), {
      target: { value: 'pages' },
    });
    expect(fields()).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Show'), {
      target: { value: 'missing' },
    });
    expect(screen.getByText(/No strings here yet/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'ar' },
    });
    await screen.findByText('Proofread translations');
    expect(screen.getByLabelText('Section')).toHaveValue('');
  });

  it('persists local edits and clears approvals after stale source or target changes', async () => {
    await ready();
    edit(0, 'Hallo {{name}}');
    fireEvent.click(buttons('Approve translation')[0]);
    cleanup();
    await ready();
    expect(fields()[0]).toHaveValue('Hallo {{name}}');
    expect(screen.getByText(/1 approved/)).toBeInTheDocument();
    current.entries[0].sourceHash = 'd'.repeat(64);
    fireEvent.click(
      screen.getByRole('button', { name: 'Refresh translations' }),
    );
    await waitFor(() =>
      expect(screen.getByText(/0 approved/)).toBeInTheDocument(),
    );
    expect(fields()[0]).toHaveValue('Hallo {{name}}');
  });

  it('paginates long queues and reviews at most 100 strings per batch', async () => {
    current.entries = Array.from({ length: 102 }, (_, index) => ({
      ...data().entries[0],
      id: 'users:' + index,
      source: 'Hello ' + index,
      suggestion: 'Hallo ' + index,
    }));
    localStorage.setItem(
      'nostranslation:de',
      JSON.stringify(
        Object.fromEntries(
          current.entries.map(entry => [
            entry.id,
            {
              value: entry.suggestion,
              sourceHash: entry.sourceHash,
              original: null,
              approved: true,
            },
          ]),
        ),
      ),
    );
    await ready();
    expect(fields()).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Review approved translations' }),
    );
    expect(fields()).toHaveLength(100);
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to proofreading' }),
    );
    expect(fields()).toHaveLength(20);
  });
});

describe('signing and submission', () => {
  it('reviews corrections and submits a signed batch with a PR link', async () => {
    await ready();
    edit(0, 'Herzlich willkommen {{name}}');
    await review();
    await connect();
    fireEvent.change(screen.getByLabelText('Trustroots username'), {
      target: { value: ' Fictional-Translator ' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reviewed translations' }),
    );
    await screen.findByRole('link', { name: 'View your translation PR' });
    const call = fetchMock.mock.calls.find(call =>
      String(call[0]).endsWith('/api/reviews'),
    )!;
    expect(JSON.parse(call[1].body)).toMatchObject({
      username: 'fictional-translator',
      locale: 'de',
      changes: [
        expect.objectContaining({ value: 'Herzlich willkommen {{name}}' }),
      ],
    });
    expect(call[1].headers.Authorization).toBe('Nostr signed');
    expect(screen.getByRole('status')).toHaveTextContent(
      /guide later AI drafts once merged/,
    );
    expect(JSON.parse(localStorage.getItem('nostranslation:de')!)).toEqual({});
  });

  it('retains drafts through key changes, signing rejection and API failures', async () => {
    await ready();
    await review();
    await connect();
    fireEvent.change(screen.getByLabelText('Trustroots username'), {
      target: { value: 'fictional' },
    });
    signer.getPublicKey.mockResolvedValueOnce('b'.repeat(64));
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reviewed translations' }),
    );
    await screen.findByText(/signer changed its key/);
    jest
      .mocked(authorisation)
      .mockRejectedValueOnce(new Error('Signature denied'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reviewed translations' }),
    );
    await screen.findByText('Signature denied');
    jest.mocked(authorisation).mockRejectedValueOnce('cancelled');
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reviewed translations' }),
    );
    await screen.findByText(/Submission failed/);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Identity mismatch' }),
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reviewed translations' }),
    );
    await screen.findByText('Identity mismatch');
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit reviewed translations' }),
    );
    await screen.findByText(/translation service is unavailable/);
    expect(
      JSON.parse(localStorage.getItem('nostranslation:de')!)[
        current.entries[0].id
      ].approved,
    ).toBe(true);
  });

  it('connects and replaces remote signers and handles failed key retrieval', async () => {
    await ready();
    await review();
    fireEvent.change(screen.getByLabelText('Remote signer URL'), {
      target: { value: 'bunker://fictional' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect remote signer' }),
    );
    await screen.findByText(/Connected key:/);
    const next = {
      getPublicKey: jest.fn(async () => 'b'.repeat(64)),
      signEvent: jest.fn(),
    };
    jest.mocked(browserSigner).mockReturnValueOnce(next);
    await connect();
    expect(signer.close).toHaveBeenCalledTimes(1);
    const rejected = {
      getPublicKey: jest.fn(async () => {
        throw new Error('denied');
      }),
      signEvent: jest.fn(),
      close: jest.fn(async () => {}),
    };
    jest.mocked(browserSigner).mockReturnValueOnce(rejected);
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect browser signer' }),
    );
    await screen.findByText(/Could not connect/);
    expect(rejected.close).toHaveBeenCalledTimes(1);
    jest.mocked(browserSigner).mockImplementationOnce(() => {
      throw new Error('unavailable');
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect browser signer' }),
    );
    await screen.findByText(/Could not connect/);
  });

  it('offers a QR/deep link, supports cancellation and reports preparation failures', async () => {
    await ready();
    await review();
    jest
      .mocked(QRCode.toDataURL)
      .mockResolvedValue('data:image/png;base64,fictional' as never);
    let reject: (error: Error) => void = () => {};
    jest.mocked(remoteConnection).mockImplementation(signal => ({
      uri: 'nostrconnect://fictional',
      connect: () =>
        new Promise((_resolve, fail) => {
          reject = fail;
          signal.addEventListener('abort', () => fail(new Error('cancelled')));
        }) as Promise<never>,
    }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with QR code' }),
    );
    await screen.findByAltText('Remote signer connection QR code');
    expect(
      screen.getByRole('link', { name: 'Open in your signer' }),
    ).toHaveAttribute('href', 'nostrconnect://fictional');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel connection' }));
    await screen.findByText(/Could not connect/);
    expect(
      screen.queryByAltText('Remote signer connection QR code'),
    ).not.toBeInTheDocument();
    jest
      .mocked(QRCode.toDataURL)
      .mockRejectedValueOnce(new Error('QR unavailable') as never);
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with QR code' }),
    );
    await screen.findByText(/Could not prepare/);
    jest.mocked(remoteConnection).mockReturnValue({
      uri: 'nostrconnect://fictional',
      connect: async () =>
        signer as unknown as Awaited<
          ReturnType<ReturnType<typeof remoteConnection>['connect']>
        >,
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Connect with QR code' }),
    );
    await screen.findByText(/Connected key:/);
    void reject;
  });
});

describe('loading and browser storage failures', () => {
  it('reports unavailable languages and catalogue failures', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Language service offline'));
    render(<App />);
    await screen.findByText('Language service offline');
    cleanup();
    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => [],
    }));
    render(<App />);
    await waitFor(() =>
      expect(screen.getByLabelText('Language').children).toHaveLength(0),
    );
    cleanup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ code: 'de', label: 'Deutsch', english: 'German' }],
      })
      .mockRejectedValueOnce(new Error('Catalogue offline'));
    render(<App />);
    await screen.findByText('Catalogue offline');
  });
  it('warns when drafts cannot be saved while allowing editing', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    await ready();
    expect(screen.getByRole('status')).toHaveTextContent(/cannot save drafts/);
    edit(0, 'Hallo {{name}}');
    expect(fields()[0]).toHaveValue('Hallo {{name}}');
  });
  it('ignores catalogue results after a language change or unmount', async () => {
    let finish: (value: unknown) => void = () => {};
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ code: 'de', label: 'Deutsch', english: 'German' }],
      })
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
    const view = render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    view.unmount();
    await act(async () => {
      finish({ ok: true, json: async () => data() });
    });
    let fail: (error: Error) => void = () => {};
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ code: 'de', label: 'Deutsch', english: 'German' }],
      })
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            fail = reject;
          }),
      );
    const another = render(<App />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    another.unmount();
    await act(async () => {
      fail(new Error('offline'));
    });
  });
});
