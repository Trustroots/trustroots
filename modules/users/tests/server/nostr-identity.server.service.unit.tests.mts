import assert from 'node:assert/strict';
import mockModule from '../../../../testutils/server/mock-module.mts';

describe('Users Nostr identity lookups', () => {
  it('looks up unique npubs and projects eligible members', async () => {
    const members = [
      { nostrNpub: 'npub-fictional-one', username: 'fictionalone' },
      { nostrNpub: 'npub-fictional-two', username: 'fictionaltwo' },
    ];
    const npubs = members.map(member => member.nostrNpub);
    const mongoose = {
      model(name: string) {
        assert.equal(name, 'User');
        return {
          find(query: unknown) {
            assert.deepEqual(query, {
              public: true,
              email: { $exists: true, $nin: ['', null] },
              roles: { $nin: ['suspended', 'shadowban'] },
              nostrNpub: { $in: npubs },
            });
            return {
              select(projection: string) {
                assert.equal(projection, 'nostrNpub username');
                return { lean: async () => members };
              },
            };
          },
        };
      },
    };
    const { findPublicNip05Usernames } = await mockModule<
      typeof import('../../server/services/nostr-identity.server.service.mts')
    >(
      new URL(
        '../../server/services/nostr-identity.server.service.mts',
        import.meta.url,
      ),
      { mongoose },
    );

    assert.deepEqual(
      await findPublicNip05Usernames([...npubs, npubs[0]]),
      new Map(members.map(member => [member.nostrNpub, member.username])),
    );
  });

  it('looks up linked npubs and public usernames with the original filters', async () => {
    const npubs = ['npub-fictional-one'];
    const users = [{ username: 'fictionalone', nostrNpub: npubs[0] }];
    const calls: unknown[] = [];
    const mongoose = {
      model(name: string) {
        assert.equal(name, 'User');
        return {
          find(query: unknown) {
            calls.push(['find', query]);
            return Promise.resolve(users);
          },
          findOne(query: unknown) {
            calls.push(['findOne', query]);
            return Promise.resolve(users[0]);
          },
        };
      },
    };
    const service = await mockModule<
      typeof import('../../server/services/nostr-identity.server.service.mts')
    >(
      new URL(
        '../../server/services/nostr-identity.server.service.mts',
        import.meta.url,
      ),
      { mongoose },
    );

    assert.deepEqual(await service.findNostrUsersByNpubs(npubs), users);
    assert.deepEqual(
      await service.findPublicNip05User('fictionalone'),
      users[0],
    );
    assert.deepEqual(calls, [
      ['find', { nostrNpub: { $in: npubs } }],
      [
        'findOne',
        {
          public: true,
          email: { $exists: true, $nin: ['', null] },
          roles: { $nin: ['suspended', 'shadowban'] },
          username: 'fictionalone',
        },
      ],
    ]);
  });
});
