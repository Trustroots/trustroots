/* global WebSocket */
export const releasesApi =
  'https://api.github.com/repos/Trustroots/trustroots/releases?per_page=100';
export const publisher =
  'faf5d2e8ffb56fa201bc04cd8bf74a3e38de7d0439ada7fb15310d3d374ed5b1';

export function selectPreview(releases) {
  const release = releases
    .filter(
      item =>
        !item.draft &&
        item.prerelease &&
        item.tag_name.startsWith('android-preview-') &&
        item.assets.some(asset => asset.name.endsWith('.apk')),
    )
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
  const apk = release?.assets.find(asset => asset.name.endsWith('.apk'));
  if (!apk) throw new Error('No signed APK found');
  const version =
    release.name?.replace(/^Android preview /, '') ||
    release.tag_name.match(/-v(.+)$/)?.[1];
  if (!version) throw new Error('No Android version found');
  return {
    version,
    published: new Date(release.published_at).toISOString(),
    url: apk.browser_download_url,
    filename: apk.name,
  };
}

export function zapstoreRelease(Socket = WebSocket) {
  return new Promise((resolve, reject) => {
    const socket = new Socket('wss://relay.zapstore.dev');
    let newest;
    const timer = setTimeout(() => finish(), 10000);
    function finish(error) {
      clearTimeout(timer);
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      if (error || !newest)
        reject(error || new Error('No Zapstore beta release found'));
      else resolve(newest);
    }
    socket.onopen = () =>
      socket.send(
        JSON.stringify([
          'REQ',
          'android-version',
          {
            kinds: [30063],
            authors: [publisher],
            '#i': ['org.trustroots.android'],
            '#c': ['beta'],
            limit: 20,
          },
        ]),
      );
    socket.onerror = () => finish(new Error('Zapstore lookup failed'));
    socket.onclose = () => finish(new Error('Zapstore connection closed'));
    socket.onmessage = ({ data }) => {
      try {
        const [type, subscription, event] = JSON.parse(data);
        if (subscription !== 'android-version') return;
        if (type === 'EOSE') return finish();
        if (
          type !== 'EVENT' ||
          event.kind !== 30063 ||
          event.pubkey !== publisher
        )
          return;
        const tag = name => event.tags.find(item => item[0] === name)?.[1];
        if (tag('i') !== 'org.trustroots.android' || tag('c') !== 'beta')
          return;
        const version = tag('version');
        if (!version || !Number.isFinite(event.created_at)) return;
        const published = new Date(event.created_at * 1000).toISOString();
        if (!newest || published > newest.published)
          newest = { version, published };
      } catch {
        // Ignore malformed relay messages and keep any valid release already found.
      }
    };
  });
}
