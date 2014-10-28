'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  errorHandler = require('./errors'),
  sanitizeHtml = require('sanitize-html'),
  Message = mongoose.model('Message'),
  Thread = mongoose.model('Thread'),
  User = mongoose.model('User');


/**
 * Rules for sanitizing messages coming in and out
 * @link https://github.com/punkave/sanitize-html
 */
var messageSanitizeOptions = {
    allowedTags: [ 'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'li', 'ul', 'ol', 'blockquote', 'code', 'pre' ],
    allowedAttributes: {
      'a': [ 'href' ],
      // We don't currently allow img itself, but this would make sense if we did:
      //'img': [ 'src' ]
    },
    selfClosing: [ 'img', 'br' ],
    // URL schemes we permit
    allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'tel' ]
  };

/**
 * List of threads aka inbox
 * @todo: pagination
 */
exports.inbox = function(req, res) {
  Thread.find(
      {
        $or: [
          { userFrom: req.user },
          { userTo: req.user }
        ]
      }
    )
    .sort('updated')
    .populate('userFrom', userMiniProfileFields)
    .populate('userTo', userMiniProfileFields)
    .populate('message', 'content')
    .exec(function(err, threads) {
      if (err) {
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      } else {

        // Sanitize each outgoing thread
        var threadsCleaned = [];
        threads.forEach(function(thread) {

          // Threads need just excerpt
          thread.message.excerpt = sanitizeHtml(thread.message.content, {allowedTags: []}); // Clean message content from html
          thread.message.excerpt = thread.message.excerpt.replace(/\s/g, ' '); // Remove white space. Matches a single white space character, including space, tab, form feed, line feed.
          thread.message.excerpt = thread.message.excerpt.substring(0,100) + ' ...'; // Shorten

          delete thread.message.content;
          threadsCleaned.push(thread);
        });

        res.json(threadsCleaned);
      }
    });
};



/**
 * Send a message
 */
exports.send = function(req, res) {

  // take out socket instance from the app container, we'll need it later
  var socketio = req.app.get('socketio');

  var message = new Message(req.body);
  message.userFrom = req.user;

  // Sanitize message contents
  message.content = sanitizeHtml(message.content, messageSanitizeOptions);

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
          // Emit an event for all connected clients about new thread
          socketio.sockets.emit('message.thread', thread);
        }*/
      });

      // We'll need some info about related users, populate some fields
      message
        .populate('userFrom', userMiniProfileFields)
        .populate({
          path: 'userTo',
          select: userMiniProfileFields
        }, function(err, message) {
          if (err) {
            return res.status(400).send({
              message: errorHandler.getErrorMessage(err)
            });
          } else {

            // Emit an event for all connected clients about new message
            socketio.sockets.emit( 'message.sent', message );

            // Finally res
            res.json(message);
          }
        });

    }
  });
};


/**
 * Thread of messages
 * @todo: pagination
 */
exports.thread = function(req, res) {
  res.json(req.messages);
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
    .populate('userFrom', userMiniProfileFields)
    .populate('userTo', userMiniProfileFields)
    .exec(function(err, messages) {
      if (err) return next(err);
      if (!messages) return next(new Error('Failed to load messages.'));

      // Sanitize each outgoing message's contents
      var messagesCleaned = [];
      messages.forEach(function(message) {
        message.content = sanitizeHtml(message.content, messageSanitizeOptions);
        messagesCleaned.push(message);
      });

      req.messages = messagesCleaned;
      next();
    });
};




/**
 * Show the current message
 */
 /*
exports.read = function(req, res) {
  res.json(req.message);
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
    res.json(message);
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
    res.json(message);
  }
  });
};
*/
