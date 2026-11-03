import fs from 'fs';
import path from 'path';

import locales from '@/config/shared/locales.json';
import {
  ANALYTICS_EVENTS,
  ANALYTICS_LANGUAGES,
  toAnalyticsLanguage,
  type AnalyticsEventArgs,
  type AnalyticsEventName,
  type AnalyticsTracker,
} from '@trustroots/analytics/client';

const names = Object.keys(ANALYTICS_EVENTS) as AnalyticsEventName[];

const docs = fs.readFileSync(
  path.join(__dirname, '../../../../../docs/analytics.md'),
  'utf8',
);

/** Event names listed in the docs' event tables: `| \`name\` | …`. */
const documentedNames = [...docs.matchAll(/^\| `([a-z_]+)` +\|/gm)].map(
  ([, name]) => name,
);

describe('analytics event catalogue', () => {
  it('names every event in snake_case', () => {
    expect(names.length).toBeGreaterThan(30);
    names.forEach(name => expect(name).toMatch(/^[a-z]+(?:_[a-z]+)+$/));
  });

  it('describes when every event fires', () => {
    names.forEach(name =>
      expect(ANALYTICS_EVENTS[name].length).toBeGreaterThan(10),
    );
  });

  it('documents exactly the catalogue in docs/analytics.md', () => {
    expect([...documentedNames].sort()).toEqual([...names].sort());
  });

  it('lists exactly the interface languages and maps others to other', () => {
    expect([...ANALYTICS_LANGUAGES].sort()).toEqual(
      [...new Set(locales.map(({ code }) => code))].sort(),
    );
    expect(toAnalyticsLanguage('pt_BR')).toBe('pt_BR');
    expect(toAnalyticsLanguage('xx')).toBe('other');
  });

  it('types event data so call sites cannot send unknown events or props', () => {
    const tracker: AnalyticsTracker = { track: jest.fn() };

    tracker.track('signin_succeeded');
    tracker.track('offer_saved', { type: 'host', action: 'create' });
    // @ts-expect-error unknown event names are rejected
    tracker.track('signin-success');
    // @ts-expect-error events with data require it
    tracker.track('offer_saved');
    // @ts-expect-error props outside the catalogue are rejected
    tracker.track('message_sent', { kind: 'reply', via: 'editor', text: 'x' });
    tracker.track('message_sent', {
      kind: 'reply',
      via: 'editor',
      // @ts-expect-error only first messages say where reaching out started
      source: 'search',
    });
    // @ts-expect-error languages are a fixed list
    tracker.track('language_switched', { language: 'xx', saved: 'no' });
    // @ts-expect-error failure reasons are a fixed list, never server text
    tracker.track('signin_failed', { reason: 'Unknown user' });

    const noData: AnalyticsEventArgs<'page_not_found'> = [];
    expect(noData).toEqual([]);
    expect(tracker.track).toHaveBeenCalledTimes(8);
  });
});
