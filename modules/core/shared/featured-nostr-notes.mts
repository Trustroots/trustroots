export interface FeaturedNostrNote {
  id: string;
  npub: string;
  content: string;
  publishedAt: string;
}

export const FEATURED_NOTE_RELAYS = [
  'wss://relay.trustroots.org',
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];
