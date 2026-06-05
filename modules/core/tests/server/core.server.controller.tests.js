const coreController = require('../../server/controllers/core.server.controller');
const languagesObject = require('../../../../config/languages/languages.json');
const languagesArray = require('../../../../config/languages/languages-array.json');

require('should');

/**
 * Minimal Express-like response mock for unit-testing controller actions
 * without spinning up the full HTTP stack.
 */
function mockResponse(acceptType) {
  const res = {
    statusCode: null,
    body: null,
    rendered: null,
    renderVars: null,
    headers: {},
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
    res.body = obj === undefined ? null : obj;
    return res;
  };
  res.send = function (str) {
    res.body = str;
    return res;
  };
  res.render = function (view, vars) {
    res.rendered = view;
    res.renderVars = vars;
    return res;
  };
  res.set = function (key, value) {
    res.headers[key] = value;
    return res;
  };

  return res;
}

describe('Controller: core', function () {
  describe('renderIndex', function () {
    it('marks the signup page as an invite', function () {
      const res = mockResponse();
      coreController.renderIndex({ path: '/signup' }, res);
      res.rendered.should.equal('index.server.view.html');
      res.renderVars.invite.should.be.true();
    });

    it('does not mark other pages as invites', function () {
      const res = mockResponse();
      coreController.renderIndex({ path: '/' }, res);
      (res.renderVars.invite === undefined).should.be.true();
    });
  });

  describe('renderNotFound', function () {
    it('returns a JSON not-found message', function () {
      const res = mockResponse('application/json');
      coreController.renderNotFound({}, res);
      res.statusCode.should.equal(404);
      res.body.message.should.equal('Not found.');
    });

    it('renders an HTML view for text/html requests', function () {
      const res = mockResponse('text/html');
      coreController.renderNotFound({}, res);
      res.rendered.should.equal('404.server.view.html');
    });

    it('sends a plain message for other content types', function () {
      const res = mockResponse();
      coreController.renderNotFound({}, res);
      res.body.should.equal('Not found.');
    });
  });

  describe('receiveCSPViolationReport', function () {
    let originalEnv;

    beforeEach(function () {
      originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
    });

    afterEach(function () {
      process.env.NODE_ENV = originalEnv;
    });

    it('responds with status 204 when a report body is present', function () {
      const res = mockResponse();
      coreController.receiveCSPViolationReport({ body: { foo: 'bar' } }, res);
      res.statusCode.should.equal(204);
    });

    it('responds with status 204 when no report body is present', function () {
      const res = mockResponse();
      coreController.receiveCSPViolationReport({ body: null }, res);
      res.statusCode.should.equal(204);
    });
  });

  describe('receiveExpectCTViolationReport', function () {
    let originalEnv;

    beforeEach(function () {
      originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
    });

    afterEach(function () {
      process.env.NODE_ENV = originalEnv;
    });

    it('responds with status 204 when a report body is present', function () {
      const res = mockResponse();
      coreController.receiveExpectCTViolationReport(
        { body: { foo: 'bar' } },
        res,
      );
      res.statusCode.should.equal(204);
    });

    it('responds with status 204 when no report body is present', function () {
      const res = mockResponse();
      coreController.receiveExpectCTViolationReport({ body: null }, res);
      res.statusCode.should.equal(204);
    });
  });

  describe('renderServiceWorkerConfig', function () {
    it('returns javascript exposing the FCM sender id', function () {
      const res = mockResponse();
      coreController.renderServiceWorkerConfig({}, res);
      res.headers['Content-Type'].should.equal('text/javascript');
      res.body.should.startWith('var FCM_SENDER_ID = ');
    });
  });

  describe('getLanguages', function () {
    it('returns the languages array when format=array', function () {
      const res = mockResponse();
      coreController.getLanguages({ query: { format: 'array' } }, res);
      res.body.should.deepEqual(languagesArray);
    });

    it('returns the languages object by default', function () {
      const res = mockResponse();
      coreController.getLanguages({ query: {} }, res);
      res.body.should.deepEqual(languagesObject);
    });
  });
});
