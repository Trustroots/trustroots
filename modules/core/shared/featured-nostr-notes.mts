export interface FeaturedNostrNote {
  id: string;
  npub: string;
  authorUsername?: string;
  content: string;
  publishedAt: string;
}

export const FEATURED_NOTE_PUBLISH_RELAYS = [
  'wss://relay.trustroots.org',
  'wss://relay.nomadwiki.org',
];

export const FEATURED_NOTE_RELAYS = [
  ...FEATURED_NOTE_PUBLISH_RELAYS,
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];
