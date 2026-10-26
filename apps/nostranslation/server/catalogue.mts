import { createHash } from 'node:crypto';
import i18next from 'i18next';
import type { Catalogue, Entry, Language } from '../shared.ts';

export type Strings = Record<string, string>;
export interface Review {
  sourceHash: string;
  value: string;
  reviewer: string;
  previous: string | null;
  reviewedAt: string;
}
export interface Snapshot {
  revision: string;
  languages: Language[];
  source: Record<string, Strings>;
  target: Record<string, Strings>;
  reviews: Record<string, Review>;
}

export const digest = (text: string) =>
  createHash('sha256').update(text).digest('hex');

const plurals = i18next.createInstance();
void plurals.init({ fallbackLng: 'en', initAsync: false });
const resolver = plurals.services.pluralResolver;

export function catalogue(locale: string, snapshot: Snapshot): Catalogue {
  if (
    locale === 'en' ||
    !snapshot.languages.some(lang => lang.code === locale)
  ) {
    throw new Error('Unsupported target language.');
  }
  const entries: Entry[] = [];
  const language = locale.replaceAll('_', '-');
  for (const [namespace, strings] of Object.entries(snapshot.source)) {
    for (const [sourceKey, source] of Object.entries(strings)) {
      if (
        sourceKey.endsWith('_other') &&
        Object.hasOwn(strings, sourceKey.slice(0, -6) + '_one')
      ) {
        continue;
      }
      const plural =
        sourceKey.endsWith('_one') &&
        Object.hasOwn(strings, sourceKey.slice(0, -4) + '_other');
      const key = plural ? sourceKey.slice(0, -4) : sourceKey;
      const suffixes = plural ? resolver.getSuffixes(language) : [''];
      for (const suffix of suffixes) {
        const targetKey = key + suffix;
        const english =
          plural && suffix !== '_one' ? strings[key + '_other'] : source;
        const id = namespace + ':' + targetKey;
        const original = snapshot.target[namespace]?.[targetKey] ?? null;
        const sourceHash = digest(
          JSON.stringify([key, source, strings[key + '_other']]),
        );
        const review = snapshot.reviews[id];
        entries.push({
          id,
          namespace,
          key: targetKey,
          source: english,
          sourceHash,
          original,
          needsReview:
            !original || Boolean(review && review.sourceHash !== sourceHash),
          reviewed: Boolean(
            review &&
            review.sourceHash === sourceHash &&
            review.value === original,
          ),
        });
      }
    }
  }
  return { locale, revision: snapshot.revision, entries };
}
