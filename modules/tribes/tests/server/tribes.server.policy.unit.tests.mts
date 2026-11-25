import mockModule from '../../../../testutils/server/mock-module.mts';
import { assertGrants } from '../../../../testutils/server/route-grants.server.testutil.mts';

describe('Tribes policy unit tests', () => {
  it('lets guests read circles, members join them and keeps member lists signed-in', async () => {
    // api-routes.unit.tests stubs this module; load the real one.
    const policy = await mockModule<
      typeof import('../../server/policies/tribes.server.policy.mts')
    >(
      new URL(
        '../../server/policies/tribes.server.policy.mts',
        import.meta.url,
      ),
      {},
    );
    assertGrants(policy.isAllowed, [
      'guest GET /api/tribes',
      'user GET /api/tribes',
      'admin GET /api/tribes',
      'guest GET /api/tribes/:tribe',
      'user GET /api/tribes/:tribe',
      'user PATCH /api/tribes/:tribe',
      'admin GET /api/tribes/:tribe',
      'user GET /api/tribes/:tribe/members',
      'admin GET /api/tribes/:tribe/members',
      'user GET /api/tribes/discovery/connections',
      'admin GET /api/tribes/discovery/connections',
    ]);
  });
});
