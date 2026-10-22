import { verifyEvent } from 'nostr-tools';
import { z } from 'zod';
import { catalogue, digest } from './catalogue.mts';
import type { Snapshot } from './catalogue.mts';
import { validateTranslation } from '../shared.ts';
import type { Submission } from '../shared.ts';
import type { Repository } from './github.mts';
import type { Store } from './store.mts';

export class Problem extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const submission = z
  .object({
    username: z.string().regex(/^[a-z0-9_.-]{1,64}$/),
    locale: z.string().regex(/^[A-Za-z_-]{2,24}$/),
    changes: z
      .array(
        z
          .object({
            id: z.string().min(1).max(2000),
            sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
            original: z.string().nullable(),
            value: z.string().min(1).max(10000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export function parseSubmission(value: unknown): Submission {
  const result = submission.safeParse(value);
  if (!result.success)
    throw new Problem(400, 'Invalid review batch (maximum 100 strings).');
  return result.data;
}

export function authenticate(
  header: string | undefined,
  body: string,
  url: string,
  now: number,
): { id: string; pubkey: string } {
  try {
    if (!header?.startsWith('Nostr ')) throw new Error();
    const event = JSON.parse(
      Buffer.from(header.slice(6), 'base64').toString('utf8'),
    );
    const tag = (name: string) => {
      const tags = event.tags.filter((item: string[]) => item[0] === name);
      return tags.length === 1 && tags[0].length === 2 ? tags[0][1] : undefined;
    };
    if (
      !verifyEvent(event) ||
      event.kind !== 27235 ||
      event.content !== '' ||
      Math.abs(event.created_at - now) > 60 ||
      tag('u') !== url ||
      tag('method') !== 'POST' ||
      tag('payload') !== digest(body)
    )
      throw new Error();
    return { id: event.id, pubkey: event.pubkey };
  } catch {
    throw new Problem(401, 'Please sign this submission again.');
  }
}

export async function verifyIdentity(
  username: string,
  pubkey: string,
  fetcher = fetch,
) {
  const response = await fetcher(
    `https://trustroots.org/.well-known/nostr.json?name=${encodeURIComponent(username)}`,
    {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new Problem(
      503,
      'Trustroots identity lookup is unavailable. Please retry.',
    );
  const data = (await response.json()) as { names?: Record<string, string> };
  if (data.names?.[username]?.toLowerCase() !== pubkey) {
    throw new Problem(
      403,
      'Link this Nostr key to an eligible public Trustroots profile before submitting.',
    );
  }
}

export function reviewedFiles(
  batch: Submission,
  snapshot: Snapshot,
  identity: string,
  now: number,
) {
  const current = new Map(
    catalogue(batch.locale, snapshot).entries.map(entry => [entry.id, entry]),
  );
  if (
    new Set(batch.changes.map(change => change.id)).size !==
    batch.changes.length
  ) {
    throw new Problem(400, 'Each string may appear only once.');
  }
  const changed = new Set<string>();
  for (const change of batch.changes) {
    const entry = current.get(change.id);
    if (
      !entry ||
      entry.sourceHash !== change.sourceHash ||
      entry.original !== change.original
    ) {
      throw new Problem(
        409,
        'English or published translations changed. Reload and review the affected strings again.',
      );
    }
    const error = validateTranslation(entry.source, change.value);
    if (error) throw new Problem(400, error);
    const strings = snapshot.target[entry.namespace] ?? {};
    snapshot.target[entry.namespace] = {
      ...strings,
      [entry.key]: change.value,
    };
    snapshot.reviews[entry.id] = {
      sourceHash: entry.sourceHash,
      value: change.value,
      reviewer: identity,
      previous: entry.original,
      reviewedAt: new Date(now * 1000).toISOString(),
    };
    changed.add(entry.namespace);
  }
  const json = (data: object) => JSON.stringify(data, null, 2) + '\n';
  return [
    ...[...changed].map(namespace => ({
      path: `public/locales/${batch.locale}/${namespace}.json`,
      content: json(snapshot.target[namespace]),
    })),
    {
      path: `apps/nostranslation/reviews/${batch.locale}.json`,
      content: json(snapshot.reviews),
    },
  ];
}

export class ReviewService {
  private active = new Set<string>();
  private repository: Pick<Repository, 'load' | 'publish' | 'existingPR'>;
  private store: Store;
  private identity: typeof verifyIdentity;
  constructor(
    repository: Pick<Repository, 'load' | 'publish' | 'existingPR'>,
    store: Store,
    identity = verifyIdentity,
  ) {
    this.repository = repository;
    this.store = store;
    this.identity = identity;
  }

  async submit(batch: Submission, pubkey: string, now: number) {
    await this.identity(batch.username, pubkey);
    const id = digest(JSON.stringify([pubkey, batch]));
    const previous = this.store.batch(id);
    if (previous?.url) return String(previous.url);
    if (this.active.has(id))
      throw new Problem(
        409,
        'This batch is being submitted. Please retry shortly.',
      );
    this.active.add(id);
    try {
      if (!this.store.reserve(id, pubkey, now))
        throw new Problem(
          429,
          'Submission limit reached. Please try again in an hour.',
        );
      const branch = `codex/translation-${id}`;
      const recovered = await this.repository.existingPR(branch);
      const snapshot = recovered
        ? undefined
        : await this.repository.load(batch.locale);
      const url =
        recovered ??
        (await this.repository.publish(
          branch,
          snapshot!.revision,
          reviewedFiles(
            batch,
            snapshot!,
            `${batch.username}@trustroots.org (${pubkey})`,
            now,
          ),
          `${batch.username}@trustroots.org`,
        ));
      this.store.complete(id, url);
      return url;
    } finally {
      this.active.delete(id);
    }
  }
}
