const sinon = require('sinon');
require('should');

const suspendedController = require('../../server/controllers/users.suspended.server.controller');

describe('Suspended user controller', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('forwards Passport logout errors without destroying the session', () => {
    const error = new Error('logout failed');
    const destroy = sinon.spy();
    const next = sinon.spy();
    const req = {
      user: { roles: ['user', 'suspended'] },
      logout: callback => callback(error),
      session: { destroy },
    };

    suspendedController.invalidateSuspendedSessions(req, {}, next);

    next.calledOnceWithExactly(error).should.be.true();
    destroy.called.should.be.false();
  });
});
