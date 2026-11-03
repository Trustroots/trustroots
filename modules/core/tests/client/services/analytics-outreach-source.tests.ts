import {
  readOutreachSource,
  rememberOutreachSource,
} from '@trustroots/analytics/client';

const STORAGE_KEY = 'tr.analytics.outreach';

describe('outreach source', () => {
  beforeEach(() => window.sessionStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('is other until something was remembered for the same member', () => {
    expect(readOutreachSource('ada')).toBe('other');
    expect(readOutreachSource(undefined)).toBe('other');

    rememberOutreachSource('ada', 'profile');

    expect(readOutreachSource('ada')).toBe('profile');
    expect(readOutreachSource('bob')).toBe('other');
  });

  it('keeps the broader start for the same member and replaces it for another', () => {
    rememberOutreachSource('ada', 'search');
    rememberOutreachSource('ada', 'profile');
    rememberOutreachSource('ada', 'offer');
    expect(readOutreachSource('ada')).toBe('search');

    rememberOutreachSource('bob', 'profile');
    rememberOutreachSource('bob', 'offer');
    expect(readOutreachSource('bob')).toBe('offer');
    expect(readOutreachSource('ada')).toBe('other');
  });

  it('ignores a missing username', () => {
    rememberOutreachSource(undefined, 'search');
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('treats unreadable or foreign storage values as unknown', () => {
    window.sessionStorage.setItem(STORAGE_KEY, '{not json');
    expect(readOutreachSource('ada')).toBe('other');

    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ username: 'ada', source: 'email' }),
    );
    expect(readOutreachSource('ada')).toBe('other');

    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ username: 42, source: 'search' }),
    );
    expect(readOutreachSource('ada')).toBe('other');

    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ username: 'ada', source: 3 }),
    );
    expect(readOutreachSource('ada')).toBe('other');
  });

  it('keeps working when storage is blocked', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => rememberOutreachSource('ada', 'search')).not.toThrow();
    expect(readOutreachSource('ada')).toBe('other');
  });
});
