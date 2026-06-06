const errorService = require('../../../server/services/error.server.service');

require('should');

/**
 * Minimal Express-like response mock supporting the subset of methods used by
 * `errorResponse`: status(), format(), json(), send() and render().
 */
function mockResponse(acceptType) {
  const res = {
    statusCode: null,
    body: null,
    rendered: null,
  };

  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.format = function (handlers) {
    if (acceptType && handlers[acceptType]) {
      handlers[acceptType]();
    } else {
      handlers.default();
    }
    return res;
  };
  res.json = function (obj) {
    res.body = obj;
    return res;
  };
  res.send = function (str) {
    res.body = str;
    return res;
  };
  res.render = function (view) {
    res.rendered = view;
    return res;
  };

  return res;
}

describe('Service: error', function () {
  describe('getErrorMessageByKey', function () {
    it('returns the message for a known key', function () {
      errorService.getErrorMessageByKey('not-found').should.equal('Not found.');
      errorService.getErrorMessageByKey('forbidden').should.equal('Forbidden.');
      errorService.getErrorMessageByKey('conflict').should.equal('Conflict.');
      errorService
        .getErrorMessageByKey('suspended')
        .should.equal('Your account has been suspended.');
    });

    it('returns the default message for an unknown key', function () {
      const message = errorService.getErrorMessageByKey('does-not-exist');
      message.should.startWith('Snap! Something went wrong.');
    });

    it('returns the default message when no key is given', function () {
      const message = errorService.getErrorMessageByKey();
      message.should.startWith('Snap! Something went wrong.');
    });
  });

  describe('getNewError', function () {
    it('returns an Error with the matching message', function () {
      const err = errorService.getNewError('not-found');
      err.should.be.an.instanceof(Error);
      err.message.should.equal('Not found.');
    });

    it('sets the status code when provided', function () {
      const err = errorService.getNewError('forbidden', 403);
      err.status.should.equal(403);
    });

    it('does not set a status code when omitted', function () {
      const err = errorService.getNewError('forbidden');
      (err.status === undefined).should.be.true();
    });
  });

  describe('getErrorMessage', function () {
    it('returns the first validation message found', function () {
      const err = {
        errors: {
          email: { message: 'Email is invalid.' },
        },
      };
      errorService.getErrorMessage(err).should.equal('Email is invalid.');
    });

    it('returns the default message when there are no validation errors', function () {
      const message = errorService.getErrorMessage({});
      message.should.startWith('Snap! Something went wrong.');
    });
    it('falls back to the default message when validation errors have no message', function () {
      const message = errorService.getErrorMessage({
        errors: {
          email: {},
        },
      });
      message.should.startWith('Snap! Something went wrong.');
    });
  });

  describe('errorResponse middleware', function () {
    it('calls next when there is no error', function (done) {
      errorService.errorResponse(null, {}, mockResponse(), function () {
        done();
      });
    });

    it('responds with JSON containing the error message', function () {
      const res = mockResponse('application/json');
      const err = new Error('Boom');
      err.status = 422;

      errorService.errorResponse(err, {}, res);

      res.statusCode.should.equal(422);
      res.body.message.should.equal('Boom');
    });

    it('defaults to status 500 when the error has no status', function () {
      const res = mockResponse('application/json');
      errorService.errorResponse(new Error('Boom'), {}, res);
      res.statusCode.should.equal(500);
    });

    it('uses the default message when err.message is empty', function () {
      const res = mockResponse('application/json');
      errorService.errorResponse({ message: '' }, {}, res);
      res.body.message.should.startWith('Snap! Something went wrong.');
    });

    it('does not include the error object outside development mode', function () {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const res = mockResponse('application/json');
      errorService.errorResponse(new Error('Boom'), {}, res);

      process.env.NODE_ENV = originalEnv;
      res.body.error.should.be.undefined();
    });

    it('renders the HTML error view for text/html requests', function () {
      const res = mockResponse('text/html');
      errorService.errorResponse(new Error('Boom'), {}, res);
      res.rendered.should.equal('500.server.view.html');
    });

    it('sends a plain message for the default content type', function () {
      const res = mockResponse();
      errorService.errorResponse(new Error('Boom'), {}, res);
      res.body.should.equal('Boom');
    });

    it('includes the error object in development mode', function () {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const res = mockResponse('application/json');
      const err = new Error('Boom');
      errorService.errorResponse(err, {}, res);

      process.env.NODE_ENV = originalEnv;

      res.body.error.should.equal(err);
    });
  });
});
