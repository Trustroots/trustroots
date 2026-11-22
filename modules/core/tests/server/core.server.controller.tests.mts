import { vi } from 'vitest';
import sinon from 'sinon';
import mongoose from 'mongoose';
import winston from 'winston';
import userProfile from './../../../users/server/controllers/users.profile.server.controller.mts';
import languagesObject from './../../../../config/languages/languages.json' with { type: 'json' };
import languagesArray from './../../../../config/languages/languages-array.json' with { type: 'json' };
import deprecatedLanguages from './../../../../config/languages/deprecated.mts';
import assert from 'node:assert/strict';
import should from 'should';
import coreController from './../../server/controllers/core.server.controller.mts';

type UserServerModel =
  import('../../../users/server/models/user.server.types.mts').UserServerModel;
type UserServerRecord =
  import('../../../users/server/models/user.server.types.mts').UserServerRecord;
const User = mongoose.model<UserServerRecord, UserServerModel>('User');

const sanitizeOwnProfile = (user: { username: string }) => ({
  sanitized: true,
  username: user.username,
});

type MockResponse = {
  statusCode: number;
  body: unknown;
  rendered: string;
  renderVars: Record<string, unknown> | undefined;
  headers: Record<string, string>;
  locals: { nonce: string };
  renderError: Error | null;
  status: (code: number) => MockResponse;
  format: (
    handlers: Record<string, () => void> & { default: () => void },
  ) => MockResponse;
  json: (value?: unknown) => MockResponse;
  send: (value: unknown) => MockResponse;
  render: (
    view: string,
    vars?: Record<string, unknown>,
    callback?: (error: Error | null, html: string) => void,
  ) => MockResponse;
  set: (key: string, value: string) => MockResponse;
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
    locals: { nonce: 'test-nonce' },
    renderError: null,

    status(code: number) {
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
    json(value) {
      res.body = value === undefined ? null : value;
      return res;
    },
    send(value) {
      res.body = value;
      return res;
    },
    render(view, vars, callback) {
      res.rendered = view;
      res.renderVars = vars;
      callback?.(res.renderError, '<title>Rendered head</title>');
      return res;
    },
    set(key, value) {
      res.headers[key] = value;
      return res;
    },
  };
  return res;
}

