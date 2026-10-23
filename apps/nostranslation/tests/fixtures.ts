import type { Snapshot } from '../server/catalogue.mts';

export function snapshot(): Snapshot {
  return {
    revision: 'a'.repeat(40),
    languages: [
      { code: 'de', english: 'German', label: 'Deutsch' },
      { code: 'ar', english: 'Arabic', label: 'العربية' },
    ],
    source: {
      users: {
        'Welcome {{name}}': 'Welcome {{name}}',
        Hello: 'Hello',
        Bye: 'Bye',
        '{{count}} guests': '{{count}} guest',
        '{{count}} guests_plural': '{{count}} guests',
      },
    },
    target: { users: { Hello: 'Hallo', Bye: 'Tschüss' } },
    reviews: {},
  };
}
