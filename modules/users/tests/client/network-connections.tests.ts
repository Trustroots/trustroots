import {
  connectionUrl,
  normaliseIdentifier,
  parseConnectionSearch,
} from '../../shared/network-connections';

describe('external connection URLs', () => {
  it('uses the correct Warmshowers URL form for numeric IDs and usernames', () => {
    expect(connectionUrl('warmshowers', '12345')).toBe(
      'https://www.warmshowers.org/user/12345',
    );
    expect(connectionUrl('warmshowers', 'Cyclist')).toBe(
      'https://www.warmshowers.org/users/cyclist',
    );
    expect(
      parseConnectionSearch(
        'warmshowers',
        'https://www.warmshowers.org/users/Cyclist',
      ),
    ).toBe('cyclist');
  });

  it('recognises the Nostr profile sites used by Trustroots', () => {
    expect(parseConnectionSearch('nostr', 'https://njump.me/npub1abc')).toBe(
      'npub1abc',
    );
    expect(
      parseConnectionSearch(
        'nostr',
        'https://nos.trustroots.org/v0/#profile/npub1ABC',
      ),
    ).toBe('npub1abc');
    expect(connectionUrl('nostr', 'npub1ABC')).toBe(
      'https://nos.trustroots.org/v0/#profile/npub1abc',
    );
  });

  it('normalises raw Nostr hex keys to the same canonical npub key', () => {
    const rawHex = '0'.repeat(64);
    const canonicalNpub =
      'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';

    expect(normaliseIdentifier('nostr', rawHex)).toBe(canonicalNpub);
    expect(normaliseIdentifier('nostr', canonicalNpub.toUpperCase())).toBe(
      canonicalNpub,
    );
    expect(normaliseIdentifier('nostr', 'legacy-invalid-key')).toBe(
      'legacy-invalid-key',
    );
  });

  it('rejects URLs that could disguise a different origin or profile', () => {
    expect(
      parseConnectionSearch('github', 'https://user@github.com/member'),
    ).toBeNull();
    expect(
      parseConnectionSearch('github', 'https://github.com:444/member'),
    ).toBe(null);
    expect(
      parseConnectionSearch('github', 'https://github.com/member/extra'),
    ).toBeNull();
    expect(
      parseConnectionSearch('servas', 'https://servas.org/other/path'),
    ).toBeNull();
    expect(
      parseConnectionSearch(
        'nostr',
        'https://nos.trustroots.org/other/path/#profile/npub1abc',
      ),
    ).toBeNull();
    expect(connectionUrl('servas', 'household/\\\\evil.example')).toBeNull();
    expect(connectionUrl('servas', 'address/../evil')).toBeNull();
  });
});
