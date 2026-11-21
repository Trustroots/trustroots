import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sinon from 'sinon';
import 'should';
import errorService from './../../../core/server/services/error.server.service.mts';
import suspendedController from './../../server/controllers/users.suspended.server.controller.mts';

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
      logout: (callback: (logoutError?: Error) => void) => callback(error),
      session: { destroy },
    };

    suspendedController.invalidateSuspendedSessions(req, {}, next);

    next.calledOnceWithExactly(error).should.be.true();
    destroy.called.should.be.false();
  });

  it('answers a suspended member with 403 and the suspended page or message', () => {
    const message = errorService.getErrorMessageByKey('suspended');
    const respond = (type: string) => {
      const res = {
        status: sinon.stub().returnsThis(),
        format: (formats: Record<string, () => void>) => formats[type](),
        sendFile: sinon.spy(),
        json: sinon.spy(),
      };
      suspendedController.invalidateSuspendedSessions(
        {
          user: { roles: ['suspended'] },
          logout: callback => callback(),
          session: { destroy: callback => callback() },
        },
        res,
        sinon.spy(),
      );
      res.status.calledOnceWithExactly(403).should.be.true();
      return res;
    };

    const [page, { root }] = respond('text/html').sendFile.firstCall.args;
    readFileSync(join(root, page), 'utf8').should.containEql(
      `<h1>${message}</h1>`,
    );
    respond('application/json')
      .json.calledOnceWithExactly({ message })
      .should.be.true();
  });
});
