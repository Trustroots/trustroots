import http from './http-client';
import type { FeaturedNostrNote } from '../../shared/featured-nostr-notes.mts';

export async function listFeaturedNostrNotes(signal?: AbortSignal) {
  const { data } = await http.get<FeaturedNostrNote[]>(
    '/api/nostr/featured-notes',
    { signal },
  );
  return data;
}
