import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listFeaturedNostrNotes } from '@/modules/core/client/api/featured-nostr-notes.api';
import FeaturedNostrNoteContent from '@/modules/core/client/components/FeaturedNostrNote.component';
import type { FeaturedNostrNote } from '@/modules/core/shared/featured-nostr-notes.mts';
import type { PageTranslator } from '../types';

export default function HomeFeaturedNostrNotes() {
  const { t: rawT } = useTranslation('pages');
  const t = rawT as unknown as PageTranslator;
  const [notes, setNotes] = useState<FeaturedNostrNote[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    listFeaturedNostrNotes(controller.signal).then(setNotes, () => {});
    return () => controller.abort();
  }, []);

  if (!notes.length) return null;

  return (
    <section className="home-how" aria-labelledby="home-featured-nostr-notes">
      <div className="container">
        <h2 id="home-featured-nostr-notes">{t('Updates from Nostr')}</h2>
        {notes.map(note => (
          <article key={note.id} className="well">
            <FeaturedNostrNoteContent note={note} />
          </article>
        ))}
      </div>
    </section>
  );
}
