import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listFeaturedNostrNotes } from '@/modules/core/client/api/featured-nostr-notes.api';
import FeaturedNostrNoteContent from '@/modules/core/client/components/FeaturedNostrNote.component';
import type { FeaturedNostrNote } from '@/modules/core/shared/featured-nostr-notes.mts';
import type { PageTranslator } from '../types';

export default function HomeFeaturedNostrNotes({
  memberView = false,
}: {
  memberView?: boolean;
}) {
  const { t: rawT } = useTranslation('pages');
  const t = rawT as unknown as PageTranslator;
  const [notes, setNotes] = useState<FeaturedNostrNote[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    listFeaturedNostrNotes(controller.signal).then(setNotes, () => {});
    return () => controller.abort();
  }, []);

  if (!notes.length) return null;

  const content = (
    <>
      <h2 id="home-featured-nostr-notes">{t('Trustroots updates')}</h2>
      {notes.map(note => (
        <article key={note.id} className={memberView ? undefined : 'well'}>
          <FeaturedNostrNoteContent note={note} />
        </article>
      ))}
    </>
  );

  return (
    <section
      className={
        memberView ? 'home-member-updates home-member-panel' : 'home-how'
      }
      aria-labelledby="home-featured-nostr-notes"
    >
      {memberView ? content : <div className="container">{content}</div>}
    </section>
  );
}
