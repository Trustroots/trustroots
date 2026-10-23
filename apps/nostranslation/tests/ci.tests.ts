/** @jest-environment node */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { checkChanges, validateReviews } from '../server/ci.mts';
import { catalogue } from '../server/catalogue.mts';
import { snapshot } from './fixtures.ts';
import type { Review } from '../server/catalogue.mts';

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }));
jest.mock('node:fs', () => ({ readFileSync: jest.fn() }));

describe('changed-translation CI validation', () => {
  it('rejects stale review metadata on the merged PR revision, including changed target values', () => {
    const state = snapshot();
    const entry = catalogue('de', state).entries.find(
      item => item.key === 'Hello',
    )!;
    const review = {
      sourceHash: entry.sourceHash,
      value: 'Hallo',
      reviewer: 'fictional',
      previous: null,
      reviewedAt: '2026-01-01',
    };
    expect(validateReviews('de', { [entry.id]: review }, state)).toEqual([]);
    const variants = [
      null,
      { ...review, sourceHash: 'stale' },
      { ...review, value: 'Stale wording' },
      { ...review, reviewer: undefined },
      { ...review, reviewer: '' },
      { ...review, reviewedAt: undefined },
      { ...review, reviewedAt: 'invalid' },
    ];
    for (const invalid of variants)
      expect(
        validateReviews(
          'de',
          { [entry.id]: invalid as unknown as Review },
          state,
        ),
      ).toHaveLength(1);
    expect(validateReviews('de', { 'unknown:id': review }, state)).toHaveLength(
      1,
    );
    state.source.users.Hello = 'Hello again';
    expect(validateReviews('de', { [entry.id]: review }, state)).toHaveLength(
      1,
    );
  });

  it('checks only added or updated review records and rejects invalid namespace paths', () => {
    const state = snapshot();
    const entry = catalogue('de', state).entries.find(
      item => item.key === 'Hello',
    )!;
    const review = {
      sourceHash: entry.sourceHash,
      value: 'Hallo',
      reviewer: 'fictional',
      previous: null,
      reviewedAt: '2026-01-01',
    };
    let records = { [entry.id]: review, 'legacy:entry': review };
    let existed = true;
    jest.mocked(execFileSync).mockImplementation((_file, args) => {
      if (args?.[0] === 'diff') return 'apps/nostranslation/reviews/de.json';
      if (args?.[0] === 'ls-tree') return existed ? '100644 blob hash' : '';
      return JSON.stringify({ 'legacy:entry': review });
    });
    jest.mocked(readFileSync).mockImplementation(path => {
      if (path === 'config/shared/locales.json')
        return JSON.stringify(state.languages);
      if (path === 'apps/nostranslation/reviews/de.json')
        return JSON.stringify(records);
      if (String(path).includes('/en/'))
        return JSON.stringify(state.source.users);
      return JSON.stringify(state.target.users);
    });
    expect(checkChanges('base-revision')).toEqual([]);
    existed = false;
    records = { [entry.id]: review } as typeof records;
    expect(checkChanges('base-revision')).toEqual([]);
    records = { '../escape:key': review } as unknown as typeof records;
    expect(() => checkChanges('base-revision')).toThrow(
      'Invalid review namespace',
    );
  });
  it('validates changed locale values against English and ignores unrelated paths', () => {
    jest.mocked(execFileSync).mockImplementation((_file, args) => {
      if (args?.[0] === 'diff')
        return 'public/locales/de/users.json\npublic/locales/en/users.json\npublic/locales/de/pages.json\nother/path\n';
      if (args?.[0] === 'ls-tree')
        return args.includes('public/locales/de/users.json')
          ? '100644 blob sha\tpublic/locales/de/users.json'
          : '';
      return JSON.stringify({ Hello: 'Hallo', 'Welcome {{name}}': '' });
    });
    jest.mocked(readFileSync).mockImplementation(path => {
      if (path === 'config/shared/locales.json')
        return JSON.stringify([
          { code: 'de', label: 'Deutsch', english: 'German' },
        ]);
      if (String(path).startsWith('public/locales/en/'))
        return JSON.stringify({
          Hello: 'Hello',
          'Welcome {{name}}': 'Welcome {{name}}',
        });
      return JSON.stringify({
        Hello: 'Hallo',
        'Welcome {{name}}': 'Missing token',
      });
    });
    expect(checkChanges('base-revision')).toHaveLength(2);
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['base-revision...HEAD']),
      expect.anything(),
    );
  });
});
