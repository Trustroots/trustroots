'use strict';

var _ = require('lodash'),
    request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    express = require(path.resolve('./config/lib/express')),
    config = require(path.resolve('./config/config'));

/**
 * Globals
 */
var app,
    agent;

// Demo CSP Violation report
// Doesn't matter what's in here,
// but this is how they generally look:
var cspViolationReport = {
  'csp-report': {
    'document-uri': 'https://trustroots.org/foo/bar',
    'referrer': 'https://www.google.com/',
    'violated-directive': 'default-src self',
    'original-policy': 'default-src self; report-uri /api/report-csp-violation',
    'blocked-uri': 'http://evil.com'
  }
};

/**
 * Core routes tests
 */
describe('Core CRUD tests', function () {

  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  describe('Content Security Policy Tests:', function () {

    it('Responses should have content security policy header', function (done) {
      agent.get('/')
        .expect('content-security-policy', /.*/)
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should have content security policy header with "report-uri" value', function (done) {
      agent.get('/')
        .expect('content-security-policy', /report-uri \/api\/report-csp-violation/)
        .end(function (err) {
          return done(err);
        });
    });

    it('should be able to receive CSP report with "application/json" accept header', function (done) {
      agent.post('/api/report-csp-violation')
        .set('Accept', 'application/json')
        .send(cspViolationReport)
        .expect(204)
        .end(function (err, res) {
          // Handle errors
          if (err) {
            return done(err);
          }

          // Set assertion
          (res.body).should.be.empty;

          return done();
        });
    });

    it('should be able to receive CSP report with "application/csp-report" accept header', function (done) {
      agent.post('/api/report-csp-violation')
        .set('Accept', 'application/csp-report')
        .send(cspViolationReport)
        .expect(204)
        .end(function (err, res) {
          // Handle errors
          if (err) {
            return done(err);
          }

          // Set assertion
          (res.body).should.be.empty;

          return done();
        });
    });
  });

  describe('Expect-CT header Tests:', function () {

    it('Responses should have Expect-CT header', function (done) {
      agent.get('/')
        .expect('expect-ct', /.*/)
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should have Expect-CT header with correct "report-uri" value', function (done) {
      agent.get('/')
        .expect(function (res) {

          var header = _.get(res, 'headers.expect-ct');

          // Build full URI
          var uri = (config.https === true ? 'https' : 'http') +
            '://' +
            config.domain +
            '/api/report-expect-ct-violation';

          // Test URI is as a value of `report-uri` in `expect-ct` header
          if (!header || !_.includes(header, 'report-uri="' + uri + '"')) {
            throw new Error('Expect-CT header does not contain correct report-uri value.');
          }
        })
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should have Expect-CT header with correct "max-age" value', function (done) {
      agent.get('/')
        .expect('expect-ct', /max-age=30/)
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should not have Expect-CT header with "enforce" value', function (done) {
      agent.get('/')
        .expect(function (res) {
          var header = _.get(res, 'headers.expect-ct');

          if (!header || _.includes(header, 'enforce;')) {
            throw new Error('Found "enforce" value');
          }
        })
        .end(function (err) {
          return done(err);
        });
    });

    it('should be able to receive Expect-CT violation report with "application/json" accept header', function (done) {
      agent.post('/api/report-expect-ct-violation')
        .set('Accept', 'application/json')
        .send({ foo: 'bar' })
        .expect(204)
        .end(function (err, res) {
          // Handle errors
          if (err) {
            return done(err);
          }

          // Set assertion
          (res.body).should.be.empty;

          return done();
        });
    });

  });

});
