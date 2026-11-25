import 'should';
import policy from '../../server/policies/offers.server.policy.mts';
import {
  assertGrants,
  policyRequest,
  policyResponse,
} from '../../../../testutils/server/route-grants.server.testutil.mts';

function offerRequest(owner: unknown) {
  const req = policyRequest('user', '/api/offers/:offerId', 'POST');
  return { ...req, offer: { user: owner } };
}

describe('Offers policy unit tests', () => {
  it('grants admins and users only their documented methods', () => {
    assertGrants(policy.isAllowed, [
      'user GET /api/offers',
      'user POST /api/offers',
      'admin GET /api/offers',
      'admin HEAD /api/offers',
      'admin POST /api/offers',
      'admin PUT /api/offers',
      'admin DELETE /api/offers',
      'user GET /api/offers-by/:offerUserId',
      'admin GET /api/offers-by/:offerUserId',
      'admin HEAD /api/offers-by/:offerUserId',
      'admin POST /api/offers-by/:offerUserId',
      'admin PUT /api/offers-by/:offerUserId',
      'admin DELETE /api/offers-by/:offerUserId',
      'user GET /api/offers/:offerId',
      'user PUT /api/offers/:offerId',
      'user DELETE /api/offers/:offerId',
      'admin GET /api/offers/:offerId',
      'admin HEAD /api/offers/:offerId',
      'admin POST /api/offers/:offerId',
      'admin PUT /api/offers/:offerId',
      'admin DELETE /api/offers/:offerId',
    ]);
  });

  it('lets owners do anything with their own offer', () => {
    const req = offerRequest(undefined);
    req.offer.user = req.user!._id;
    let permitted = false;

    policy.isAllowed(req, policyResponse(), () => {
      permitted = true;
    });

    permitted.should.be.true();
  });

  it('does not let a user manipulate an offer owned by someone else', () => {
    const res = policyResponse();

    policy.isAllowed(offerRequest({ valueOf: () => 'other-id' }), res, () => {
      throw new Error('A member changed somebody else’s offer');
    });

    res.statusCode.should.equal(403);
  });

  it('returns 403 for unpublished users, even on their own offer', () => {
    const req = offerRequest(undefined);
    req.offer.user = req.user!._id;
    req.user!.public = false;
    const res = policyResponse();

    policy.isAllowed(req, res, () => {
      throw new Error('An unpublished member reached offers');
    });

    res.statusCode.should.equal(403);
    res.body!.should.deepEqual({ message: 'Forbidden.' });
  });
});
