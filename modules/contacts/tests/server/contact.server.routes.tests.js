'use strict';

var should = require('should'),
    request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Contact = mongoose.model('Contact'),
    stubTransport = require('nodemailer-stub-transport'),
    config = require(path.resolve('./config/config')),
    express = require(path.resolve('./config/lib/express')),
    testutils = require(path.resolve('./testutils'));


/**
 * Globals
 */
var app,
    agent,
    credentials,
    user1,
    user2,
    user3,
    user4,
    user1Id,
    user2Id,
    user3Id,
    user4Id,
    contact1,
    contact2,
    contact3,
    contact1Id,
    contact2Id,
    contact3Id;

/**
 * Contact routes tests
 */
describe('Contact CRUD tests', function() {

  var sentEmails = testutils.catchEmails();

  before(function(done) {
    // Get application
    app = express.init(mongoose);
    agent = request.agent(app);

    done();
  });

  beforeEach(function(done) {
    // Create userFrom credentials
    credentials = {
      username: 'loremipsum',
      password: 'Password123!'
    };

    // Create a new user
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: credentials.username,
      password: credentials.password,
      provider: 'local',
      public: true
    });

    // Create a new user
    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: credentials.username + '2',
      password: credentials.password,
      provider: 'local',
      public: true
    });

    // Create a new user
    user3 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test3@test.com',
      username: credentials.username + '3',
      password: credentials.password,
      provider: 'local',
      public: true
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
      public: true
    });

    // Set dates to the past to make sure contacts are storted in right order for tests
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    var daybefore = new Date();
    daybefore.setDate(daybefore.getDate() - 2);

    // Contacts saved to DB
    contact1 = new Contact({
      users: [],
      created: new Date(),
      confirmed: false
    });
    contact2 = new Contact({
      users: [],
      created: yesterday,
      confirmed: true
    });
    contact3 = new Contact({
      users: [],
      created: daybefore,
      confirmed: true
    });

    // Save user to the test db
    user1.save(function(err, user1SaveRes) {
      user1Id = user1SaveRes._id;
      user2.save(function(err, user2SaveRes) {
        user2Id = user2SaveRes._id;
        user3.save(function(err, user3SaveRes) {
          user3Id = user3SaveRes._id;
          user4.save(function(err, user4SaveRes) {
            user4Id = user4SaveRes._id;
            contact1.users = [user1Id, user2Id]; // Connection A: Users 1+2, un-confirmed
            contact2.users = [user2Id, user3Id]; // Connection B: Users 2+3, confirmed
            contact3.users = [user1Id, user3Id]; // Connection C: Users 1+3, confirmed
            contact1.save(function(err, contact1SaveRes) {
              contact1Id = contact1SaveRes._id;
              contact2.save(function(err, contact2SaveRes) {
                contact2Id = contact2SaveRes._id;
                contact3.save(function(err, contact3SaveRes) {
                  contact3Id = contact3SaveRes._id;
                  return done();
                });
              });
            });
          });
        });
      });
    });
  });

  it('should not be able to read contact list if not logged in', function(done) {
    agent.get('/api/contacts/' + user2Id)
      .expect(403)
      .end(function(contactsReadErr, contactsReadRes) {

        contactsReadRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(contactsReadErr);
      });
  });

  it('should not be able to read contact list if not logged in', function(done) {
    agent.get('/api/contacts/' + user2Id)
      .expect(403)
      .end(function(contactSaveErr, contactSaveRes) {

        contactSaveRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(contactSaveErr);
      });
  });

  it('should not be able to delete contact if not logged in', function(done) {
    agent.delete('/api/contact/' + contact1Id)
      .expect(403)
      .end(function(contactDelErr, contactDelRes) {
        // Handle contact del error
        if (contactDelErr) return done(contactDelErr);

        contactDelRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done();
      });
  });

  context('logged in', function() {

    beforeEach(function(done) {

      agent.post('/api/auth/signin')
        .send(credentials) // = user 1
        .expect(200)
        .end(function(signinErr, signinRes) {
          done(signinErr);
        });

    });

    it('should be able to get a contact by user id', function(done) {
      // Get the contact for User1 -> User2 : Contact1
      agent.get('/api/contact-by/' + user2Id)
        .expect(200)
        .end(function(contactByErr, contactByRes) {
          // Handle contact by error
          if (contactByErr) return done(contactByErr);

          var contact = contactByRes.body;

          contact._id.should.equal(contact1Id.toString());

          // Connection A: Users 1+2, un-confirmed
          contact.confirmed.should.equal(false);
          contact.created.should.not.be.empty();
          contact.users[0].username.should.equal(user1.username);
          contact.users[1].username.should.equal(user2.username);

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to read contact list of other users', function(done) {
      // Get contacts from the other user
      agent.get('/api/contacts/' + user3Id)
        .expect(200)
        .end(function(contactsGetErr, contactsGetRes) {
          // Handle contact get error
          if (contactsGetErr) return done(contactsGetErr);

          // Set assertions
          contactsGetRes.body.length.should.equal(2);

          // Connection B: Users 2+3, confirmed
          contactsGetRes.body[0].confirmed.should.equal(true);
          contactsGetRes.body[0].created.should.not.be.empty();
          contactsGetRes.body[0].users[0].username.should.equal(user2.username);
          contactsGetRes.body[0].users[1].username.should.equal(user3.username);

          // Connection C: Users 1+3, confirmed
          contactsGetRes.body[1].confirmed.should.equal(true);
          contactsGetRes.body[1].created.should.not.be.empty();
          contactsGetRes.body[1].users[0].username.should.equal(user1.username);
          contactsGetRes.body[1].users[1].username.should.equal(user3.username);

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to read own contact list and see unconfirmed contacts', function(done) {
      // Get contacts from the other user
      agent.get('/api/contacts/' + user1Id)
        .expect(200)
        .end(function(contactsGetErr, contactsGetRes) {
          // Handle contact get error
          if (contactsGetErr) return done(contactsGetErr);

          // Set assertions
          contactsGetRes.body.length.should.equal(2);

          // Connection A: Users 1+2, un-confirmed
          contactsGetRes.body[0].confirmed.should.equal(false);
          contactsGetRes.body[0].created.should.not.be.empty();
          contactsGetRes.body[0].users[0].username.should.equal(user1.username);
          contactsGetRes.body[0].users[1].username.should.equal(user2.username);

          // Connection C: Users 1+3, confirmed
          contactsGetRes.body[1].confirmed.should.equal(true);
          contactsGetRes.body[1].created.should.not.be.empty();
          contactsGetRes.body[1].users[0].username.should.equal(user1.username);
          contactsGetRes.body[1].users[1].username.should.equal(user3.username);

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to create a new unconfirmed contact', function(done) {
      // Create a contact User1 -> User4
      agent.post('/api/contact')
        .send({ friendUserId: user4Id })
        .expect(200)
        .end(function(contactAddErr, contactAddRes) {
          // Handle contact add error
          if (contactAddErr) return done(contactAddErr);

          contactAddRes.body.message.should.equal('An email was sent to your contact.');

          sentEmails.length.should.equal(1);
          sentEmails[0].data.subject.should.equal('Confirm contact');
          sentEmails[0].data.to.address.should.equal(user4.email);

          // Get the contact for User4 that we just created
          agent.get('/api/contact-by/' + user4Id)
            .expect(200)
            .end(function(contactByErr, contactByRes) {
              // Handle contact by error
              if (contactByErr) return done(contactByErr);

              var contact = contactByRes.body;

              // User4 should be an unconfirmed contact now
              should.exist(contact);
              contact.confirmed.should.equal(false);
              contact.created.should.not.be.empty();
              contact.users[0].username.should.equal(user4.username);
              contact.users[1].username.should.equal(user1.username);

              // Call the assertion callback
              return done();
            });

        });
    });

    it('should not be able to create a duplicate contact', function(done) {
      // Try and create a contact User1 -> User2
      agent.post('/api/contact')
        .send({ friendUserId: user2Id })
        .expect(409)
        .end(function(contactAddErr, contactAddRes) {
          // Handle contact add error
          if (contactAddErr) return done(contactAddErr);
          return done();
        });
    });

    it('should be able to confirm a contact', function(done) {
      // Confirm the un-confirmed Contact1 between User1 -> User2
      agent.put('/api/contact/' + contact1Id)
        .expect(200)
        .end(function(contactConfirmErr, contactConfirmRes) {
          // Handle contact confirm error
          if (contactConfirmErr) return done(contactConfirmErr);

          var confirmedContact = contactConfirmRes.body;

          should.exist(confirmedContact);
          confirmedContact.confirmed.should.equal(true);
          confirmedContact.created.should.not.be.empty();
          confirmedContact.users[0].username.should.equal(user1.username);
          confirmedContact.users[1].username.should.equal(user2.username);

          // Call the assertion callback
          return done();
        });

    });

    it('should be able to delete contact', function(done) {
      agent.delete('/api/contact/' + contact1Id)
        .expect(200)
        .end(function(contactDelErr, contactDelRes) {
          // Handle contact del error
          if (contactDelErr) return done(contactDelErr);

          // The contact should be gone now
          agent.get('/api/contact-by/' + user2Id)
            .expect(404)
            .end(function(contactByErr, contactByRes) {
              // Handle contact by error
              if (contactByErr) return done(contactByErr);

              contactByRes.body.message.should.equal('Not found.');

              // Call the assertion callback
              return done();
            });

        });
    });

    context('with email sending error', function() {

      var originalMailerOptions;

      beforeEach(function() {
        // Set the mail sending to fail
        originalMailerOptions = config.mailer.options;
        config.mailer.options = stubTransport({
          error: new Error('fail!')
        });
      });

      afterEach(function() {
        config.mailer.options = originalMailerOptions;
      });

      it('should fail to create contact', function(done) {
        // Try and create a contact User1 -> User4
        agent.post('/api/contact')
          .send({ friendUserId: user4Id })
          .expect(400)
          .end(function(contactAddErr, contactAddRes) {
            // Handle contact add error
            if (contactAddErr) return done(contactAddErr);

            contactAddRes.body.message.should.equal('Snap! Something went wrong. If this keeps happening, please contact us.');

            // No contact should have been created
            agent.get('/api/contact-by/' + user4Id)
              .expect(404)
              .end(done);

          });
      });

    });

  });

  afterEach(function(done) {
    // Uggggly pyramid revenge!
    User.remove().exec(function() {
      Contact.remove().exec(done);
    });
  });
});
