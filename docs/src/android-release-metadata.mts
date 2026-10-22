export const releasesApi =
  'https://api.github.com/repos/Trustroots/trustroots/releases?per_page=100';
export const publisher =
  'faf5d2e8ffb56fa201bc04cd8bf74a3e38de7d0439ada7fb15310d3d374ed5b1';

export interface ReleaseAsset {
  name: string;
  browser_download_url?: string;
  digest?: string;
  size?: number;
}
export interface GitHubRelease {
  name?: string;
  draft: boolean;
  prerelease: boolean;
  tag_name: string;
  published_at: string;
  assets: ReleaseAsset[];
}
export interface PreviewRelease {
  version: string;
  published: string;
  url: string;
  filename: string;
}
export interface ZapstoreVersion {
  version: string;
  published: string;
}

function isRelease(value: unknown): value is GitHubRelease {
  if (!value || typeof value !== 'object') return false;
  const release = value as Partial<GitHubRelease>;
  return (
    typeof release.draft === 'boolean' &&
    typeof release.prerelease === 'boolean' &&
    typeof release.tag_name === 'string' &&
    typeof release.published_at === 'string' &&
    (release.name === undefined || typeof release.name === 'string') &&
    Array.isArray(release.assets) &&
    release.assets.every(asset => asset && typeof asset.name === 'string')
  );
}

export function selectPreview(releases: unknown): PreviewRelease {
  if (!Array.isArray(releases)) throw new Error('Invalid release response');
  const release = releases
    .filter(isRelease)
    .filter(
      item =>
        !item.draft &&
        item.prerelease &&
        item.tag_name.startsWith('android-preview-') &&
        item.assets.some(asset => asset.name.endsWith('.apk')),
    )
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0];
  const apk = release?.assets.find(asset => asset.name.endsWith('.apk'));
  if (!release || !apk || typeof apk.browser_download_url !== 'string')
    throw new Error('No signed APK found');
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

export function zapstoreRelease(
  Socket: typeof WebSocket = WebSocket,
): Promise<ZapstoreVersion> {
  return new Promise((resolve, reject) => {
    const socket = new Socket('wss://relay.zapstore.dev');
    let newest: ZapstoreVersion | undefined;
    const timer = setTimeout(() => finish(), 10000);
    function finish(error?: Error) {
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
    socket.onmessage = ({ data }: MessageEvent<string>) => {
      try {
        const message: unknown = JSON.parse(data);
        if (!Array.isArray(message)) return;
        const [type, subscription, value] = message as unknown[];
        if (subscription !== 'android-version') return;
        if (type === 'EOSE') return finish();
        if (type !== 'EVENT' || !value || typeof value !== 'object') return;
        const event = value as {
          kind?: number;
          pubkey?: string;
          tags?: string[][];
          created_at?: number;
        };
        const tags = event.tags;
        if (
          event.kind !== 30063 ||
          event.pubkey !== publisher ||
          !Array.isArray(tags) ||
          tags.some(
            tag =>
              !Array.isArray(tag) ||
              tag.some(value => typeof value !== 'string'),
          )
        )
          return;
        const tag = (name: string) => tags.find(item => item[0] === name)?.[1];
        if (tag('i') !== 'org.trustroots.android' || tag('c') !== 'beta')
          return;
        const version = tag('version');
        if (
          !version ||
          typeof event.created_at !== 'number' ||
          !Number.isFinite(event.created_at)
        )
          return;
        const published = new Date(event.created_at * 1000).toISOString();
        if (!newest || published > newest.published)
          newest = { version, published };
      } catch {
        // Ignore malformed relay messages and retain any valid release already found.
      }
    };
  });
}
