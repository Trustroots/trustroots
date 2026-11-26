import assert from 'node:assert/strict';
import mockModule from '../../../../testutils/server/mock-module.mts';
describe('Nostr identity service', () => {
  it('looks up unique npubs and projects the usernames of eligible members', async () => {
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
                return {
                  async lean() {
                    return members;
                  },
                };
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
});
