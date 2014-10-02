'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  errorHandler = require('../errors'),
  Message = mongoose.model('Message'),
  Thread = mongoose.model('Thread'),
  User = mongoose.model('User');

/**
 * Send a message
 */
exports.send = function(req, res) {

  var message = new Message(req.body);
  message.userFrom = req.user;

  message.save(function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {

      // Create/upgrade Thread handle between these two users
      var thread = new Thread();
      thread.updated = Date.now();
      thread.userFrom = message.userFrom;
      thread.userTo = message.userTo;
      thread.message = message;

      // Convert the Model instance to a simple object using Model's 'toObject' function
      // to prevent weirdness like infinite looping...
      var upsertData = thread.toObject();

      // Delete the _id property, otherwise Mongo will return a "Mod on _id not allowed" error
      delete upsertData._id;

      // Do the upsert, which works like this: If no Thread document exists with
      // _id = thread.id, then create a new doc using upsertData.
      // Otherwise, update the existing doc with upsertData
      // @link http://stackoverflow.com/a/7855281
      Thread.update({
        // User id's can be either way around in old thread handle, so we gotta test for both situations
        $or: [
          {
            userTo: upsertData.userTo,
            userFrom: upsertData.userFrom
          },
          {
            userTo: upsertData.userFrom,
            userFrom: upsertData.userTo
          }
        ]
      },
      upsertData,
      { upsert: true },
      function(err) {
        if (err) {
          return res.status(400).send({
            message: errorHandler.getErrorMessage(err)
          });
        } /*else {
        res.jsonp(thread);
        }*/
      });

      // Inform socket about new message
	  var socketio = req.app.get('socketio'); // take out socket instance from the app container
      socketio.sockets.emit('message.sent', message); // emit an event for all connected clients

      // Return message
      res.jsonp(message);
    }
  });
};


/**
 * Thread of messages
 * @todo: pagination
 */
exports.thread = function(req, res) {
  res.jsonp(req.messages);
};

/**
 * Thread middleware
 */
exports.threadByUser = function(req, res, next, userId) {
  Message.find(
      {
        $or: [
        { userFrom: req.user._id, userTo: userId },
        { userTo: req.user._id, userFrom: userId }
        ]
      }
    )
    .sort('-created')
    .populate('userFrom', 'displayName')
    .populate('userTo', 'displayName')
    .exec(function(err, messages) {
      if (err) return next(err);
      if (!messages) return next(new Error('Failed to load messages.'));
      req.messages = messages;
      next();
    });
};

/**
 * Show the current message
 */
 /*
exports.read = function(req, res) {
  res.jsonp(req.message);
};
*/

/**
 * Message middleware
 */
/*
exports.messageByID = function(req, res, next, id) {
  Message.findById(id)
    .populate('userFrom', 'displayName')
    .populate('userTo', 'displayName')
    .exec(function(err, message) {
    if (err) return next(err);
    if (!message) return next(new Error('Failed to load message ' + id));
    req.message = message;
    next();
    });
};
*/


/**
 * Update a message
 */
/*
exports.update = function(req, res) {
  var message = req.message;

  message = _.extend(message, req.body);

  message.save(function(err) {
  if (err) {
    return res.status(400).send({
    message: errorHandler.getErrorMessage(err)
    });
  } else {
    res.jsonp(message);
  }
  });
};
*/

/**
 * Delete an message
 */
/*
exports.delete = function(req, res) {
  var message = req.message;

  message.remove(function(err) {
  if (err) {
    return res.status(400).send({
    message: errorHandler.getErrorMessage(err)
    });
  } else {
    res.jsonp(message);
  }
  });
};
*/


