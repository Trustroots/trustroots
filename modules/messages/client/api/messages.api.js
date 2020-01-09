import axios from 'axios';
import parseLinkheader from 'parse-link-header';

export async function fetchThreads(params = {}) {
  const { data: threads, headers } = await axios.get('/api/messages', { params: { limit: 2, ...params } });
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

// TODO this doesn't belong here
export async function fetchUser(username) {
  const { data: user } = await axios.get(`/api/users/${username}`);
  return user;
}
