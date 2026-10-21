import 'should';
import policy from '../../server/policies/messages.server.policy.mts';
import {
  assertGrants,
  policyRequest,
  policyResponse,
} from '../../../../testutils/server/route-grants.server.testutil.mts';

describe('Messages policy unit tests', () => {
  it('grants exactly the documented permissions per role', () => {
    assertGrants(policy.isAllowed, [
      'user GET /api/messages-hosting',
      'user GET /api/messages',
      'user POST /api/messages',
      'user GET /api/messages/:messageUserId',
      'user POST /api/messages-preview',
      'admin POST /api/messages-preview',
      'user POST /api/messages-read',
      'user GET /api/messages-count',
      'user GET /api/messages-sync',
    ]);
  });

  it('blocks non-public signed-in users before the grants', () => {
    const req = policyRequest('user', '/api/messages', 'GET');
    req.user!.public = false;
    const res = policyResponse();

    policy.isAllowed(req, res, () => {
      throw new Error('An unpublished member reached messages');
    });

    res.statusCode.should.equal(403);
    res.body!.message.should.equal('Forbidden.');
  });
});
