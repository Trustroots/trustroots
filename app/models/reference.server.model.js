'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

/**
 * Reference Schema
 */
var ReferenceSchema = new Schema({
	reference: {
		type: String,
		default: '',
		required: 'Please fill reference',
		trim: true
	},
	created: {
		type: Date,
		default: Date.now
	},
	updated: {
		type: Date,
		default: Date.now
	},
	impression: {
		type: String,
		enum: ['','positive','negative'],
		default: ''
	},
	userFrom: {
		type: Schema.ObjectId,
		ref: 'User'
	},
	userTo: {
		type: Schema.ObjectId,
		ref: 'User'
	}
});

mongoose.model('Reference', ReferenceSchema);
