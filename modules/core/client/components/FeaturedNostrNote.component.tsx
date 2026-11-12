import React from 'react';
import { noteEncode } from 'nostr-tools/nip19';
import type { FeaturedNostrNote } from '../../shared/featured-nostr-notes.mts';

export default function FeaturedNostrNoteContent({
  note,
}: {
  note: FeaturedNostrNote;
}) {
  return (
    <>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {note.content}
      </p>
      <p className="text-muted" style={{ overflowWrap: 'anywhere' }}>
        {note.npub}
        {' · '}
        <time dateTime={note.publishedAt}>{note.publishedAt.slice(0, 10)}</time>
        {' · '}
        <a href={`https://njump.me/${noteEncode(note.id)}`}>View on Nostr</a>
      </p>
    </>
  );
}
