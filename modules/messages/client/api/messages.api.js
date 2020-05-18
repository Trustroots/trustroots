import axios from 'axios';
import parseLinkheader from 'parse-link-header';

async function fetchWithNextParams(url, params = {}) {
  const { data, headers } = await axios.get(url, {
    params,
  });
  let nextParams;
  if (headers.link) {
    const links = parseLinkheader(headers.link);
    if (links.next) {
      const params = links.next;
      delete params.url;
      delete params.rel;
      nextParams = params;
    }
  }
  return {
    data,
    nextParams,
  };
}

export async function fetchThreads(params = {}) {
  const { data: threads, nextParams } = await fetchWithNextParams(
    '/api/messages',
    params,
  );
  return {
    threads,
    nextParams,
  };
}

export async function fetchMessages(userId, params = {}) {
  const { data: messages, nextParams } = await fetchWithNextParams(
    `/api/messages/${userId}`,
    params,
  );
  return {
    messages,
    nextParams,
  };
}

export async function sendMessage(userToId, content) {
  const { data: message } = await axios.post('/api/messages', {
    userTo: userToId,
    content,
    read: false,
  });
  return message;
}

export async function markRead(messageIds) {
  await axios.post('/api/messages-read', { messageIds });
}

export async function unreadCount() {
  const {
    data: { unread },
  } = await axios.get('/api/messages-count');
  return unread;
}
