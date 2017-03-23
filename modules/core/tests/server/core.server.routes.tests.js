'use strict';

var request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    express = require(path.resolve('./config/lib/express'));

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
    app = express.init(mongoose);
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

});
