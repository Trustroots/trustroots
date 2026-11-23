import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  nip19,
} from 'nostr-tools';
import '@/config/client/i18n';
import http from '@/modules/core/client/api/http-client';
import TopicChat from '@/modules/tribes/client/components/TopicChat';
import { withCircleChatRelay } from '@/modules/tribes/shared/circle-chat-relay';
import {
  CHAT_ATTRIBUTION_TAG,
  chatTemplate,
} from '@/modules/tribes/shared/circle-chat';
import useCircleSigner from '@/modules/tribes/client/hooks/useCircleSigner';

vi.mock('@/modules/core/client/api/http-client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('@/modules/tribes/client/hooks/useCircleSigner', () => ({
  default: vi.fn(),
}));
vi.mock('@/modules/tribes/shared/circle-chat-relay', () => ({
  withCircleChatRelay: vi.fn(),
}));

const member = { _id: 'member-1', username: 'fictional-member' };
const serviceKey = generateSecretKey();
const memberKey = generateSecretKey();
const servicePubkey = getPublicKey(serviceKey);
const sign = vi.fn(async template => finalizeEvent(template, memberKey));
const connect = vi.fn();

function openChat(props: React.ComponentProps<typeof TopicChat>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TopicChat {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  sign.mockImplementation(async template => finalizeEvent(template, memberKey));
  vi.mocked(http.get).mockImplementation(async url => ({
    data:
      url === '/api/nostr/author-visibility'
        ? { usernames: {} }
        : { messages: [], servicePubkey },
  }));
  vi.mocked(useCircleSigner).mockReturnValue({
    signer: undefined,
    connecting: false,
    error: '',
    connect,
  });
});

it('lets visitors sign in without requesting chat history', () => {
  openChat({ roomName: 'hackers' });
  expect(
    screen.getByRole('link', { name: 'Log in to see chat.' }),
  ).toHaveAttribute(
    'href',
    '/signin?continue=true&returnTo=%2Fcircles%2Fhackers',
  );
  expect(http.get).not.toHaveBeenCalled();
});

it('posts as a keyless member and recognises attribution only from the Trustroots key', async () => {
  const spoof = chatTemplate('hitchhikers', 'Fictional spoof');
  spoof.tags.push([CHAT_ATTRIBUTION_TAG, 'other-member']);
  vi.mocked(http.get).mockResolvedValueOnce({
    data: { messages: [finalizeEvent(spoof, memberKey)], servicePubkey },
  });
  const post = chatTemplate('hitchhikers', 'Fictional chat');
  post.tags.push([CHAT_ATTRIBUTION_TAG, member.username]);
  vi.mocked(http.post).mockResolvedValueOnce({
    data: finalizeEvent(post, serviceKey),
  });
  openChat({ roomName: 'hitchhikers', user: member });
  expect(await screen.findByText('Fictional spoof')).toBeVisible();
  expect(
    screen.queryByText('other-member via Trustroots'),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: ' Fictional chat ' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(
    await screen.findByText('fictional-member via Trustroots'),
  ).toBeVisible();
  expect(http.post).toHaveBeenCalledWith('/api/tribes/chat/hitchhikers', {
    content: 'Fictional chat',
    channel: undefined,
  });
  expect(withCircleChatRelay).not.toHaveBeenCalled();
});

it('uses the matching member signer when linked', async () => {
  vi.mocked(useCircleSigner).mockReturnValue({
    signer: { publicKey: getPublicKey(memberKey), sign },
    connecting: false,
    error: '',
    connect,
  });
  const publish = vi.fn(async () => 'ok');
  vi.mocked(withCircleChatRelay).mockImplementation(async (_sign, run) =>
    run({ publish } as never),
  );
  openChat({
    roomName: 'volunteering',
    user: { ...member, nostrNpub: nip19.npubEncode(getPublicKey(memberKey)) },
  });
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'Fictional chat' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText('Fictional chat')).toBeVisible();
  expect(publish).toHaveBeenCalledWith(
    expect.objectContaining({
      pubkey: getPublicKey(memberKey),
      tags: [['t', 'trustroots-volunteering']],
    }),
  );
  expect(http.post).not.toHaveBeenCalled();
});

it('keeps the draft when a server send fails', async () => {
  vi.mocked(http.post).mockRejectedValueOnce(new Error('offline'));
  openChat({ roomName: 'hackers', user: member });
  const composer = screen.getByLabelText('Message');
  fireEvent.change(composer, { target: { value: 'Fictional draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Message could not be sent',
  );
  expect(composer).toHaveValue('Fictional draft');
  await waitFor(() => expect(composer).toBeEnabled());
});

it('prompts a linked member without a connected signer', () => {
  openChat({
    roomName: 'hackers',
    user: { ...member, nostrNpub: nip19.npubEncode(getPublicKey(memberKey)) },
  });
  expect(screen.getByLabelText('Message')).toBeDisabled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Connect Nostr identity' }),
  );
  expect(connect).toHaveBeenCalledOnce();
});
