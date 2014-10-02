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
	name: {
		type: String,
		default: '',
		required: 'Please fill Reference name',
		trim: true
	},
	created: {
		type: Date,
		default: Date.now
	},
	user: {
		type: Schema.ObjectId,
		ref: 'User'
	}
});

mongoose.model('Reference', ReferenceSchema);