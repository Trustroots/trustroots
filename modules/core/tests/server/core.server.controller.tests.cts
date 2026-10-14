const sinon = require('sinon');
const winston: typeof import('winston') = require('winston');
const userProfile: typeof import('../../../users/server/controllers/users.profile.server.controller.mjs') = require('./../../../users/server/controllers/users.profile.server.controller.mjs');
const languagesObject: Record<
  string,
  string
> = require('../../../../config/languages/languages.json');
const languagesArray: Array<{
  value: string;
  label: string;
}> = require('../../../../config/languages/languages-array.json');
const deprecatedLanguages: Set<string> = require('./../../../../config/languages/deprecated.mjs');

require('should');
const should: typeof import('should') = require('should');

const sanitizeOwnProfile = (user: { username: string }) => ({
  sanitized: true,
  username: user.username,
});
type CoreController =
  typeof import('../../server/controllers/core.server.controller.mjs');
const coreController: Pick<
  CoreController,
  | 'renderIndex'
  | 'renderNotFound'
  | 'receiveCSPViolationReport'
  | 'receiveExpectCTViolationReport'
  | 'getLanguages'
> = require('./../../server/controllers/core.server.controller.mjs');
type MockResponse = {
  statusCode: number;
  body: unknown;
  rendered: string;
  renderVars: Record<string, unknown> | undefined;
  headers: Record<string, string>;
  redirected: string;
  status?: (code: number) => MockResponse;
  format?: (
    handlers: Record<string, () => void> & { default: () => void },
  ) => MockResponse;
  json?: (value: unknown) => MockResponse;
  send?: (value: unknown) => MockResponse;
  render?: (view: string, vars?: Record<string, unknown>) => MockResponse;
  set?: (key: string, value: string) => MockResponse;
  redirect?: (url: string) => MockResponse;
};
type Language = { value: string; label: string; deprecated: boolean };

function languageArray(response: MockResponse): Language[] {
  if (!Array.isArray(response.body) || !response.body.every(isLanguage)) {
    throw new Error('Expected language array');
  }
  return response.body;
}

function languageObject(response: MockResponse): Record<string, string> {
  if (typeof response.body !== 'object' || response.body === null) {
    throw new Error('Expected language object');
  }
  return Object.fromEntries(Object.entries(response.body));
}

function findLanguage(response: MockResponse, value: string): Language {
  const language = languageArray(response).find(item => item.value === value);
  if (!language) throw new Error(`Expected language ${value}`);
  return language;
}

function isLanguage(value: unknown): value is Language {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'string' &&
    'label' in value &&
    typeof value.label === 'string' &&
    'deprecated' in value &&
    typeof value.deprecated === 'boolean'
  );
}

function renderVars(response: MockResponse): Record<string, unknown> {
  if (!response.renderVars) throw new Error('Expected render variables');
  return response.renderVars;
}

function responseMessage(response: MockResponse): unknown {
  if (
    typeof response.body !== 'object' ||
    response.body === null ||
    !('message' in response.body)
  ) {
    return undefined;
  }
  return response.body.message;
}

/**
 * Minimal Express-like response mock for unit-testing controller actions
 * without spinning up the full HTTP stack.
 */
