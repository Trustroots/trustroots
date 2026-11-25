import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import '@/config/client/i18n';
import http from '@trustroots/core/http-client';
import TopicChat from '@/modules/tribes/client/components/TopicChat';
import {
  CHAT_ATTRIBUTION_TAG,
  chatTemplate,
} from '@/modules/tribes/shared/circle-chat';

vi.mock('@trustroots/core/http-client', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));
const member = { _id: 'member-1', username: 'fictional-member' };
const serviceKey = generateSecretKey();
const memberKey = generateSecretKey();
const servicePubkey = getPublicKey(serviceKey);

function openChat(props: React.ComponentProps<typeof TopicChat>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <TopicChat {...props} />
    </QueryClientProvider>,
  );
  return { ...result, client };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(http.get).mockImplementation(async url => ({
    data:
      url === '/api/nostr/author-visibility'
        ? { usernames: {} }
        : { messages: [], servicePubkey },
  }));
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

it('loads history and displays the composer only while the account is a member', async () => {
  const message = finalizeEvent(
    chatTemplate('hackers', 'Fictional older message'),
    memberKey,
  );
  vi.mocked(http.get).mockResolvedValueOnce({
    data: { messages: [message], servicePubkey },
  });
  const { client, rerender } = openChat({ roomName: 'hackers', user: member });
  expect(http.get).not.toHaveBeenCalled();
  expect(screen.queryByText(message.content)).not.toBeInTheDocument();
  expect(
    screen.getByText(/join this circle using the join button/i),
  ).toBeVisible();
  expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();

  rerender(
    <QueryClientProvider client={client}>
      <TopicChat roomName="hackers" user={member} isCircleMember />
    </QueryClientProvider>,
  );
  expect(screen.getByLabelText('Message')).toBeEnabled();
  expect(await screen.findByText(message.content)).toBeVisible();
  expect(
    screen.queryByText(/join this circle using the join button/i),
  ).not.toBeInTheDocument();
  rerender(
    <QueryClientProvider client={client}>
      <TopicChat roomName="hackers" user={member} />
    </QueryClientProvider>,
  );
  expect(screen.queryByText(message.content)).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
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
  openChat({ roomName: 'hitchhikers', user: member, isCircleMember: true });
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
});

it('offers to reload chat after an initial request fails', async () => {
  const previousMessage = finalizeEvent(
    chatTemplate('volunteering', 'Fictional older message'),
    memberKey,
  );
  vi.mocked(http.get)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({
      data: { messages: [previousMessage], servicePubkey },
    });
  openChat({ roomName: 'volunteering', user: member });
  const retry = await screen.findByRole('button', {
    name: 'Retry loading messages',
  });
  expect(screen.getByLabelText('Message')).toBeEnabled();
  fireEvent.click(retry);
  expect(await screen.findByText(previousMessage.content)).toBeVisible();
  expect(retry).not.toBeInTheDocument();
});

it('retains the conversation when a background refresh fails', async () => {
  const previousMessage = finalizeEvent(
    chatTemplate('hackers', 'Fictional older message'),
    memberKey,
  );
  vi.mocked(http.get).mockResolvedValueOnce({
    data: { messages: [previousMessage], servicePubkey },
  });
  const { client } = openChat({
    roomName: 'hackers',
    user: member,
    isCircleMember: true,
  });
  expect(await screen.findByText(previousMessage.content)).toBeVisible();
  vi.mocked(http.get).mockRejectedValueOnce(new Error('offline'));
  await act(() =>
    client.refetchQueries({ queryKey: ['circle-chat', 'hackers', member._id] }),
  );
  expect(
    await screen.findByRole('button', { name: 'Retry loading messages' }),
  ).toBeVisible();
  let finish!: () => void;
  vi.mocked(http.get).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = () =>
          resolve({ data: { messages: [previousMessage], servicePubkey } });
      }),
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Retry loading messages' }),
  );
  expect(
    await screen.findByRole('button', { name: 'Loading messages…' }),
  ).toBeDisabled();
  expect(screen.getByText(previousMessage.content)).toBeVisible();
  await act(async () => finish());
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Loading messages…' }),
    ).not.toBeInTheDocument(),
  );
});

it('guards against empty and duplicate submissions while a post is pending', async () => {
  const posted = finalizeEvent(
    chatTemplate('hackers', 'Fictional post'),
    serviceKey,
  );
  let finish!: () => void;
  vi.mocked(http.post).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = () => resolve({ data: posted });
      }),
  );
  openChat({ roomName: 'hackers', user: member, isCircleMember: true });
  expect(await screen.findByText('No messages yet.')).toBeVisible();
  const input = screen.getByLabelText('Message');
  const form = input.closest('form')!;
  fireEvent.submit(form);
  expect(http.post).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: posted.content } });
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(http.post).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  await act(async () => finish());
  expect(await screen.findByText(posted.content)).toBeVisible();
  expect(input).toHaveValue('');
});

it('recognises a server-signed post when chat history is unavailable', async () => {
  vi.mocked(http.get).mockRejectedValueOnce(new Error('offline'));
  const post = chatTemplate('hackers', 'Fictional chat');
  post.tags.push([CHAT_ATTRIBUTION_TAG, member.username]);
  vi.mocked(http.post).mockResolvedValueOnce({
    data: finalizeEvent(post, serviceKey),
  });

  openChat({ roomName: 'hackers', user: member, isCircleMember: true });
  expect(
    await screen.findByText('Could not load chat messages.'),
  ).toHaveAttribute('role', 'status');
  fireEvent.change(screen.getByLabelText('Message'), {
    target: { value: 'Fictional chat' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(
    await screen.findByText('fictional-member via Trustroots'),
  ).toBeVisible();
});

it('keeps the draft when a server send fails', async () => {
  vi.mocked(http.post).mockRejectedValueOnce(new Error('offline'));
  openChat({ roomName: 'hackers', user: member, isCircleMember: true });
  const composer = screen.getByLabelText('Message');
  fireEvent.change(composer, { target: { value: 'Fictional draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Message could not be sent',
  );
  expect(composer).toHaveValue('Fictional draft');
  await waitFor(() => expect(composer).toBeEnabled());
});
