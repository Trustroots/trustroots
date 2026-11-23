import 'should';
import policy from '../../server/policies/contacts.server.policy.mts';
import {
  assertGrants,
  policyRequest,
  policyResponse,
} from '../../../../testutils/server/route-grants.server.testutil.mts';

function contactRequest(userFrom: string, userTo: string) {
  const party = (id: string) => ({
    _id: { equals: (other: unknown) => other === id },
  });
  return {
    ...policyRequest('user', '/api/contact/:contactId', 'DELETE'),
    contact: { userFrom: party(userFrom), userTo: party(userTo) },
  };
}

describe('Contacts policy unit tests', () => {
  it('grants exactly the documented permissions per role', () => {
    assertGrants(policy.isAllowed, [
      'user POST /api/contact',
      'user GET /api/contact-by/:contactUserId',
      'admin GET /api/contact-by/:contactUserId',
      'user GET /api/contact/:contactId',
      'user PUT /api/contact/:contactId',
      'admin GET /api/contact/:contactId',
      'user GET /api/contacts/:listUserId',
      'admin GET /api/contacts/:listUserId',
      'user GET /api/contacts/:listUserId/common',
      'admin GET /api/contacts/:listUserId/common',
    ]);
  });

  it('lets either party of a contact delete it', () => {
    for (const req of [
      contactRequest('member-id', 'other-id'),
      contactRequest('other-id', 'member-id'),
    ]) {
      let permitted = false;
      policy.isAllowed(req, policyResponse(), () => {
        permitted = true;
      });
      permitted.should.be.true();
    }
  });

  it('refuses deletion to members outside the contact', () => {
    const res = policyResponse();

    policy.isAllowed(contactRequest('one-id', 'two-id'), res, () => {
      throw new Error('A third member deleted a contact');
    });

    res.statusCode.should.equal(403);
  });

  it('returns 403 for unpublished users', () => {
    const req = policyRequest('user', '/api/contacts/:listUserId', 'GET');
    req.user!.public = false;
    const res = policyResponse();

    policy.isAllowed(req, res, () => {
      throw new Error('An unpublished member reached contacts');
    });

    res.statusCode.should.equal(403);
    res.body!.should.deepEqual({ message: 'Forbidden.' });
  });
});
