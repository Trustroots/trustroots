import type { RequestHandler } from 'express';
import { nip19, verifyEvent, type Event } from 'nostr-tools';
import type { FeaturedNostrNote } from '../../shared/featured-nostr-notes.mts';
import FeaturedNote, {
  type FeaturedNostrNoteRecord,
} from '../models/featured-nostr-note.server.model.mts';
import { findPublicNip05Usernames } from '../services/nostr-identity.server.service.mts';

function isEventId(id: unknown) {
  return typeof id === 'string' && /^[0-9a-f]{64}$/.test(id);
}

async function publicNotes(
  notes: FeaturedNostrNoteRecord[],
): Promise<FeaturedNostrNote[]> {
  if (!notes.length) return [];
  const usernames = await findPublicNip05Usernames(
    notes.map(note => note.npub),
  );
  return notes.map(note => ({
    id: note._id,
    npub: note.npub,
    authorUsername: usernames.get(note.npub),
    content: note.content,
    publishedAt: note.publishedAt.toISOString(),
  }));
}

export const listFeaturedNotes: RequestHandler = async (_req, res) => {
  const notes = await FeaturedNote.find({ featuredAt: { $ne: null } })
    .sort({ featuredAt: -1, _id: 1 })
    .lean();
  res.set('Cache-Control', 'no-store').json(await publicNotes(notes));
};

export const featureNote: RequestHandler = async (req, res) => {
  const event = req.body?.event as Event | undefined;
  if (
    event?.kind !== 1 ||
    !isEventId(event.id) ||
    !Number.isInteger(event.created_at) ||
    event.created_at < 0 ||
    event.created_at > 253402300799 ||
    typeof event.content !== 'string' ||
    !event.content.trim() ||
    Buffer.byteLength(event.content) > 32768 ||
    !verifyEvent(event)
  ) {
    res
      .status(400)
      .json({ message: 'A valid signed Nostr text note is required.' });
    return;
  }

  const id = String(event.id);
  let note = await FeaturedNote.findOneAndUpdate(
    { _id: id },
    {
      $setOnInsert: {
        npub: nip19.npubEncode(event.pubkey),
        content: event.content,
        publishedAt: new Date(event.created_at * 1000),
        featuredAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' },
  )
    .lean()
    .orFail();

  if (!note.featuredAt) {
    const restored = await FeaturedNote.findOneAndUpdate(
      { _id: id, deletionId: { $exists: false } },
      { $set: { content: event.content, featuredAt: new Date() } },
      { returnDocument: 'after' },
    ).lean();
    if (!restored) {
      res
        .status(409)
        .json({ message: 'A deletion request was recorded for this note.' });
      return;
    }
    note = restored;
  }

  const [featured] = await publicNotes([note]);
  res.json(featured);
};

export const removeFeaturedNote: RequestHandler<{ id: string }> = async (
  req,
  res,
) => {
  const id = String(req.params.id);
  if (!isEventId(id)) {
    res.status(400).json({ message: 'A valid Nostr event ID is required.' });
    return;
  }

  await FeaturedNote.updateOne(
    { _id: id, deletionId: { $exists: false } },
    { $set: { content: '', featuredAt: null } },
  );
  res.sendStatus(204);
};

export const recordFeaturedNoteDeletion: RequestHandler<{
  id: string;
}> = async (req, res) => {
  const id = String(req.params.id);
  const event = req.body?.event as Event | undefined;
  if (
    !isEventId(id) ||
    event?.kind !== 5 ||
    !verifyEvent(event) ||
    !event.tags.some(([type, value]) => type === 'e' && value === id)
  ) {
    res.status(400).json({
      message: 'A signed deletion request for this note is required.',
    });
    return;
  }

  const result = await FeaturedNote.updateOne(
    { _id: id, npub: nip19.npubEncode(String(event.pubkey)) },
    { $set: { content: '', featuredAt: null, deletionId: event.id } },
  );
  if (!result.matchedCount) {
    res.status(404).json({
      message: 'No note matches the deletion request and its author.',
    });
    return;
  }

  res.sendStatus(204);
};
