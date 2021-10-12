const should = require('should');
const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const agenda = require(path.resolve('./config/lib/agenda'));
const testutils = require(path.resolve('./testutils/server/server.testutil'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const Contact = mongoose.model('Contact');

/**
 * Globals
 */
let app;
let agent;
let credentials;
let user1;
let user2;
let user3;
let user4;
let user1Id;
let user2Id;
let user3Id;
let user4Id;
let contact1;
let contact2;
let contact3;
let contact1Id;

/**
 * Contact routes tests
 */
describe('Contact CRUD tests', function () {
  const jobs = testutils.catchJobs();

  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(function (done) {
    // Create userFrom credentials
    credentials = {
      username: 'loremipsum',
      password: 'Password123!',
    };

    // Create a new user
    user1 = new User({
      firstName: 'Full1',
      lastName: 'Name1',
      displayName: 'Full1 Name1',
      email: 'test1@test.com',
      username: credentials.username,
      password: credentials.password,
      provider: 'local',
      public: true,
      additionalProvidersData: {
        facebook: {
          id: '123',
        },
      },
    });

    // Create a new user
    user2 = new User({
      firstName: 'Full2',
      lastName: 'Name2',
      displayName: 'Full2 Name2',
      email: 'test2@test.com',
      username: credentials.username + '2',
      password: credentials.password,
      provider: 'local',
      public: true,
    });

    // Create a new user
    user3 = new User({
      firstName: 'Full3',
      lastName: 'Name3',
      displayName: 'Full3 Name3',
      email: 'test3@test.com',
      username: credentials.username + '3',
      password: credentials.password,
      provider: 'local',
      public: true,
    });

    // Create a new user
    user4 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test4@test.com',
      username: credentials.username + '4',
      password: credentials.password,
      provider: 'local',
      public: true,
    });

    // Set dates to the past to make sure contacts are storted in right order for tests
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const daybefore = new Date();
    daybefore.setDate(daybefore.getDate() - 2);

    // Contacts saved to DB
    contact1 = new Contact({
      created: new Date(),
      confirmed: false,
    });
    contact2 = new Contact({
      created: yesterday,
      confirmed: true,
    });
    contact3 = new Contact({
      created: daybefore,
      confirmed: true,
    });

    // Save user to the test db
    user1.save(function (err, user1SaveRes) {
      should.not.exist(err);
      user1Id = user1SaveRes._id;
      user1 = user1SaveRes;
      user2.save(function (err, user2SaveRes) {
        should.not.exist(err);
        user2Id = user2SaveRes._id;
        user2 = user2SaveRes;
        user3.save(function (err, user3SaveRes) {
          should.not.exist(err);
          user3Id = user3SaveRes._id;
          user3 = user3SaveRes;
          user4.save(function (err, user4SaveRes) {
            should.not.exist(err);
            user4Id = user4SaveRes._id;
            user4 = user4SaveRes;

            // Connection A: Users 1+2, un-confirmed
            contact1.userFrom = user2Id;
            contact1.userTo = user1Id;

            // Connection B: Users 2+3, confirmed
            contact2.userFrom = user2Id;
            contact2.userTo = user3Id;

            // Connection C: Users 1+3, confirmed
            contact3.userFrom = user1Id;
            contact3.userTo = user3Id;

            contact1.save(function (err, contact1SaveRes) {
              should.not.exist(err);
              contact1Id = contact1SaveRes._id;
              contact2.save(function (err) {
                should.not.exist(err);
                contact3.save(function (err) {
                  should.not.exist(err);
                  return done();
                });
              });
            });
          });
        });
      });
    });
  });

  afterEach(utils.clearDatabase);

  it('should not be able to read contact list if not logged in', function (done) {
    agent
      .get('/api/contacts/' + user2Id)
      .expect(403)
      .end(function (contactsReadErr, contactsReadRes) {
        contactsReadRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(contactsReadErr);
      });
  });

  it('should not be able to read common contacts list if not logged in', function (done) {
    agent
      .get('/api/contacts/' + user2Id + '/common')
      .expect(403)
      .end(function (contactSaveErr, contactSaveRes) {
        contactSaveRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(contactSaveErr);
      });
  });

  it('should not be able to delete contact if not logged in', function (done) {
    agent
      .delete('/api/contact/' + contact1Id)
      .expect(403)
      .end(function (contactDelErr, contactDelRes) {
        // Handle contact del error
        if (contactDelErr) return done(contactDelErr);

        contactDelRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done();
      });
  });

  context('logged in', function () {
    beforeEach(function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials) // = user 1
        .expect(200)
        .end(function (signinErr) {
          done(signinErr);
        });
    });

    it('should be able to get a contact by user id', function (done) {
      // Get the contact for User1 -> User2 : Contact1
      agent
        .get('/api/contact-by/' + user2Id)
        .expect(200)
        .end(function (contactByErr, contactByRes) {
          // Handle contact by error
          if (contactByErr) return done(contactByErr);

          const contact = contactByRes.body;

          contact._id.should.equal(contact1Id.toString());

          // Connection A: Users 1+2, un-confirmed
          contact.confirmed.should.equal(false);
          contact.created.should.not.be.empty();
          contact.userFrom.username.should.equal(user2.username);
          contact.userTo.username.should.equal(user1.username);

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to read contact list and get correct fields for user', function (done) {
      // Get contacts from the other user
      agent
        .get('/api/contacts/' + user3Id)
        .expect(200)
        .end(function (contactsGetErr, contactsGetRes) {
          // Handle contact get error
          if (contactsGetErr) return done(contactsGetErr);

          // MongoDb returns these in random order as the query isn't sorted
          // figure out order here
          const user1Order =
            contactsGetRes.body[0].user.username === user1.username ? 0 : 1;

          // Set assertions
          contactsGetRes.body[user1Order].user._id.should.equal(
            user1._id.toString(),
          );
          contactsGetRes.body[user1Order].user.username.should.equal(
            user1.username,
          );
          contactsGetRes.body[user1Order].user.avatarSource.should.equal(
            user1.avatarSource,
          );
          contactsGetRes.body[user1Order].user.emailHash.should.equal(
            user1.emailHash,
          );
          contactsGetRes.body[user1Order].user.displayName.should.equal(
            user1.displayName,
          );
          contactsGetRes.body[user1Order].user.avatarUploaded.should.equal(
            user1.avatarUploaded,
          );
          contactsGetRes.body[user1Order].user.emailHash.should.equal(
            user1.emailHash,
          );
          contactsGetRes.body[
            user1Order
          ].user.additionalProvidersData.facebook.id.should.equal(
            user1.additionalProvidersData.facebook.id,
          );

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to read contact list of other users', function (done) {
      // Get contacts from the other user
      agent
        .get('/api/contacts/' + user3Id)
        .expect(200)
        .end(function (contactsGetErr, contactsGetRes) {
          // Handle contact get error
          if (contactsGetErr) return done(contactsGetErr);

          // Set assertions
          contactsGetRes.body.length.should.equal(2);

          // MongoDb returns these in random order as the query isn't sorted
          // figure out order here
          let connectionA = 0;
          let connectionB = 1;
          if (contactsGetRes.body[0].user.username === user1.username) {
            connectionA = 1;
            connectionB = 0;
          }

          // Connection B: Users 2+3, confirmed
          contactsGetRes.body[connectionA].confirmed.should.equal(true);
          contactsGetRes.body[connectionA].created.should.not.be.empty();
          contactsGetRes.body[connectionA].user.username.should.equal(
            user2.username,
          );
          contactsGetRes.body[connectionA].userFrom.should.equal(
            user2Id.toString(),
          );
          contactsGetRes.body[connectionA].userTo.should.equal(
            user3Id.toString(),
          );

          // Connection C: Users 1+3, confirmed
          contactsGetRes.body[connectionB].confirmed.should.equal(true);
          contactsGetRes.body[connectionB].created.should.not.be.empty();
          contactsGetRes.body[connectionB].user.username.should.equal(
            user1.username,
          );
          contactsGetRes.body[connectionB].userFrom.should.equal(
            user1Id.toString(),
          );
          contactsGetRes.body[connectionB].userTo.should.equal(
            user3Id.toString(),
          );

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to read own contact list and see unconfirmed contacts', function (done) {
      // Get contacts from the other user
      agent
        .get('/api/contacts/' + user1Id)
        .expect(200)
        .end(function (contactsGetErr, contactsGetRes) {
          // Handle contact get error
          if (contactsGetErr) return done(contactsGetErr);

          // Set assertions
          contactsGetRes.body.length.should.equal(2);

          // MongoDb returns these in random order as the query isn't sorted
          // figure out order here
          let connectionA = 1;
          let connectionB = 0;
          if (contactsGetRes.body[0].user.username === user2.username) {
            connectionA = 0;
            connectionB = 1;
          }

          // Connection A: Users 1+2, un-confirmed
          contactsGetRes.body[connectionA].confirmed.should.equal(false);
          contactsGetRes.body[connectionA].created.should.not.be.empty();
          contactsGetRes.body[connectionA].user.username.should.equal(
            user2.username,
          );
          contactsGetRes.body[connectionA].userFrom.should.equal(
            user2Id.toString(),
          );
          contactsGetRes.body[connectionA].userTo.should.equal(
            user1Id.toString(),
          );

          // Connection C: Users 1+3, confirmed
          contactsGetRes.body[connectionB].confirmed.should.equal(true);
          contactsGetRes.body[connectionB].created.should.not.be.empty();
          contactsGetRes.body[connectionB].user.username.should.equal(
            user3.username,
          );
          contactsGetRes.body[connectionB].userFrom.should.equal(
            user1Id.toString(),
          );
          contactsGetRes.body[connectionB].userTo.should.equal(
            user3Id.toString(),
          );

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to read my own common contacts list', function (done) {
      // Get contacts from the authenticated user
      agent
        .get('/api/contacts/' + user1Id + '/common')
        .expect(200)
        .end(function (contactsGetErr, contactsGetRes) {
          // Handle contact get error
          if (contactsGetErr) return done(contactsGetErr);

          // Set assertions
          contactsGetRes.body.length.should.equal(1);
          contactsGetRes.body[0].userFrom.should.equal(user1Id.toString());
          contactsGetRes.body[0].userTo.should.equal(user3Id.toString());
          contactsGetRes.body[0].user._id.should.equal(user3Id.toString());

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to read common contacts list', function (done) {
      // Get contacts from the other user
      agent
        .get('/api/contacts/' + user2Id + '/common')
        .expect(200)
        .end(function (contactsGetErr, contactsGetRes) {
          // Handle contact get error
          if (contactsGetErr) return done(contactsGetErr);

          // Set assertions
          contactsGetRes.body.length.should.equal(1);
          contactsGetRes.body[0].userFrom.should.equal(user2Id.toString());
          contactsGetRes.body[0].userTo.should.equal(user3Id.toString());
          contactsGetRes.body[0].user._id.should.equal(user3Id.toString());

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to create a new unconfirmed contact', function (done) {
      // Create a contact User1 -> User4
      agent
        .post('/api/contact')
        .send({ friendUserId: user4Id })
        .expect(200)
        .end(function (contactAddErr, contactAddRes) {
          // Handle contact add error
          if (contactAddErr) return done(contactAddErr);

          contactAddRes.body.message.should.equal(
            'An email was sent to your contact.',
          );

          // Jobs contains sent "confirm contact" email
          jobs.length.should.equal(1);
          jobs[0].data.subject.should.equal('Confirm contact');
          jobs[0].data.to.address.should.equal(user4.email);

          // Get the contact for User4 that we just created
          agent
            .get('/api/contact-by/' + user4Id)
            .expect(200)
            .end(function (contactByErr, contactByRes) {
              // Handle contact by error
              if (contactByErr) return done(contactByErr);

              const contact = contactByRes.body;

              // User4 should be an unconfirmed contact now
              should.exist(contact);
              contact.confirmed.should.equal(false);
              contact.created.should.not.be.empty();
              contact.userFrom.username.should.equal(user1.username);
              contact.userTo.username.should.equal(user4.username);

              // Call the assertion callback
              return done();
            });
        });
    });

    it('should not be able to create a duplicate contact', function (done) {
      // Try and create a contact User1 -> User2
      agent
        .post('/api/contact')
        .send({ friendUserId: user2Id })
        .expect(409)
        .end(function (contactAddErr) {
          // Handle contact add error
          if (contactAddErr) return done(contactAddErr);
          return done();
        });
    });

    it('should be able to confirm a contact', function (done) {
      // Confirm the un-confirmed Contact1 between User1 -> User2
      agent
        .put('/api/contact/' + contact1Id)
        .expect(200)
        .end(function (contactConfirmErr, contactConfirmRes) {
          // Handle contact confirm error
          if (contactConfirmErr) return done(contactConfirmErr);

          const confirmedContact = contactConfirmRes.body;

          should.exist(confirmedContact);
          confirmedContact.confirmed.should.equal(true);
          confirmedContact.created.should.not.be.empty();
          confirmedContact.userFrom.username.should.equal(user2.username);
          confirmedContact.userTo.username.should.equal(user1.username);

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to delete contact', function (done) {
      agent
        .delete('/api/contact/' + contact1Id)
        .expect(200)
        .end(function (contactDelErr) {
          // Handle contact del error
          if (contactDelErr) return done(contactDelErr);

          // The contact should be gone now
          agent
            .get('/api/contact-by/' + user2Id)
            .expect(404)
            .end(function (contactByErr, contactByRes) {
              // Handle contact by error
              if (contactByErr) return done(contactByErr);

              contactByRes.body.message.should.equal('Not found.');

              // Call the assertion callback
              return done();
            });
        });
    });

    context('with email sending error', function () {
      let originalNow;

      beforeEach(function () {
        // Set the agenda.now() function to fail
        originalNow = agenda.now;
        agenda.now = function (type, data, callback) {
          process.nextTick(function () {
            callback(new Error('fail!'));
          });
        };
      });

      afterEach(function () {
        agenda.now = originalNow;
      });

      it('should fail to create contact', function (done) {
        // Try and create a contact User1 -> User4
        agent
          .post('/api/contact')
          .send({ friendUserId: user4Id })
          .expect(400)
          .end(function (contactAddErr, contactAddRes) {
            // Handle contact add error
            if (contactAddErr) return done(contactAddErr);

            contactAddRes.body.message.should.equal(
              'Snap! Something went wrong. If this keeps happening, please contact us.',
            );

            // No contact should have been created
            agent
              .get('/api/contact-by/' + user4Id)
              .expect(404)
              .end(done);
          });
      });
    });
  });
});
