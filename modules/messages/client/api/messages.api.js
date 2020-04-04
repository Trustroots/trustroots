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
