import axios from 'axios';

import {
  fetchMessages,
  fetchThreads,
  markRead,
  sendMessage,
  unreadCount,
} from '@/modules/messages/client/api/messages.api';

jest.mock('axios');

afterEach(() => {
  jest.clearAllMocks();
});

describe('messages api', () => {
  it('fetches threads and extracts next pagination params', async () => {
    const threads = [{ _id: 'thread-1' }];
    axios.get.mockResolvedValueOnce({
      data: threads,
      headers: {
        link: '</api/messages?before=abc123&limit=10>; rel="next"',
      },
    });

    await expect(fetchThreads({ limit: 10 })).resolves.toEqual({
      threads,
      nextParams: { before: 'abc123', limit: '10' },
    });

    expect(axios.get).toHaveBeenCalledWith('/api/messages', {
      params: { limit: 10 },
    });
  });

  it('fetches threads with default params', async () => {
    const threads = [{ _id: 'thread-1' }];
    axios.get.mockResolvedValueOnce({
      data: threads,
      headers: {},
    });

    await expect(fetchThreads()).resolves.toEqual({
      threads,
      nextParams: undefined,
    });

    expect(axios.get).toHaveBeenCalledWith('/api/messages', {
      params: {},
    });
  });

  it('ignores pagination links without next params', async () => {
    const threads = [{ _id: 'thread-1' }];
    axios.get.mockResolvedValueOnce({
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
    const messages = [{ _id: 'message-1', content: 'Hello' }];
    axios.get.mockResolvedValueOnce({
      data: messages,
      headers: {},
    });

    await expect(fetchMessages('user-1')).resolves.toEqual({
      messages,
      nextParams: undefined,
    });

    expect(axios.get).toHaveBeenCalledWith('/api/messages/user-1', {
      params: {},
    });
  });

  it('fetches messages for a user and extracts next pagination params', async () => {
    const messages = [{ _id: 'message-1', content: 'Hello' }];
    axios.get.mockResolvedValueOnce({
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
    axios.post.mockResolvedValueOnce(response);

    await expect(sendMessage('user-2', 'Can I stay?')).resolves.toBe(response);

    expect(axios.post).toHaveBeenCalledWith('/api/messages', {
      userTo: 'user-2',
      content: 'Can I stay?',
      read: false,
    });
  });

  it('marks messages as read', async () => {
    axios.post.mockResolvedValueOnce({});

    await markRead(['message-1', 'message-2']);

    expect(axios.post).toHaveBeenCalledWith('/api/messages-read', {
      messageIds: ['message-1', 'message-2'],
    });
  });

  it('returns the unread message count', async () => {
    axios.get.mockResolvedValueOnce({ data: { unread: 3 } });

    await expect(unreadCount()).resolves.toBe(3);

    expect(axios.get).toHaveBeenCalledWith('/api/messages-count');
  });
});
