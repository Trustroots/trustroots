'use strict';

/**
 * Module dependencies.
 */
var should = require('should'),
	mongoose = require('mongoose'),
	User = mongoose.model('User'),
	Reference = mongoose.model('Reference');

/**
 * Globals
 */
var userFrom, userTo, reference;

/**
 * Unit tests
 */
describe('Reference Model Unit Tests:', function() {
	beforeEach(function(done) {
		userFrom = new User({
			firstName: 'Full',
			lastName: 'Name From',
			displayName: 'Full Name From',
			email: 'test@test.com',
			username: 'username-from',
			password: 'password'
		});
		userTo = new User({
			firstName: 'Full',
			lastName: 'Name To',
			displayName: 'Full Name To',
			email: 'test-to@test.com',
			username: 'username-to',
			password: 'password'
		});

		userTo.save(function() {
		  userFrom.save(function() {
		  	reference = new Reference({
		  		reference: 'Reference Contents',
		  		userFrom: userFrom,
		  		userTo: userTo
		  	});

		  	done();
		  });
	  });
	});

	describe('Method Save', function() {
		it('should be able to save without problems', function(done) {
			return reference.save(function(err) {
				should.not.exist(err);
				done();
			});
		});

		it('should be able to show an error when try to save without reference contents', function(done) {
			reference.reference = '';

			return reference.save(function(err) {
				should.exist(err);
				done();
			});
		});
	});

	afterEach(function(done) {
		reference.remove().exec();
		userTo.remove().exec();
		userFrom.remove().exec();

		done();
	});
});