describe('Controller: core', function () {
  beforeEach(function () {
    sinon
      .stub(userProfile, 'sanitizeOwnProfile')
      .callsFake(sanitizeOwnProfile as never);
  });

  afterEach(function () {
    sinon.restore();
    vi.unstubAllEnvs();
  });
  describe('renderIndex', function () {
    const fail = (error: unknown) => {
      throw error;
    };

    it('sends the Start shell with the rendered head and script nonces', async function () {
      const res = mockResponse();
      await coreController.renderIndex({ path: '/' }, res, fail);
      // A local client build replaces the empty test shell.
      assert.match(
        String(res.body),
        /^<!DOCTYPE html><html lang="en"><head><title>Rendered head<\/title>/,
      );
      assert.doesNotMatch(String(res.body), /<script(?! nonce="test-nonce")/);
    });

    it('passes template errors to the next handler', async function () {
      const res = mockResponse();
      const error = new Error('template failed');
      res.renderError = error;
      const next = sinon.spy();
      await coreController.renderIndex({ path: '/' }, res, next);
      sinon.assert.calledOnceWithExactly(next, error);
      should(res.body).be.null();
    });

    it('renders anonymous visitors with only an empty user', async function () {
      const res = mockResponse();
      await coreController.renderIndex(
        { path: '/definitely-not-a-route' },
        res,
        fail,
      );
      res.rendered.should.equal('index');
      assert.deepStrictEqual(renderVars(res), { user: null });
    });

    it('marks the signup page as an invite', async function () {
      const res = mockResponse();
      await coreController.renderIndex({ path: '/signup' }, res, fail);
      res.rendered.should.equal('index');
      should(renderVars(res).invite).be.true();
    });

    it('renders the React index for redirecting, guarded and unknown paths', async function () {
      for (const path of ['/about', '/admin', '/definitely-not-a-route']) {
        const res = mockResponse();
        await coreController.renderIndex({ path }, res, fail);
        res.rendered.should.equal('index');
      }
    });

    it('exposes a sanitized user profile when signed in', async function () {
      const res = mockResponse();
      const user = new User({
        username: 'alice',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Example',
        provider: 'local',
      });
      user.set('roles', undefined);
      await coreController.renderIndex({ path: '/', user }, res, fail);
      should(renderVars(res).user).deepEqual({
        sanitized: true,
        username: 'alice',
      });
    });

    it('exposes the current user roles without the flagged role', async function () {
      const res = mockResponse();
      const user = new User({
        username: 'alice',
        email: 'alice@example.com',
        firstName: 'Alice',
        lastName: 'Example',
        provider: 'local',
        roles: ['user', 'flagged', 'admin'],
      });
      await coreController.renderIndex({ path: '/', user }, res, fail);
      should(renderVars(res).user).deepEqual({
        sanitized: true,
        username: 'alice',
        roles: ['user', 'admin'],
      });
    });

    it('exposes the current tribe when browsing a tribe page', async function () {
      const tribe = { slug: 'test-tribe', label: 'Test Tribe' };
      const res = mockResponse();
      await coreController.renderIndex(
        { path: '/tribes/test-tribe', tribe },
        res,
        fail,
      );
      should(renderVars(res).tribe).equal(tribe);
    });
  });

  describe('renderNotFound', function () {
    const fail = (error: unknown) => {
      throw error;
    };

    it('returns a JSON not-found message', function () {
      const res = mockResponse('application/json');
      coreController.renderNotFound({ path: '/api/nope' }, res, fail);
      res.statusCode.should.equal(404);
      should(responseMessage(res)).equal('Not found.');
    });

    it('sends the app with status 404 for text/html requests', async function () {
      const res = mockResponse('text/html');
      coreController.renderNotFound({ path: '/api/nope' }, res, fail);
      await vi.waitFor(() =>
        assert.match(String(res.body), /^<!DOCTYPE html>/),
      );
      res.statusCode.should.equal(404);
      res.rendered.should.equal('index');
    });

    it('forwards shell loading errors from HTML requests to Express', async function () {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('TRUSTROOTS_VITE_DEV_SERVER', 'true');
      const error = new Error('shell failed to load');
      sinon.stub(globalThis, 'fetch').rejects(error);
      const res = mockResponse('text/html');
      const next = sinon.spy();

      coreController.renderNotFound({ path: '/api/nope' }, res, next);

      await vi.waitFor(() => sinon.assert.calledOnceWithExactly(next, error));
      res.rendered.should.equal('');
      should(res.body).be.null();
    });

    it('forwards errors thrown while starting the HTML render', async function () {
      const error = new Error('render setup failed');
      const res = mockResponse('text/html');
      sinon.stub(res, 'render').throws(error);
      const next = sinon.spy();

      coreController.renderNotFound({ path: '/api/nope' }, res, next);

      await vi.waitFor(() => sinon.assert.calledOnceWithExactly(next, error));
      should(res.body).be.null();
    });

    it('sends a plain message for other content types', function () {
      const res = mockResponse();
      coreController.renderNotFound({ path: '/api/nope' }, res, fail);
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

    function captureLogs(run: () => void): unknown[][] {
      const originalLog = winston.log;
      const calls: unknown[][] = [];
      winston.log = ((...args: unknown[]) => {
        calls.push(args);
        return winston;
      }) as unknown as typeof winston.log;
      try {
        run();
      } finally {
        winston.log = originalLog;
      }
      return calls.filter(
        ([, event]) => event === 'CSP violation report #ljeanw',
      );
    }

    // The logger redacts every `report` value, so the placeholder for a
    // missing body is not visible; the warning itself is.
    it('logs a redacted warning when no report body is present', function () {
      const res = mockResponse();
      const reports = captureLogs(() =>
        coreController.receiveCSPViolationReport({ body: null }, res),
      );
      res.statusCode.should.equal(204);
      should(reports).deepEqual([
        ['warn', 'CSP violation report #ljeanw', { report: '[REDACTED]' }],
      ]);
    });

    it('does not log reports in test mode', function () {
      process.env.NODE_ENV = 'test';

      const res = mockResponse();
      const reports = captureLogs(() =>
        coreController.receiveCSPViolationReport({ body: { foo: 'bar' } }, res),
      );
      res.statusCode.should.equal(204);
      should(reports).deepEqual([]);
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

    it('returns the languages object without a query or request', function () {
      const withoutQuery = mockResponse();
      coreController.getLanguages({}, withoutQuery);
      languageObject(withoutQuery).should.deepEqual(languagesObject);
      const withoutRequest = mockResponse();
      coreController.getLanguages(undefined, withoutRequest);
      languageObject(withoutRequest).should.deepEqual(languagesObject);
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
