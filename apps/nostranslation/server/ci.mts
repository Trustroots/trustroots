import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { catalogue } from './catalogue.mts';
import type { Review, Snapshot, Strings } from './catalogue.mts';
import { validateTranslation } from '../shared.ts';

/** Validate changed values only, allowing unrelated legacy issues to be fixed separately. */
export function validateChanged(
  locale: string,
  namespace: string,
  before: Strings,
  after: Strings,
  snapshot: Snapshot,
) {
  const entries = new Map(
    catalogue(locale, snapshot)
      .entries.filter(entry => entry.namespace === namespace)
      .map(entry => [entry.key, entry]),
  );
  return Object.entries(after)
    .filter(
      ([key, value]) => JSON.stringify(before[key]) !== JSON.stringify(value),
    )
    .flatMap(([key, value]) => {
      const entry = entries.get(key);
      // A plural-format migration can rename existing text without editing it.
      // Only recognise removed legacy keys in the same valid plural family.
      const plural = key.match(/^(.*)_(zero|one|two|few|many|other)$/);
      if (
        entry &&
        plural &&
        Object.entries(before).some(
          ([oldKey, oldValue]) =>
            typeof oldValue === 'string' &&
            oldValue === value &&
            !Object.hasOwn(after, oldKey) &&
            (oldKey === plural[1] ||
              oldKey === plural[1] + '_plural' ||
              (/_[0-9]+$/.test(oldKey) &&
                oldKey.replace(/_[0-9]+$/, '') === plural[1])),
        )
      ) {
        return [];
      }
      const error = !entry
        ? 'Unknown translation key or plural form.'
        : typeof value !== 'string'
          ? 'Translation must be text.'
          : validateTranslation(entry.source, value);
      return error ? [`${locale}/${namespace}.json: ${key}: ${error}`] : [];
    });
}

export function validateReviews(
  locale: string,
  reviews: Record<string, Review>,
  snapshot: Snapshot,
) {
  const entries = new Map(
    catalogue(locale, snapshot).entries.map(entry => [entry.id, entry]),
  );
  return Object.entries(reviews).flatMap(([id, review]) => {
    const entry = entries.get(id);
    return !entry ||
      !review ||
      review.sourceHash !== entry.sourceHash ||
      review.value !== entry.original ||
      typeof review.reviewer !== 'string' ||
      !review.reviewer.trim() ||
      typeof review.reviewedAt !== 'string' ||
      !Number.isFinite(Date.parse(review.reviewedAt))
      ? [
          `${locale}: ${id}: Review is stale or incomplete. Proofread the current source and submit again.`,
        ]
      : [];
  });
}

export function checkChanges(base: string) {
  const paths = execFileSync(
    'git',
    [
      'diff',
      '--name-only',
      '--diff-filter=AM',
      `${base}...HEAD`,
      '--',
      'public/locales',
      'apps/nostranslation/reviews',
    ],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n');
  const read = <T,>(path: string): T =>
    JSON.parse(readFileSync(path, 'utf8')) as T;
  const errors: string[] = [];
  for (const path of paths) {
    const match =
      /^public\/locales\/([A-Za-z_-]+)\/([A-Za-z0-9-]+)\.json$/.exec(path);
    if (!match || match[1] === 'en') continue;
    const [, locale, namespace] = match;
    const after = read<Strings>(path);
    let before: Strings = {};
    const present = execFileSync('git', ['ls-tree', base, '--', path], {
      encoding: 'utf8',
    }).trim();
    if (present)
      before = JSON.parse(
        execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' }),
      ) as Strings;
    const snapshot: Snapshot = {
      revision: base,
      // Legacy Weblate locales may exist before being enabled in app settings.
      languages: [{ code: locale, label: locale, english: locale }],
      source: { [namespace]: read(`public/locales/en/${namespace}.json`) },
      target: { [namespace]: after },
      reviews: {},
    };
    errors.push(...validateChanged(locale, namespace, before, after, snapshot));
  }
  for (const path of paths) {
    const match = /^apps\/nostranslation\/reviews\/([A-Za-z_-]+)\.json$/.exec(
      path,
    );
    if (!match) continue;
    const locale = match[1];
    const after = read<Record<string, Review>>(path);
    let before: Record<string, Review> = {};
    if (
      execFileSync('git', ['ls-tree', base, '--', path], {
        encoding: 'utf8',
      }).trim()
    ) {
      before = JSON.parse(
        execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' }),
      ) as Record<string, Review>;
    }
    const changed = Object.fromEntries(
      Object.entries(after).filter(
        ([id, review]) => JSON.stringify(before[id]) !== JSON.stringify(review),
      ),
    );
    const snapshot: Snapshot = {
      revision: base,
      languages: read('config/shared/locales.json'),
      source: {},
      target: {},
      reviews: {},
    };
    for (const namespace of new Set(
      Object.keys(changed).map(id => id.split(':')[0]),
    )) {
      if (!/^[A-Za-z0-9-]+$/.test(namespace))
        throw new Error('Invalid review namespace.');
      snapshot.source[namespace] = read(`public/locales/en/${namespace}.json`);
      snapshot.target[namespace] = read(
        `public/locales/${locale}/${namespace}.json`,
      );
    }
    errors.push(...validateReviews(locale, changed, snapshot));
  }
  return errors;
}
