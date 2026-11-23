import 'should';
import policy from '../../server/policies/reference-thread.server.policy.mts';
import {
  assertGrants,
  policyRequest,
  policyResponse,
} from '../../../../testutils/server/route-grants.server.testutil.mts';

const threadPath = '/api/references-thread/:referenceThreadUserToId';

function unpublishedRequest(method: string, ownsThread: boolean) {
  const req = policyRequest('member-without-grants', threadPath, method);
  req.user!.public = false;
  return {
    ...req,
    referenceThread: { userFrom: { equals: () => ownsThread } },
  };
}

function decide(req: Parameters<typeof policy.isAllowed>[0]) {
  const res = policyResponse();
  let permitted = false;
  policy.isAllowed(req, res, () => {
    permitted = true;
  });
  return { permitted, statusCode: res.statusCode };
}

describe('Reference thread policy unit tests', () => {
  it('grants exactly the documented permissions per role', () => {
    assertGrants(policy.isAllowed, [
      'user POST /api/references-thread',
      'admin POST /api/references-thread',
      `user GET ${threadPath}`,
      `admin GET ${threadPath}`,
    ]);
  });

  it('lets unpublished members read only the thread they wrote', () => {
    decide(unpublishedRequest('GET', true)).permitted.should.be.true();
    decide(unpublishedRequest('GET', false)).should.deepEqual({
      permitted: false,
      statusCode: 403,
    });
  });

  it('refuses unpublished members any write, even on their own thread', () => {
    decide(unpublishedRequest('POST', true)).should.deepEqual({
      permitted: false,
      statusCode: 403,
    });
  });
});
