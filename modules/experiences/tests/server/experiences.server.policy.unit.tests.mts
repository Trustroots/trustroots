import 'should';
import policy from '../../server/policies/experiences.server.policy.mts';
import {
  assertGrants,
  policyRequest,
  policyResponse,
} from '../../../../testutils/server/route-grants.server.testutil.mts';

const grants = [
  'user GET /api/experiences',
  'user POST /api/experiences',
  'admin GET /api/experiences',
  'admin POST /api/experiences',
  'user GET /api/experiences/count',
  'admin GET /api/experiences/count',
  'user GET /api/experiences/suggestion',
  'admin GET /api/experiences/suggestion',
  'user GET /api/experiences/reply-recipient/:recipientUsername',
  'admin GET /api/experiences/reply-recipient/:recipientUsername',
  'user GET /api/my-experience',
  'admin GET /api/my-experience',
  'user GET /api/experiences/:experienceId',
  'admin GET /api/experiences/:experienceId',
  'user GET /api/experiences/:id/change-access',
  'admin GET /api/experiences/:id/change-access',
  'user POST /api/experiences/:id/change-requests',
  'admin POST /api/experiences/:id/change-requests',
  'user GET /api/experiences/:id/change-requests/mine',
  'admin GET /api/experiences/:id/change-requests/mine',
];

function unpublishedDecision(middleware: typeof policy.isAllowed): {
  permitted: boolean;
  statusCode: number;
  body: { message: string } | null;
} {
  const req = policyRequest(
    'user',
    '/api/experiences/:id/change-access',
    'GET',
  );
  req.user!.public = false;
  const res = policyResponse();
  let permitted = false;
  middleware(req, res, () => {
    permitted = true;
  });
  return { permitted, statusCode: res.statusCode, body: res.body };
}

describe('Experiences policy unit tests', () => {
  it('grants exactly the experience routes and methods to users and admins', () => {
    assertGrants(policy.isAllowed, grants);
    assertGrants(policy.isAllowedChange, grants);
  });

  it('keeps unpublished members out of experiences', () => {
    unpublishedDecision(policy.isAllowed).should.deepEqual({
      permitted: false,
      statusCode: 403,
      body: { message: 'Forbidden.' },
    });
  });

  it('lets unpublished members request experience changes', () => {
    unpublishedDecision(policy.isAllowedChange).permitted.should.be.true();
  });
});
