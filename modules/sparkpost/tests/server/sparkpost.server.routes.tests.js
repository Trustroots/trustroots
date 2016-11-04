'use strict';

var request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    express = require(path.resolve('./config/lib/express')),
    config = require(path.resolve('./config/config'));

/**
 * Globals
 */
var app,
    agent,
    events;

/**
 * Sparkpost routes tests
 */
describe('Sparkpost CRUD tests', function() {

  describe('Webhook endpoint', function() {

    before(function(done) {
      // Get application
      app = express.init(mongoose);
      agent = request.agent(app);

      // Sparkpost webhook event example
      events = [
        {
          'msys': {
            'message_event': {
              'type': 'delivery',
              'campaign_id': 'Example Campaign Name',
              'customer_id': '1',
              'delv_method': 'esmtp',
              'device_token': '45c19189783f867973f6e6a5cca60061ffe4fa77c547150563a1192fa9847f8a',
              'event_id': '92356927693813856',
              'friendly_from': 'sender@example.com',
              'ip_address': '127.0.0.1',
              'ip_pool': 'Example-Ip-Pool',
              'message_id': '000443ee14578172be22',
              'msg_from': 'sender@example.com',
              'msg_size': '1337',
              'num_retries': '2',
              'queue_time': '12',
              'rcpt_meta': {
                'customKey': 'customValue'
              },
              'rcpt_tags': [
                'male',
                'US'
              ],
              'rcpt_to': 'recipient@example.com',
              'raw_rcpt_to': 'recipient@example.com',
              'rcpt_type': 'cc',
              'routing_domain': 'example.com',
              'sending_ip': '127.0.0.1',
              'subaccount_id': '101',
              'subject': 'Summer deals are here!',
              'sms_coding': 'ASCII',
              'sms_dst': '7876712656',
              'sms_dst_npi': 'E164',
              'sms_dst_ton': 'International',
              'sms_remoteids': [
                '0000',
                '0001',
                '0002',
                '0003',
                '0004'
              ],
              'sms_segments': 5,
              'sms_src': '1234',
              'sms_src_npi': 'E164',
              'sms_src_ton': 'Unknown',
              'template_id': 'templ-1234',
              'template_version': '1',
              'timestamp': '1454442600',
              'transmission_id': '65832150921904138'
            }
          }
        }
      ];

      done();
    });

    it('Should not be able to request using GET method', function(done) {
      agent.get('/api/sparkpost/webhook')
        .expect(404)
        .end(done);
    });

    it('Should not be allowed to access endpoint without credentials', function(done) {
      agent.post('/api/sparkpost/webhook')
        .expect(401)
        .end(function(err, res) {

          res.headers['www-authenticate'].should.equal('Basic realm="Knock Knock"');
          res.body.message.should.equal('Access denied');

          // Call the assertion callback
          return done(err);
        });
    });

    it('Should not be allowed to access endpoint with wrong credentials', function(done) {
      agent.post('/api/sparkpost/webhook')
        .auth('wrong', 'wrong')
        .expect(401)
        .end(done);
    });

    it('Should be allowed to access endpoint with credentials', function(done) {
      agent.post('/api/sparkpost/webhook')
        .auth(config.sparkpostWebhook.username, config.sparkpostWebhook.password)
        .send(events)
        .expect(200)
        .end(done);
    });

  });

});
