import should from 'should';
import resourcePolicy from '../../server/middleware/mobile-resource-policy.server.middleware.cjs';

describe('Mobile resource policy adapter', function () {
  it('preserves request context without mutating the shared Express route', function (done) {
    const route = { path: '/api/mobile/v0/messages' };
    const req = { route, method: 'GET', user: { public: true } };
    const res = {};
    resourcePolicy(function (
      policyRequest: typeof req,
      policyResponse: typeof res,
      next: () => void,
    ) {
      policyRequest.route.path.should.equal('/api/messages');
      policyRequest.method.should.equal('GET');
      policyRequest.user.should.equal(req.user);
      policyResponse.should.equal(res);
      setImmediate(next);
    }, '/api/messages')(req, res, function (err?: Error) {
      should.not.exist(err);
      req.route.should.equal(route);
      route.path.should.equal('/api/mobile/v0/messages');
      done();
    });
  });
});