function mockResponse(acceptType?: string): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    rendered: '',
    renderVars: undefined,
    headers: {},
    redirected: '',
  };

  res.status = function (code: number) {
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
  res.json = function (value) {
    res.body = value === undefined ? null : value;
    return res;
  };
  res.send = function (value) {
    res.body = value;
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
  res.redirect = function (url) {
    res.redirected = url;
    return res;
  };

  return res;
}

describe('Controller: core', function () {
  beforeEach(function () {
    sinon.stub(userProfile, 'sanitizeOwnProfile').callsFake(sanitizeOwnProfile);
  });

  afterEach(function () {
    sinon.restore();
  });
  describe('renderIndex', function () {
    it('marks the signup page as an invite', function () {
      const res = mockResponse();
      coreController.renderIndex({ path: '/signup' }, res);
      res.rendered.should.equal('react-index.server.view.html');
      should(renderVars(res).invite).be.true();
    });

    it('does not mark other pages as invites', function () {
      const res = mockResponse();
      coreController.renderIndex({ path: '/' }, res);
      should(renderVars(res).invite === undefined).be.true();
    });

    it('renders the React index for React-owned paths', function () {
      const res = mockResponse();
      coreController.renderIndex({ path: '/support' }, res);
      res.rendered.should.equal('react-index.server.view.html');
    });

    it('redirects legacy React routes to their replacement', function () {
      const res = mockResponse();
      coreController.renderIndex({ path: '/about' }, res);
      res.redirected.should.equal('/');
    });

    it('renders the React index for unknown paths', function () {
      const res = mockResponse();
      res.redirect = function () {
        throw new Error('should not redirect unknown paths');
      };
      coreController.renderIndex({ path: '/definitely-not-a-route' }, res);
      res.rendered.should.equal('react-index.server.view.html');
    });

    it('exposes a sanitized user profile when signed in', function () {
      const res = mockResponse();
      coreController.renderIndex(
        { path: '/', user: { username: 'alice', email: 'alice@example.com' } },
        res,
      );
      should(renderVars(res).user).deepEqual({
        sanitized: true,
        username: 'alice',
      });
    });

    it('exposes the current tribe when browsing a tribe page', function () {
      const tribe = { slug: 'test-tribe', label: 'Test Tribe' };
      const res = mockResponse();
      coreController.renderIndex({ path: '/tribes/test-tribe', tribe }, res);
      should(renderVars(res).tribe).equal(tribe);
    });
  });

  describe('renderNotFound', function () {
    it('returns a JSON not-found message', function () {
      const res = mockResponse('application/json');
      coreController.renderNotFound({}, res);
      res.statusCode.should.equal(404);
      should(responseMessage(res)).equal('Not found.');
    });

    it('renders an HTML view for text/html requests', function () {
      const res = mockResponse('text/html');
      coreController.renderNotFound({}, res);
      res.rendered.should.equal('404.server.view.html');
    });

    it('sends a plain message for other content types', function () {
      const res = mockResponse();
      coreController.renderNotFound({}, res);
      should(res.body).equal('Not found.');
    });
  });

  describe('receiveCSPViolationReport', function () {
    let originalEnv: string | undefined;

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

    it('redacts report URLs before logging security reports', function () {
      const originalLog = winston.log;
      const calls: unknown[][] = [];
      winston.log = ((...args: unknown[]) => {
        calls.push(args);
        return winston;
      }) as unknown as typeof winston.log;

      try {
        const res = mockResponse();
        coreController.receiveCSPViolationReport(
          {
            body: {
              'blocked-uri': 'https://example.test/?token=private-token',
            },
          },
          res,
        );

        const report = calls.find(
          ([level, event]) =>
            level === 'warn' && event === 'CSP violation report #ljeanw',
        );
        should(report?.[2]).deepEqual({ report: '[REDACTED]' });
      } finally {
        winston.log = originalLog;
      }
    });

    it('responds with status 204 when no report body is present', function () {
      const res = mockResponse();
      coreController.receiveCSPViolationReport({ body: null }, res);
      res.statusCode.should.equal(204);
    });

    it('responds with status 204 in test mode', function () {
      process.env.NODE_ENV = 'test';

      const res = mockResponse();
      coreController.receiveCSPViolationReport({ body: { foo: 'bar' } }, res);
      res.statusCode.should.equal(204);
    });
  });

  describe('receiveExpectCTViolationReport', function () {
    let originalEnv: string | undefined;

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

    it('redacts report URLs before logging security reports', function () {
      const originalLog = winston.log;
      const calls: unknown[][] = [];
      winston.log = ((...args: unknown[]) => {
        calls.push(args);
        return winston;
      }) as unknown as typeof winston.log;

      try {
        const res = mockResponse();
        coreController.receiveExpectCTViolationReport(
          {
            body: {
              'blocked-uri': 'https://example.test/?token=private-token',
            },
          },
          res,
        );

        const report = calls.find(
          ([level, event]) =>
            level === 'warn' && event === 'Expect-CT violation report #3hg8ha',
        );
        should(report?.[2]).deepEqual({ report: '[REDACTED]' });
      } finally {
        winston.log = originalLog;
      }
    });

    it('responds with status 204 when no report body is present', function () {
      const res = mockResponse();
      coreController.receiveExpectCTViolationReport({ body: null }, res);
      res.statusCode.should.equal(204);
    });

    it('responds with status 204 in test mode', function () {
      process.env.NODE_ENV = 'test';

      const res = mockResponse();
      coreController.receiveExpectCTViolationReport(
        { body: { foo: 'bar' } },
        res,
      );
      res.statusCode.should.equal(204);
    });
  });

  describe('getLanguages', function () {
    it('returns the languages array when format=array', function () {
      const res = mockResponse();
      coreController.getLanguages({ query: { format: 'array' } }, res);
      languageArray(res).should.deepEqual(
        languagesArray.map(language => ({
          ...language,
          deprecated: deprecatedLanguages.has(language.value),
        })),
      );
      languageArray(res)
        .filter(language => language.deprecated)
        .length.should.equal(20);
      should(findLanguage(res, 'enm').deprecated).be.true();
      should(findLanguage(res, 'iso_639_3-lfn').deprecated).be.true();
      should(findLanguage(res, 'grc').deprecated).be.false();
      should(findLanguage(res, 'lat').deprecated).be.false();
      should(findLanguage(res, 'lim').label).equal('Limburgish');
    });

    it('returns the languages object by default', function () {
      const res = mockResponse();
      coreController.getLanguages({ query: {} }, res);
      languageObject(res).should.deepEqual(languagesObject);
      languageObject(res).lim.should.equal('Limburgish');
      languageObject(res).enm.should.equal('Middle English (1100-1500)');
    });
  });
});
