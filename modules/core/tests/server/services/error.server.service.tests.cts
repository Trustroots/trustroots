const errorService: ErrorService = require('./../../../server/services/error.server.service.mjs');
const winston: typeof import('winston') = require('winston');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');

type ErrorPayload = {
  errors?: Record<string, { message?: string }>;
  message?: string;
  name?: string;
  stack?: string;
  status?: number;
};
type ErrorBody = { message: string; error?: Error };
type MockResponse = {
  statusCode: number | null;
  body: ErrorBody | string | null;
  rendered: string | null;
  status(code: number): MockResponse;
  format(
    handlers: Record<string, () => void> & { default: () => void },
  ): MockResponse;
  json(body: ErrorBody): MockResponse;
  send(body: ErrorBody | string): MockResponse;
  render(view: string): MockResponse;
};
type ErrorService = {
  getErrorMessageByKey(key?: string): string;
  getErrorMessage(error: ErrorPayload): string;
  errorResponse(
    error: ErrorPayload | null,
    request: object,
    response: MockResponse,
    next?: () => void,
  ): unknown;
  sendInvalidId(response: MockResponse): MockResponse;
  sendBadRequest(response: MockResponse, error?: ErrorPayload): MockResponse;
  sendNotFound(response: MockResponse): MockResponse;
  sendForbidden(response: MockResponse): MockResponse;
};

/**
 * Minimal Express-like response mock supporting the subset of methods used by
 * `errorResponse`: status(), format(), json(), send() and render().
 */
function mockResponse(acceptType?: string): MockResponse {
  const res: MockResponse = {
    statusCode: null,
    body: null,
    rendered: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    format(handlers) {
      if (acceptType && handlers[acceptType]) {
        handlers[acceptType]();
      } else {
        handlers.default();
      }
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    render(view) {
      res.rendered = view;
      return res;
    },
  };

  return res;
}

function jsonBody(response: MockResponse): ErrorBody {
  if (!response.body || typeof response.body === 'string')
    throw new Error('Expected a JSON error response');
  return response.body;
}
function statusCode(response: MockResponse): number {
  if (response.statusCode === null)
    throw new Error('Expected an HTTP status code');
  return response.statusCode;
}
function renderedView(response: MockResponse): string {
  if (response.rendered === null)
    throw new Error('Expected an HTML error view');
  return response.rendered;
}
function responseBody(response: MockResponse): ErrorBody | string {
  if (response.body === null)
    throw new Error('Expected an error response body');
  return response.body;
}

describe('Service: error', function () {
  it('exposes callable named ESM exports', async function () {
    const esmService =
      await import('../../../server/services/error.server.service.mjs');
    for (const name of [
      'getErrorMessageByKey',
      'getErrorMessage',
      'errorResponse',
      'sendInvalidId',
      'sendBadRequest',
      'sendNotFound',
      'sendForbidden',
    ] as const satisfies readonly (keyof ErrorService)[]) {
      esmService[name].should.equal(errorService[name]);
    }
  });

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
    it('logs classified Error metadata without forwarding its message or stack', function () {
      const log = sinon.stub(winston, 'log');

      try {
        const err = new Error('recovery token: private-token');
        errorService.errorResponse(err, {}, mockResponse('application/json'));

        const loggedError = log
          .getCalls()
          .find(
            ({ args: [level, event] }) =>
              level === 'error' && event === 'API error response',
          );
        // Winston's overload omits the third metadata argument sent at runtime.
        const metadata = loggedError?.args as readonly unknown[] | undefined;
        should(metadata?.[2]).deepEqual({ name: 'Error' });
      } finally {
        log.restore();
      }
    });

    it('calls next when there is no error', function (done) {
      errorService.errorResponse(null, {}, mockResponse(), function () {
        done();
      });
    });

    it('responds with JSON containing the error message', function () {
      const res = mockResponse('application/json');
      const err = new Error('Boom');
      const errWithStatus = Object.assign(err, { status: 422 });

      errorService.errorResponse(errWithStatus, {}, res);

      statusCode(res).should.equal(422);
      jsonBody(res).message.should.equal('Boom');
    });

    it('defaults to status 500 when the error has no status', function () {
      const res = mockResponse('application/json');
      errorService.errorResponse(new Error('Boom'), {}, res);
      statusCode(res).should.equal(500);
    });

    it('uses the default message when err.message is empty', function () {
      const res = mockResponse('application/json');
      errorService.errorResponse({ message: '' }, {}, res);
      jsonBody(res).message.should.startWith('Snap! Something went wrong.');
    });

    it('does not include the error object outside development mode', function () {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';

      const res = mockResponse('application/json');
      errorService.errorResponse(new Error('Boom'), {}, res);

      process.env.NODE_ENV = originalEnv;
      should(jsonBody(res).error).be.undefined();
    });

    it('renders the HTML error view for text/html requests', function () {
      const res = mockResponse('text/html');
      errorService.errorResponse(new Error('Boom'), {}, res);
      renderedView(res).should.equal('500.server.view.html');
    });

    it('sends a plain message for the default content type', function () {
      const res = mockResponse();
      errorService.errorResponse(new Error('Boom'), {}, res);
      responseBody(res).should.equal('Boom');
    });

    it('includes the error object in development mode', function () {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const res = mockResponse('application/json');
      const err = new Error('Boom');
      errorService.errorResponse(err, {}, res);

      process.env.NODE_ENV = originalEnv;

      jsonBody(res).error!.should.equal(err);
    });
  });

  describe('sendInvalidId', function () {
    it('responds with 400 and the invalid-id message', function () {
      const res = mockResponse();
      errorService.sendInvalidId(res);
      statusCode(res).should.equal(400);
      jsonBody(res).message.should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });
  });

  describe('sendBadRequest', function () {
    it('derives the message from a Mongoose error when given', function () {
      const res = mockResponse();
      const err = {
        errors: {
          username: { message: 'Username is required.' },
        },
      };
      errorService.sendBadRequest(res, err);
      statusCode(res).should.equal(400);
      jsonBody(res).message.should.equal('Username is required.');
    });

    it('falls back to the bad-request message without an error', function () {
      const res = mockResponse();
      errorService.sendBadRequest(res);
      statusCode(res).should.equal(400);
      jsonBody(res).message.should.equal(
        errorService.getErrorMessageByKey('bad-request'),
      );
    });
  });

  describe('sendNotFound', function () {
    it('responds with 404 and the not-found message', function () {
      const res = mockResponse();
      errorService.sendNotFound(res);
      statusCode(res).should.equal(404);
      jsonBody(res).message.should.equal(
        errorService.getErrorMessageByKey('not-found'),
      );
    });
  });

  describe('sendForbidden', function () {
    it('responds with 403 and the forbidden message', function () {
      const res = mockResponse();
      errorService.sendForbidden(res);
      statusCode(res).should.equal(403);
      jsonBody(res).message.should.equal(
        errorService.getErrorMessageByKey('forbidden'),
      );
    });
  });
});
