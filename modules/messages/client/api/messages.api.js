import axios from 'axios';
import parseLinkheader from 'parse-link-header';

export async function fetchThreads(params = {}) {
  const { data: threads, headers } = await axios.get('/api/messages', {
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
    threads,
    nextParams,
  };
}

export async function fetchMessages(userId) {
  const { data: messages } = await axios.get(`/api/messages/${userId}`);
  return messages;
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
  // the server response is a bit wrong, status 200, but no body or content-type, so we
  // force the response type here to prevent the browser assuming it's XML (Firefox)
  await axios.post(
    '/api/messages-read',
    { messageIds },
    { responseType: 'json' },
  );
}
