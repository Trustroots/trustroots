import axios from 'axios';

import {
  fetchMessages,
  fetchHostingContext,
  fetchThreads,
  markRead,
  previewMessage,
  sendMessage,
  unreadCount,
  type MessageThreadSummary,
} from '@/modules/messages/client/api/messages.api';
import {
  generateClientUser,
  generateMessage,
  generateThread,
} from '@/testutils/client/data.client.testutil';

jest.mock('axios', () =>
  jest.requireActual('@/modules/core/tests/client/api/axios.mock'),
);

const mockedAxios = axios as jest.Mocked<typeof axios>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('messages api', () => {
  it.each([true, false])(
    'includes an explicit hosting acknowledgement: %s',
    async acknowledged => {
      mockedAxios.post.mockResolvedValueOnce({ data: {} });
      await sendMessage('fictional-host', 'A fictional request.', acknowledged);
      expect(mockedAxios.post).toHaveBeenCalledWith('/api/messages', {
        userTo: 'fictional-host',
        content: 'A fictional request.',
        read: false,
        hostingDescriptionAcknowledged: acknowledged,
      });
    },
  );
  it('includes hosting details when sending a hosting message', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    await sendMessage('fictional-host', 'A fictional request.', true, {
      guests: 2,
      arrival: '2026-08-10',
      departure: '2026-08-13',
    });
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/messages', {
      userTo: 'fictional-host',
      content: 'A fictional request.',
      read: false,
      hostingDescriptionAcknowledged: true,
      hostingDetails: {
        guests: 2,
        arrival: '2026-08-10',
        departure: '2026-08-13',
      },
    });
  });
  it('fetches the active hosting context for an opted-in conversation', async () => {
    const context = {
      description: 'Please arrive before sunset.',
      acknowledgementRequired: true,
    };
    mockedAxios.get.mockResolvedValueOnce({ data: context });
    await expect(fetchHostingContext('fictional-host')).resolves.toEqual(
      context,
    );
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/messages-hosting', {
      params: { userTo: 'fictional-host' },
    });
  });
  it('formats a draft without sending it', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { content: '<p>Draft</p>' },
    });
    await expect(previewMessage('<p>Draft</p>')).resolves.toBe('<p>Draft</p>');
    expect(mockedAxios.post).toHaveBeenCalledWith('/api/messages-preview', {
      content: '<p>Draft</p>',
    });
  });
  it('fetches threads and extracts next pagination params', async () => {
    const threads: MessageThreadSummary[] = [generateThread()];
    mockedAxios.get.mockResolvedValueOnce({
      data: threads,
      headers: {
        link: '</api/messages?before=abc123&limit=10>; rel="next"',
      },
    });

    await expect(fetchThreads({ limit: 10 })).resolves.toEqual({
      threads,
      nextParams: { before: 'abc123', limit: '10' },
    });

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/messages', {
      params: { limit: 10 },
    });
  });

  it('fetches threads with default params', async () => {
    const threads: MessageThreadSummary[] = [generateThread()];
    mockedAxios.get.mockResolvedValueOnce({
      data: threads,
      headers: {},
    });

    await expect(fetchThreads()).resolves.toEqual({
      threads,
      nextParams: undefined,
    });

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/messages', {
      params: {},
    });
  });

  it('ignores pagination links without next params', async () => {
    const threads: MessageThreadSummary[] = [generateThread()];
    mockedAxios.get.mockResolvedValueOnce({
      data: threads,
      headers: {
        link: '</api/messages?before=abc123&limit=10>; rel="prev"',
      },
    });

    await expect(fetchThreads()).resolves.toEqual({
      threads,
      nextParams: undefined,
    });
  });

  it('fetches messages for a user without pagination params', async () => {
    const messages = [generateMessage(generateClientUser())];
    mockedAxios.get.mockResolvedValueOnce({
      data: messages,
      headers: {},
    });

    await expect(fetchMessages('user-1')).resolves.toEqual({
      messages,
      nextParams: undefined,
    });

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/messages/user-1', {
      params: {},
    });
  });

  it('fetches messages for a user and extracts next pagination params', async () => {
    const messages = [generateMessage(generateClientUser())];
    mockedAxios.get.mockResolvedValueOnce({
      data: messages,
      headers: {
        link: '</api/messages/user-1?before=def456>; rel="next"',
      },
    });

    await expect(fetchMessages('user-1')).resolves.toEqual({
      messages,
      nextParams: { before: 'def456' },
    });
  });

  it('sends a new unread message', async () => {
    const response = { data: { _id: 'message-1' } };
    mockedAxios.post.mockResolvedValueOnce(response);

    await expect(sendMessage('user-2', 'Can I stay?')).resolves.toBe(response);

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/messages', {
      userTo: 'user-2',
      content: 'Can I stay?',
      read: false,
    });
  });

  it('marks messages as read', async () => {
    mockedAxios.post.mockResolvedValueOnce({});

    await markRead(['message-1', 'message-2']);

    expect(mockedAxios.post).toHaveBeenCalledWith('/api/messages-read', {
      messageIds: ['message-1', 'message-2'],
    });
  });

  it('returns the unread message count', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { unread: 3 } });

    await expect(unreadCount()).resolves.toBe(3);

    expect(mockedAxios.get).toHaveBeenCalledWith('/api/messages-count');
  });
});
