/** @jest-environment node */
import { catalogue } from '../server/catalogue.mts';
import { generate, translate } from '../server/generate.mts';
import { Store } from '../server/store.mts';
import { schedule } from '../server/scheduler.mts';
import { snapshot } from './fixtures.ts';
import type { Entry, Language } from '../shared.ts';
import type { AIConfig } from '../server/generate.mts';

const config = { apiKey: 'fictional-key', model: 'test-model' };
const language = { code: 'de', label: 'Deutsch', english: 'German' };
const successful = (translations: unknown) => ({
  status: 'completed',
  output: [
    {
      content: [
        { type: 'output_text', text: JSON.stringify({ translations }) },
      ],
    },
  ],
});
const fetcher = (body: unknown, status = 200) =>
  jest.fn(
    async () => new Response(JSON.stringify(body), { status }),
  ) as unknown as typeof fetch;
const copySource = (_config: AIConfig, _language: Language, entries: Entry[]) =>
  Promise.resolve(entries.map(entry => ({ entry, value: entry.source })));

describe('AI drafts and human feedback', () => {
  it('prioritises current, merged language corrections from the same section', async () => {
    const current = catalogue('de', snapshot());
    const entry = current.entries[0];
    const hello = current.entries.find(item => item.key === 'Hello')!;
    const bye = current.entries.find(item => item.key === 'Bye')!;
    const reviews = {
      [hello.id]: {
        sourceHash: hello.sourceHash,
        value: hello.original!,
        previous: 'Old wording',
        reviewer: 'fictional',
        reviewedAt: '2026-01-02',
      },
      [bye.id]: {
        sourceHash: bye.sourceHash,
        value: bye.original!,
        previous: null,
        reviewer: 'fictional',
        reviewedAt: '2026-01-01',
      },
      stale: {
        sourceHash: 'stale',
        value: 'Wrong',
        previous: null,
        reviewer: 'fictional',
        reviewedAt: '2026-01-03',
      },
    };
    const other = { ...hello, id: 'pages:Hello', namespace: 'pages' };
    const newer = { ...hello, id: 'users:Newer', key: 'Newer' };
    Object.assign(reviews, {
      [other.id]: { ...reviews[hello.id], reviewedAt: '2026-01-04' },
      [newer.id]: { ...reviews[hello.id], reviewedAt: '2026-01-03' },
    });
    const stale = { ...hello, id: 'stale' };
    const mismatched = { ...hello, id: 'mismatched' };
    Object.assign(reviews, {
      [mismatched.id]: { ...reviews[hello.id], value: 'Changed externally' },
    });
    const mock = fetcher(
      successful([{ id: entry.id, value: 'Willkommen {{name}}' }]),
    );
    expect(
      await translate(
        config,
        language,
        [entry],
        [...current.entries, other, newer, stale, mismatched],
        reviews,
        mock,
      ),
    ).toEqual([{ entry, value: 'Willkommen {{name}}' }]);
    const body = JSON.parse((mock as jest.Mock).mock.calls[0][1].body);
    expect(body.store).toBe(false);
    expect(body.model).toBe('test-model');
    const prompt = JSON.parse(body.input);
    expect(
      prompt.humanApprovedCorrections.map(
        (item: { section: string; english: string }) => [
          item.section,
          item.english,
        ],
      ),
    ).toEqual([
      ['users', 'Hello'],
      ['users', 'Hello'],
      ['users', 'Bye'],
      ['pages', 'Hello'],
    ]);
    expect(prompt.humanApprovedCorrections[0]).toMatchObject({
      previous: 'Old wording',
      preferred: 'Hallo',
    });
    expect(prompt.strings).toEqual([
      expect.objectContaining({ id: entry.id, section: 'users' }),
    ]);
  });

  it('rejects incomplete, duplicate, unknown or invalid model output', async () => {
    const entries = catalogue('de', snapshot()).entries.slice(0, 2);
    const cases: [unknown, number, string][] = [
      [{}, 500, 'failed'],
      [{ status: 'incomplete' }, 200, 'complete'],
      [successful([]), 200, 'incomplete'],
      [successful(null), 200, 'incomplete'],
      [
        successful([
          { id: entries[0].id, value: 'x' },
          { id: entries[0].id, value: 'y' },
        ]),
        200,
        'duplicate',
      ],
      [
        successful([
          { id: entries[0].id, value: 'No token' },
          { id: entries[1].id, value: 'Hallo' },
        ]),
        200,
        'formatting',
      ],
      [
        successful([
          { id: 'unknown', value: 'x' },
          { id: entries[1].id, value: 'Hallo' },
        ]),
        200,
        'formatting',
      ],
    ];
    for (const [body, status, error] of cases)
      await expect(
        translate(config, language, entries, [], {}, fetcher(body, status)),
      ).rejects.toThrow(error);
    await expect(
      translate(
        config,
        language,
        entries,
        [],
        {},
        fetcher({
          status: 'completed',
          output: [{}, { content: [{ type: 'refusal' }] }],
        }),
      ),
    ).rejects.toThrow();
  });

  it('uses the configured provider without making live calls in tests', async () => {
    const entry = catalogue('de', snapshot()).entries[0];
    const mock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        fetcher(successful([{ id: entry.id, value: 'Hallo {{name}}' }])),
      );
    await translate(config, language, [entry], [], {});
    expect(mock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({ method: 'POST' }),
    );
    mock.mockRestore();
  });

  it('bounds generation, skips cached and human translations, and passes accepted feedback', async () => {
    const state = snapshot();
    const repository = {
      languages: async () => state.languages,
      load: jest.fn(async () => structuredClone(state)),
    };
    const store = new Store(':memory:');
    const translator = jest.fn(copySource);
    expect(await generate(repository, store, config, 1, translator)).toBe(1);
    expect(
      await generate(repository, store, config, 100, translator),
    ).toBeGreaterThan(0);
    expect(await generate(repository, store, config)).toBe(0);
    expect(
      store
        .withDrafts(catalogue('de', state))
        .entries.find(entry => entry.key === 'Hello')?.suggestion,
    ).toBeUndefined();
    for (const limit of [0, 1001, 1.2])
      await expect(
        generate(repository, store, config, limit, translator),
      ).rejects.toThrow('limit');
    store.close();
  });

  it('splits larger jobs into small requests and resumes after failed generation', async () => {
    const state = snapshot();
    state.source = {
      users: Object.fromEntries(
        Array.from({ length: 23 }, (_, index) => [
          'Hello ' + index,
          'Hello ' + index,
        ]),
      ),
    };
    const repository = {
      languages: async () => [language],
      load: async () => state,
    };
    const store = new Store(':memory:');
    const translator = jest.fn(copySource);
    translator.mockRejectedValueOnce(new Error('provider offline'));
    await expect(
      generate(repository, store, config, 100, translator),
    ).rejects.toThrow('offline');
    expect(await generate(repository, store, config, 100, translator)).toBe(23);
    expect(translator.mock.calls.slice(1).map(call => call[2].length)).toEqual([
      20, 3,
    ]);
    const entry = catalogue('de', state).entries[0];
    const mock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        fetcher(successful([{ id: entry.id, value: entry.source }])),
      );
    const fresh = new Store(':memory:');
    expect(await generate(repository, fresh, config, 1)).toBe(1);
    mock.mockRestore();
    fresh.close();
    store.close();
  });
});

describe('generation scheduling', () => {
  afterEach(() => jest.useRealTimers());
  it('runs immediately, retries failures later and stops cleanly', async () => {
    jest.useFakeTimers();
    const error = jest.fn();
    const run = jest.fn(async () => {});
    run.mockRejectedValueOnce(new Error('offline'));
    const stop = schedule(run, error, 1000);
    await jest.advanceTimersByTimeAsync(0);
    expect(error).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
    await jest.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(2);
  });
  it('does not reschedule a run stopped while in flight', async () => {
    jest.useFakeTimers();
    let finish: () => void = () => {};
    const stop = schedule(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
      jest.fn(),
      1000,
    );
    stop();
    finish();
    await jest.advanceTimersByTimeAsync(0);
    expect(jest.getTimerCount()).toBe(0);
  });
});
