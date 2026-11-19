import sinon from 'sinon';
import 'should';
import errorService from './../../../core/server/services/error.server.service.mts';
import suspendedController from './../../server/controllers/users.suspended.server.controller.mts';

describe('Suspended user controller', () => {
  afterEach(() => {
    sinon.restore();
  });

  function respond(type: string) {
    const destroy = sinon.spy((callback: () => void) => callback());
    const res = {
      status: sinon.stub().returnsThis(),
      format: (formats: Record<string, () => void>) => formats[type](),
      redirect: sinon.spy(),
      json: sinon.spy(),
    };
    const next = sinon.spy();
    suspendedController.invalidateSuspendedSessions(
      {
        user: { roles: ['user', 'suspended'] },
        logout: callback => callback(),
        session: { destroy },
      },
      res,
      next,
    );
    destroy.calledOnce.should.be.true();
    next.called.should.be.false();
    return res;
  }

  it('forwards Passport logout errors without destroying the session', () => {
    const error = new Error('logout failed');
    const destroy = sinon.spy();
    const next = sinon.spy();
    const req = {
      user: { roles: ['user', 'suspended'] },
      logout: (callback: (logoutError?: Error) => void) => callback(error),
      session: { destroy },
    };

    suspendedController.invalidateSuspendedSessions(req, {}, next);

    next.calledOnceWithExactly(error).should.be.true();
    destroy.called.should.be.false();
  });

  it('sends a suspended member opening a page to the suspended route', () => {
    const res = respond('text/html');

    res.redirect.calledOnceWithExactly('/suspended').should.be.true();
    res.status.called.should.be.false();
    res.json.called.should.be.false();
  });

  it('answers a suspended member calling the API with 403 and the message', () => {
    const res = respond('application/json');

    res.status.calledOnceWithExactly(403).should.be.true();
    res.json
      .calledOnceWithExactly({
        message: errorService.getErrorMessageByKey('suspended'),
      })
      .should.be.true();
    res.redirect.called.should.be.false();
  });

  it('lets members who are not suspended continue', () => {
    const next = sinon.spy();
    const logout = sinon.spy();

    suspendedController.invalidateSuspendedSessions(
      { user: { roles: ['user'] }, logout },
      {},
      next,
    );

    next.calledOnceWithExactly().should.be.true();
    logout.called.should.be.false();
  });
});
