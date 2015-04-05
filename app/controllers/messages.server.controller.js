'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    async = require('async'),
    _ = require('lodash'),
    errorHandler = require('./errors'),
    sanitizeHtml = require('sanitize-html'),
    userHandler = require('./users'),
    Message = mongoose.model('Message'),
    Thread = mongoose.model('Thread'),
    User = mongoose.model('User');


/**
 * Rules for sanitizing messages coming in and out
 * @link https://github.com/punkave/sanitize-html
 */
exports.messageSanitizeOptions = {
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
    .populate('userFrom', userHandler.userMiniProfileFields)
    .populate('userTo', userHandler.userMiniProfileFields)
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
          thread = thread.toObject();
          thread.message.excerpt = sanitizeHtml(thread.message.content, {allowedTags: []}); // Clean message content from html
          thread.message.excerpt = thread.message.excerpt.replace(/\s/g, ' '); // Remove white space. Matches a single white space character, including space, tab, form feed, line feed.
          thread.message.excerpt = thread.message.excerpt.replace(/\&nbsp\;/g, ' '); // Above didn't clean these buggers.
          thread.message.excerpt = thread.message.excerpt.substring(0,100) + ' ...'; // Shorten

          delete thread.message.content;

          // If latest message in the thread was from current user, mark it read
          // Writer obviously read his/her own message
          if(thread.userFrom._id.toString() === req.user._id.toString()) {
            thread.read = true;
          }

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
  //var socketio = req.app.get('socketio');

  // If the sending user has an empty profile, reject the message
  User.findById(req.user, 'description').exec(function(err, sender) {
    // If we were unable to find the sender, return the error and stop here
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    // Otherwise, we found the sender
    } else {

      // If the sender has an empty description (<140) return an error
      if (sender.description.length < 140) {
        return res.status(400).send({
          message: 'Please fill out your profile before you send messages.'
        });
      }

      var message = new Message(req.body);
      message.userFrom = req.user;
      message.read = false;
      message.notified = false;

      // Sanitize message contents
      message.content = sanitizeHtml(message.content, exports.messageSanitizeOptions);

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
          thread.read = false;

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
            .populate('userFrom', userHandler.userMiniProfileFields)
            .populate({
              path: 'userTo',
              select: userHandler.userMiniProfileFields
            }, function(err, message) {
              if (err) {
                return res.status(400).send({
                  message: errorHandler.getErrorMessage(err)
                });
              } else {

                // Emit an event for all connected clients about new message
                //socketio.sockets.emit( 'message.sent', message );

                // Finally res
                res.json(message);
              }
            });

        }
      });

    } // if User.findById else
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

  async.waterfall([

    // Find messages
    function(done) {

      if(userId && req.user) {

        Message.find({
          $or: [
            { userFrom: req.user._id, userTo: userId },
            { userTo: req.user._id, userFrom: userId }
          ]
        })
        .sort('-created')
        .populate('userFrom', userHandler.userMiniProfileFields)
        .populate('userTo', userHandler.userMiniProfileFields)
        .exec(function(err, messages) {
          if (!messages) err = new Error('Failed to load messages.');

          done(err, messages);
        });

      }
      else {
        done(new Error('No user.'));
      }

    },

    // Sanitize messages and return them for the API
    function(messages, done) {

      var messagesCleaned = [];

      if(messages && messages.length > 0) {
        // Sanitize each outgoing message's contents
        messages.forEach(function(message) {
          message.content = sanitizeHtml(message.content, exports.messageSanitizeOptions);
          messagesCleaned.push(message);
        });
      }

      req.messages = messagesCleaned;

      done(null);
    },

    /* Mark the thread read
     *
     * @todo: mark it read:true only when it was read:false,
     * now it performs write each time thread is opened
     */
    function(done) {

      if(req.messages && req.messages.length > 0) {

        var recentMessage = _.first(req.messages);

        // If latest message in the thread was to current user, mark thread read
        if(recentMessage.userTo._id.toString() === req.user._id.toString()) {

          Thread.update(
            {
              userTo: req.user._id,
              userFrom: userId
            },
            {
              read: true
            },
            // Options:
            {
              multi: false
            },
            function(err){
              done(err);
            }
          );

        } else {
          done(null);
        }

      } else {
        done(null);
      }

    }

  ], function(err) {
      if (err) {
        return next(err);
      }
      else return next();
  });

};


/**
 * Mark set of messages as read
 * Works only for currently logged in user's messages
 *
 * @todo: when array has only one id, as a small
 * optimization could be wise to use findByIdAndUpdate()
 * @link http://mongoosejs.com/docs/api.html#model_Model.findByIdAndUpdate
 */
exports.markRead = function(req, res) {

  // Only logged in user can update his/her own messages
  if(!req.user) {
    return res.status(400).send({
      message: 'You must be logged in first.'
    });
  }

  var messages = [];

  // Produce an array of messages to be updated
  req.body.messageIds.forEach(function(messageId) {
    messages.push({
      _id: messageId,
      //read: false,

      // Although this isn't in index, but it ensures
      // user has access to update only his/hers own messages
      userTo: req.user.id
    });
  });

  // Mark messages read
  Message.update({
    $or: messages
  },
  {
    read: true
  }, {
    multi: true
  }, function (err) {

    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
    else {
      res.status(200).send();
    }

  });

};
