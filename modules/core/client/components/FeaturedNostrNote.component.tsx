import React from 'react';
import type { FeaturedNostrNote } from '../../shared/featured-nostr-notes.mts';

function webLink(destination: string) {
  const href = destination.replace(/\\([.:])/g, '$1');
  if (!/^https?:\/\//i.test(href)) return;
  try {
    return new URL(href).href;
  } catch {
    return undefined;
  }
}

function renderNoteLinks(content: string) {
  const links = /\[([^[\]\r\n]+)\]\\?\(((?:\\[.:]|[^\s()\\])+)\\?\)/g;
  const parts: React.ReactNode[] = [];
  let end = 0;

  for (const match of content.matchAll(links)) {
    const [syntax, label, destination] = match;
    const href = webLink(destination);
    if (!href || content[match.index - 1] === '!') continue;

    parts.push(
      content.slice(end, match.index),
      <a key={match.index} href={href}>
        {label}
      </a>,
    );
    end = match.index + syntax.length;
  }

  parts.push(content.slice(end));
  return parts;
}

export default function FeaturedNostrNoteContent({
  note,
}: {
  note: FeaturedNostrNote;
}) {
  return (
    <>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {renderNoteLinks(note.content)}
      </p>
      <p className="text-muted" style={{ overflowWrap: 'anywhere' }}>
        <a href={'https://njump.me/' + encodeURIComponent(note.npub)}>
          {note.npub}
        </a>
        {' · '}
        <time dateTime={note.publishedAt}>{note.publishedAt.slice(0, 10)}</time>
      </p>
    </>
  );
}
