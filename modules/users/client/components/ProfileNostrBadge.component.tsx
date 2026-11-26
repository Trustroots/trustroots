import React, { useEffect, useState } from 'react';
import { Badge } from '@trustroots/ui/Badge';
import { nostrService } from '@/modules/core/client/services/nostr.client.service';
import { compactTimeAgo } from '@trustroots/relative-time/compact';
import NostrootsActionModal from '@/modules/core/client/components/NostrootsActionModal.component';

export default function ProfileNostrBadge({
  npubHex = null,
}: {
  npubHex?: string | null;
}) {
  const [notes, setNotes] = useState<
    Awaited<ReturnType<typeof nostrService.fetchUserNotes>>
  >([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!npubHex) return;

    let cancelled = false;

    nostrService
      .fetchUserNotes(npubHex)
      .then(fetchedNotes => {
        if (!cancelled) {
          setNotes(fetchedNotes);
        }
      })
      .catch(() => {
        // silently ignore fetch errors
      });

    return () => {
      cancelled = true;
    };
  }, [npubHex]);

  if (notes.length === 0) return null;

  return (
    <div>
      <Badge
        variant="solid"
        intent="primary"
        size="sm"
        className="tw:rounded-full"
      >
        Nostroots
      </Badge>

      <div className="profile-nostr-notes">
        <h4 className="profile-nostr-notes-title">Recent community notes</h4>
        {notes.map(note => (
          <div key={note.id} className="profile-nostr-note">
            <p className="profile-nostr-note-content">{note.content}</p>
            <small className="profile-nostr-note-meta text-muted">
              {compactTimeAgo(note.created_at)}
            </small>
          </div>
        ))}
        <button
          type="button"
          className="profile-nostr-notes-more"
          onClick={() => setModalOpen(true)}
        >
          See all notes on Nostroots &rarr;
        </button>
      </div>

      <NostrootsActionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
