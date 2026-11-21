import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { nip19, verifyEvent, type Event } from 'nostr-tools';
import {
  FEATURED_ARTICLE_KIND,
  type FeaturedNostrNote,
} from '../../shared/featured-nostr-notes.mts';
import FeaturedNote, {
  type FeaturedNostrNoteRecord,
} from '../models/featured-nostr-note.server.model.mts';
import { findPublicNip05Usernames } from '../services/nostr-identity.server.service.mts';

function isEventId(id: string) {
  return /^[0-9a-f]{64}$/.test(id);
}

function articleId(address: string) {
  return createHash('sha256').update(address).digest('hex');
}

function validNote(event: Event) {
  return (
    Number.isInteger(event.created_at) &&
    event.created_at >= 0 &&
    event.created_at <= 253402300799 &&
    typeof event.content === 'string' &&
    !!event.content.trim() &&
    Buffer.byteLength(event.content) <= 32768 &&
    verifyEvent(event)
  );
}

function readArticle(event: Event) {
  const identifiers = event.tags.filter(([name]) => name === 'd');
  const identifier = identifiers[0]?.[1];
  const published = event.tags.find(([name]) => name === 'published_at')?.[1];
  const firstPublishedAt =
    published === undefined ? event.created_at : Number(published);
  if (
    identifiers.length !== 1 ||
    !identifier ||
    Buffer.byteLength(identifier) > 512 ||
    (published !== undefined && !/^\d+$/.test(published)) ||
    firstPublishedAt > event.created_at
  )
    return null;
  return {
    identifier,
    address: `${FEATURED_ARTICLE_KIND}:${event.pubkey}:${identifier}`,
    revisionId: event.id,
    revisionAt: event.created_at,
    publishedAt: new Date(firstPublishedAt * 1000),
  };
}

