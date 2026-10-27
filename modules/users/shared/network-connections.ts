import * as nip19 from 'nostr-tools/nip19';

/** Supported external identity networks and the profile fields they map to. */
export const NETWORKS = [
  { id: 'couchers', label: 'Couchers.org' },
  { id: 'bewelcome', label: 'BeWelcome.org' },
  { id: 'couchsurfing', label: 'Couchsurfing.com' },
  { id: 'warmshowers', label: 'Warmshowers.org' },
  { id: 'servas', label: 'Servas' },
  { id: 'nostr', label: 'Nostr' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'twitter', label: 'Twitter' },
  { id: 'github', label: 'GitHub' },
] as const;

export type Network = (typeof NETWORKS)[number]['id'];

export interface Connection {
  network: Network;
  identifier: string;
}

export interface ConnectionHistoryEntry {
  network: Network;
  oldIdentifier: string | null;
  newIdentifier: string | null;
  changedAt: Date | null;
  initial: boolean;
}

interface ConnectionRecord {
  extSitesCouchers?: unknown;
  extSitesBW?: unknown;
  extSitesCS?: unknown;
  extSitesWS?: unknown;
  extSitesServas?: unknown;
  nostrNpub?: unknown;
  additionalProvidersData?: {
    facebook?: { id?: unknown };
    twitter?: { screen_name?: unknown };
    github?: { login?: unknown };
  };
}

const fields: Record<Network, (record: ConnectionRecord) => unknown> = {
  couchers: record => record.extSitesCouchers,
  bewelcome: record => record.extSitesBW,
  couchsurfing: record => record.extSitesCS,
  warmshowers: record => record.extSitesWS,
  servas: record => record.extSitesServas,
  nostr: record => record.nostrNpub,
  facebook: record => record.additionalProvidersData?.facebook?.id,
  twitter: record => record.additionalProvidersData?.twitter?.screen_name,
  github: record => record.additionalProvidersData?.github?.login,
};

const profileHosts: Record<Network, string[]> = {
  couchers: ['couchers.org'],
  bewelcome: ['bewelcome.org'],
  couchsurfing: ['couchsurfing.com'],
  warmshowers: ['warmshowers.org'],
  servas: ['servas.org'],
  nostr: ['njump.me', 'nos.trustroots.org'],
  facebook: ['facebook.com'],
  twitter: ['twitter.com', 'x.com'],
  github: ['github.com'],
};

/** Normalise only where the network treats identifiers case-insensitively. */
export function normaliseIdentifier(network: Network, input: string): string {
  const identifier = input.trim();
  if (network === 'servas') return identifier.replace(/^\/+|\/+$/g, '');
  if (network === 'nostr') {
    const lowercase = identifier.toLowerCase();
    if (/^[0-9a-f]{64}$/.test(lowercase)) {
      return nip19.npubEncode(lowercase);
    }
    return lowercase;
  }
  if (network === 'facebook') return identifier;
  return identifier.toLowerCase();
}

export function currentConnections(record: object): Connection[] {
  const source = record as ConnectionRecord;
  return NETWORKS.flatMap(({ id }) => {
    const raw = fields[id](source);
    if (typeof raw !== 'string' || !raw.trim()) return [];
    return [{ network: id, identifier: raw.trim() }];
  });
}

export function connectionSearchKey(
  network: Network,
  identifier: string,
): string {
  return `${network}:${normaliseIdentifier(network, identifier)}`;
}

export function connectionUrl(
  network: Network,
  identifier: string,
): string | null {
  const encoded = encodeURIComponent(normaliseIdentifier(network, identifier));
  switch (network) {
    case 'couchers':
      return `https://couchers.org/user/${encoded}`;
    case 'bewelcome':
      return `https://www.bewelcome.org/members/${encoded}`;
    case 'couchsurfing':
      return `https://www.couchsurfing.com/people/${encoded}`;
    case 'warmshowers':
      return `https://www.warmshowers.org/${/^[0-9]+$/.test(identifier) ? 'user' : 'users'}/${encoded}`;
    case 'servas': {
      const path = normaliseIdentifier(network, identifier);
      if (
        !/^(?:household|address)\/[^\s?#\\/]+$/.test(path) ||
        path.split('/').some(segment => segment === '.' || segment === '..')
      ) {
        return null;
      }
      return `https://servas.org/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`;
    }
    case 'nostr':
      return `https://nos.trustroots.org/v0/#profile/${encoded}`;
    case 'facebook':
      return `https://www.facebook.com/${encoded}`;
    case 'twitter':
      return `https://x.com/${encoded}`;
    case 'github':
      return `https://github.com/${encoded}`;
  }
}

/** Extract a complete identifier from a supported profile URL or return input. */
export function parseConnectionSearch(
  network: Network,
  input: string,
): string | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return normaliseIdentifier(network, value);

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) {
      return null;
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!profileHosts[network].includes(host)) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    let candidate = '';
    switch (network) {
      case 'couchers':
        candidate =
          segments[0] === 'user' && segments.length === 2
            ? segments[1] || ''
            : '';
        break;
      case 'bewelcome':
        candidate =
          segments[0] === 'members' && segments.length === 2
            ? segments[1] || ''
            : '';
        break;
      case 'couchsurfing':
        candidate =
          segments[0] === 'people' && segments.length === 2
            ? segments[1] || ''
            : '';
        break;
      case 'warmshowers':
        candidate =
          (segments[0] === 'user' || segments[0] === 'users') &&
          segments.length === 2
            ? segments[1] || ''
            : '';
        break;
      case 'servas':
        candidate =
          /^(?:household|address)$/.test(segments[0] || '') &&
          segments.length === 2 &&
          segments[1] !== '.' &&
          segments[1] !== '..'
            ? segments.join('/')
            : '';
        break;
      case 'facebook':
        if (segments.length === 1 && segments[0] === 'profile.php') {
          candidate = url.searchParams.get('id') || '';
          break;
        }
        candidate = segments.length === 1 ? segments[0] || '' : '';
        break;
      case 'twitter':
      case 'github':
        candidate = segments.length === 1 ? segments[0] || '' : '';
        break;
      case 'nostr': {
        if (host === 'njump.me' && segments.length === 1) {
          candidate = segments[0] || '';
          break;
        }
        if (url.pathname !== '/v0/' && url.pathname !== '/v0') break;
        const profileMatch = /^#profile\/(.+)$/.exec(url.hash);
        candidate = profileMatch?.[1] || '';
        break;
      }
    }
    if (!candidate) return null;
    const decoded = decodeURIComponent(candidate);
    if (
      network === 'servas' &&
      !/^(?:household|address)\/[^\s?#\\/]+$/.test(decoded)
    ) {
      return null;
    }
    return normaliseIdentifier(network, decoded);
  } catch {
    return null;
  }
}
