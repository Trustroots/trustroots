export interface FeaturedNostrNote {
  id: string;
  npub: string;
  content: string;
  publishedAt: string;
}

export const FEATURED_NOTE_PUBLISH_RELAY = 'wss://relay.trustroots.org';

export const FEATURED_NOTE_RELAYS = [
  FEATURED_NOTE_PUBLISH_RELAY,
  'wss://relay.damus.io',
  'wss://relay.primal.net',
];