function outranks(event: Event, note: FeaturedNostrNoteRecord) {
  return (
    note.revisionAt === undefined ||
    event.created_at > note.revisionAt ||
    (event.created_at === note.revisionAt && event.id < note.revisionId!)
  );
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
    // Article metadata is written together on each publication.
    ...(note.address
      ? {
          article: {
            identifier: note.address.split(':').slice(2).join(':'),
            eventId: note.revisionId!,
            createdAt: note.revisionAt!,
          },
        }
      : {}),
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
    (event?.kind !== 1 && event?.kind !== FEATURED_ARTICLE_KIND) ||
    !validNote(event)
  ) {
    res
      .status(400)
      .json({ message: 'A valid signed Nostr text note is required.' });
    return;
  }

  if (event.kind === FEATURED_ARTICLE_KIND) {
    const decoded = readArticle(event);
    if (!decoded) {
      res.status(400).json({
        message:
          'A signed update needs a valid article address and publication date.',
      });
      return;
    }

    const { identifier, ...article } = decoded;
    const npub = nip19.npubEncode(String(event.pubkey));
    // A converted short note uses its original event ID as the identifier.
    // Attach a manually featured revision to that same row when it exists.
    const legacy = isEventId(identifier)
      ? await FeaturedNote.findOne({
          _id: String(identifier),
          npub,
          publishedAt: new Date(Number(article.publishedAt)),
          $or: [
            { address: String(article.address) },
            { address: { $exists: false } },
          ],
        }).lean()
      : null;
    const initial =
      legacy ??
      (await FeaturedNote.findOneAndUpdate(
        { _id: articleId(String(article.address)) },
        {
          $setOnInsert: {
            ...article,
            npub,
            content: event.content,
            featuredAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
        .lean()
        .orFail());
    if (initial.deletionId) {
      res
        .status(409)
        .json({ message: 'A deletion request was recorded for this note.' });
      return;
    }
    let current = initial;
    if (
      outranks(event, initial) ||
      (!initial.featuredAt && event.id === initial.revisionId)
    ) {
      const updated = await FeaturedNote.findOneAndUpdate(
        {
          _id: String(initial._id),
          revisionId:
            initial.revisionId === undefined
              ? { $exists: false }
              : String(initial.revisionId),
          featuredAt:
            initial.featuredAt === null
              ? null
              : new Date(Number(initial.featuredAt)),
          deletionId: { $exists: false },
        },
        {
          $set: {
            content: event.content,
            address: article.address,
            revisionId: article.revisionId,
            revisionAt: article.revisionAt,
            featuredAt: initial.featuredAt ?? new Date(),
          },
        },
        { returnDocument: 'after' },
      ).lean();
      if (!updated) {
        res.status(409).json({
          message: 'This update changed. Reload the page and try again.',
        });
        return;
      }
      current = updated;
    }
    if (!current.featuredAt) {
      res.status(409).json({
        message: 'Find the current revision to feature this update again.',
      });
      return;
    }
    const [featured] = await publicNotes([current]);
    res.json(featured);
    return;
  }

  const id = String(event.id);
  const publishedAt = new Date(Number(event.created_at) * 1000);
  const address = `${FEATURED_ARTICLE_KIND}:${event.pubkey}:${id}`;
  const existingArticle = await FeaturedNote.findOne({
    _id: articleId(String(address)),
    publishedAt,
  }).lean();
  if (existingArticle) {
    if (existingArticle.featuredAt) {
      const [featured] = await publicNotes([existingArticle]);
      res.json(featured);
    } else {
      res.status(409).json({
        message: 'Feature the current article to restore this updated note.',
      });
    }
    return;
  }
  let note = await FeaturedNote.findOneAndUpdate(
    { _id: id },
    {
      $setOnInsert: {
        npub: nip19.npubEncode(event.pubkey),
        content: event.content,
        publishedAt,
        featuredAt: new Date(),
      },
    },
    { upsert: true, returnDocument: 'after' },
  )
    .lean()
    .orFail();

  if (!note.featuredAt) {
    if (note.address && !note.deletionId) {
      res.status(409).json({
        message: 'Feature the current article to restore this updated note.',
      });
      return;
    }
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

export const reviseFeaturedNote: RequestHandler<{ id: string }> = async (
  req,
  res,
) => {
  const { id } = req.params;
  const event = req.body?.event as Event | undefined;
  if (
    !isEventId(id) ||
    event?.kind !== FEATURED_ARTICLE_KIND ||
    !validNote(event)
  ) {
    res
      .status(400)
      .json({ message: 'A valid signed Nostr article revision is required.' });
    return;
  }

  const article = readArticle(event);
  const npub = nip19.npubEncode(String(event.pubkey));
  const noteId = String(id);
  const note = await FeaturedNote.findOne({
    _id: noteId,
    featuredAt: { $ne: null },
    npub,
  }).lean();
  if (!note) {
    res.status(404).json({
      message: 'No featured note matches this update and its author.',
    });
    return;
  }
  if (
    !article ||
    article.address !==
      (note.address ?? `${FEATURED_ARTICLE_KIND}:${event.pubkey}:${id}`) ||
    article.publishedAt.getTime() !== note.publishedAt.getTime()
  ) {
    res.status(400).json({
      message:
        'The revision must keep the original article address and publication date.',
    });
    return;
  }
  if (note.revisionId === event.id) {
    const [featured] = await publicNotes([note]);
    res.json(featured);
    return;
  }
  if (!outranks(event, note)) {
    res
      .status(409)
      .json({ message: 'This update already has a newer revision.' });
    return;
  }
  const updated = await FeaturedNote.findOneAndUpdate(
    {
      _id: noteId,
      featuredAt: { $ne: null },
      revisionId: note.revisionId ?? { $exists: false },
    },
    {
      $set: {
        address: article.address,
        revisionId: article.revisionId,
        revisionAt: article.revisionAt,
        content: event.content,
      },
    },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) {
    res
      .status(409)
      .json({ message: 'This update changed. Reload the page and try again.' });
    return;
  }
  const [featured] = await publicNotes([updated]);
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
  if (!isEventId(id) || event?.kind !== 5 || !verifyEvent(event)) {
    res.status(400).json({
      message: 'A signed deletion request for this note is required.',
    });
    return;
  }

  const npub = nip19.npubEncode(String(event.pubkey));
  const note = await FeaturedNote.findById(id).lean();
  const targetsNote = note?.address
    ? event.tags.some(
        ([type, value]) => type === 'a' && value === note.address,
      ) && event.created_at >= note.revisionAt!
    : event.tags.some(([type, value]) => type === 'e' && value === id);
  if (!targetsNote) {
    res.status(400).json({
      message: 'A signed deletion request for this note is required.',
    });
    return;
  }
  const result = await FeaturedNote.updateOne(
    { _id: id, npub, revisionId: note?.revisionId ?? { $exists: false } },
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
