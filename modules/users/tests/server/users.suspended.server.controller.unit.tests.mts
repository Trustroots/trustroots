import sinon from 'sinon';
import 'should';
import errorService from './../../../core/server/services/error.server.service.mts';
import suspendedController from './../../server/controllers/users.suspended.server.controller.mts';

describe('Suspended user controller', () => {
  afterEach(() => {
    sinon.restore();
  });

  function respond(path: string, type: string) {
    const destroy = sinon.spy((callback: () => void) => callback());
    const res = {
      status: sinon.stub().returnsThis(),
      format: sinon.spy((formats: Record<string, () => void>) =>
        formats[type](),
      ),
      redirect: sinon.spy(),
      json: sinon.spy(),
    };
    const next = sinon.spy();
    suspendedController.invalidateSuspendedSessions(
      {
        path,
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
      path: '/',
      user: { roles: ['user', 'suspended'] },
      logout: (callback: (logoutError?: Error) => void) => callback(error),
      session: { destroy },
    };

    suspendedController.invalidateSuspendedSessions(req, {}, next);

    next.calledOnceWithExactly(error).should.be.true();
    destroy.called.should.be.false();
  });

  it('sends a suspended member opening a page to the suspended route', () => {
    const res = respond('/profile/api', 'text/html');

    res.redirect.calledOnceWithExactly('/suspended').should.be.true();
    res.status.called.should.be.false();
    res.json.called.should.be.false();
  });

  for (const path of ['/api', '/api/users/member', '/API/users/member']) {
    it(`answers a suspended member calling ${path} with JSON even if HTML was preferred`, () => {
      const res = respond(path, 'text/html');

      res.status.calledOnceWithExactly(403).should.be.true();
      res.json
        .calledOnceWithExactly({
          message: errorService.getErrorMessageByKey('suspended'),
        })
        .should.be.true();
      res.format.called.should.be.false();
      res.redirect.called.should.be.false();
    });
  }

  it('keeps JSON available when a non-API request asks for it', () => {
    const res = respond('/apiary', 'application/json');

    res.format.calledOnce.should.be.true();
    res.status.calledOnceWithExactly(403).should.be.true();
    res.json
      .calledOnceWithExactly({
        message: errorService.getErrorMessageByKey('suspended'),
      })
      .should.be.true();
    res.redirect.called.should.be.false();
  });

  it('lets anonymous requests continue', () => {
    const next = sinon.spy();

    suspendedController.invalidateSuspendedSessions({ path: '/' }, {}, next);

    next.calledOnceWithExactly().should.be.true();
  });

  it('lets members who are not suspended continue', () => {
    const next = sinon.spy();
    const logout = sinon.spy();

    suspendedController.invalidateSuspendedSessions(
      { path: '/', user: { roles: ['user'] }, logout },
      {},
      next,
    );

    next.calledOnceWithExactly().should.be.true();
    logout.called.should.be.false();
  });
});
