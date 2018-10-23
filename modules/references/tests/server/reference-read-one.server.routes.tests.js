'use strict';

var mongoose = require('mongoose'),
    path = require('path'),
    request = require('supertest'),
    express = require(path.resolve('./config/lib/express'));

describe('Read a single reference by reference id', function () {
  // GET /references/:referenceId
  // logged in public user can read a single public reference by id
  // .....                 can read a single private reference if it is from self
  // logged in public user can not read other private references
  var app = express.init(mongoose.connection);
  var agent = request.agent(app);

  context('logged in as public user', function () {

    it('read a single public reference by id', function (done) {
      agent
        .get('/api/references/0123456789ab0123456789ab')
        .expect(200)
        .end(done);
      // @TODO the test is not implemented!
    });

    it('read a single private reference if it is from self');
    it('can not read private references other than from self');
    it('[invalid referenceId] 400');
  });

  context('logged in as non-public user', function () {
    it('403');
  });

  context('not logged in', function () {
    it('403');
  });
});
