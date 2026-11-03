const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: typeof import('../../../../config/lib/express.mjs').default = require('./../../../../config/lib/express.mjs');
require('should');

/**
 * Globals
 */
let app: import('express').Express;
let agent: ReturnType<typeof request.agent>;

/**
 * Sparkpost routes tests
 */
describe('Sparkpost CRUD tests', function () {
  describe('Webhook endpoint', function () {
    before(function (done) {
      (async () => {
        // Get application
        app = await express.init(mongoose.connection);
        agent = request.agent(app);
        done();
      })().catch(done);
    });
    it('Should not be allowed to access endpoint without credentials', function (done) {
      agent
        .post('/api/sparkpost/webhook')
        .expect(401)
        .end(function (err, res) {
          res.headers['www-authenticate'].should.equal(
            'Basic realm="Knock Knock"',
          );
          res.body.message.should.equal('Access denied');

          // Call the assertion callback
          return done(err);
        });
    });
  });
});
