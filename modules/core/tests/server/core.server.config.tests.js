'use strict';

/**
 * Module dependencies.
 */
var // should = require('should'),
    mongoose = require('mongoose'),
    path = require('path'),
    request = require('supertest'),
    express = require(path.resolve('./config/lib/express'));

/**
 * Globals
 */
var app,
    agent;

describe('Testing exposing environment as a variable to layout', function () {

  ['development', 'production', 'test'].forEach(function(env) {
    it('should expose environment set to ' + env, function (done) {
      // Set env to development for this test
      process.env.NODE_ENV = env;

      // Get application
      app = express.init(mongoose);
      agent = request.agent(app);

      // Get rendered layout
      agent.get('/')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200)
        .end(function (err, res) {
          // Set env back to test
          process.env.NODE_ENV = 'test';
          // Handle errors
          if (err) {
            return done(err);
          }
          res.text.should.containEql('env = "' + env + '"');
          return done();
        });
    });
  });

});
