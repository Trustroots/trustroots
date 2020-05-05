const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const config = require(path.resolve('./config/config'));

/**
 * Globals
 */
let app;
let agent;
let events;

/**
 * Sparkpost routes tests
 */
describe('Sparkpost CRUD tests', function () {
  describe('Webhook endpoint', function () {
    before(function (done) {
      // Get application
      app = express.init(mongoose.connection);
      agent = request.agent(app);

      // Sparkpost webhook event example
      events = [
        {
          msys: {
            message_event: {
              type: 'delivery',
              campaign_id: 'example',
              timestamp: '1454442600',
            },
          },
        },
      ];

      done();
    });

    it('Should not be able to request using GET method', function (done) {
      agent.get('/api/sparkpost/webhook').expect(404).end(done);
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

    it('Should not be allowed to access endpoint with wrong credentials', function (done) {
      agent
        .post('/api/sparkpost/webhook')
        .auth('wrong', 'wrong')
        .expect(401)
        .end(done);
    });

    it('Should be allowed to access endpoint with credentials', function (done) {
      agent
        .post('/api/sparkpost/webhook')
        .auth(
          config.sparkpostWebhook.username,
          config.sparkpostWebhook.password,
        )
        .send(events)
        .expect(200)
        .end(done);
    });
  });
});
