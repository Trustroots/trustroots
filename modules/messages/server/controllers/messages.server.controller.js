'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
    path = require('path'),
    messageToInfluxService = require(path.resolve('./modules/messages/server/services/message-to-influx.server.service')),
    async = require('async'),
    sanitizeHtml = require('sanitize-html'),
    paginate = require('express-paginate'),
    mongoose = require('mongoose'),
    config = require(path.resolve('./config/config')),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    userHandler = require(path.resolve('./modules/users/server/controllers/users.server.controller')),
    Message = mongoose.model('Message'),
    Thread = mongoose.model('Thread'),
    User = mongoose.model('User');


/**
 * Constructs link headers for pagination
 */
var setLinkHeader = function(req, res, pageCount) {
  if (paginate.hasNextPages(req)(pageCount)) {
    var nextPage = { page: req.query.page + 1 };
    var linkHead = '<' + req.protocol + ':' + res.locals.url.slice(0, -1) + res.locals.paginate.href(nextPage) + '>; rel="next"';
    res.set('Link', linkHead);
  }
};

/**
 * List of threads aka inbox
 */
exports.inbox = function(req, res) {

  // No user
  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  Thread.paginate(
    {
      // Returns only threads where currently authenticated user is participating member
      $or: [
        { userFrom: req.user },
        { userTo: req.user }
      ]
    },
    {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      sort: 'field -updated',
      populate: {
        path: 'userFrom userTo message',
        select: 'content ' + userHandler.userMiniProfileFields
      }
    },
    function(err, data) {

      if (err) {
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      } else {

        // Sanitize each outgoing thread
        var threadsCleaned = [];
        if (data.docs.length > 0) {
          data.docs.forEach(function(thread) {

            // Threads need just excerpt
            thread = thread.toObject();

            // Clean message content from html + clean all whitespace + shorten
            if (thread.message) {
              thread.message.excerpt = thread.message.content ? textProcessor.plainText(thread.message.content, true).substring(0, 100).trim() + ' …' : '…';
              delete thread.message.content;
            } else {
              // Ensure this works even if messages couldn't be found for some reason
              thread.message = {
                excerpt: '…'
              };
            }

            // If latest message in the thread was from current user, show
            // it as read - sender obviously read his/her own message
            if (thread.userFrom && thread.userFrom._id && thread.userFrom._id.toString() === req.user._id.toString()) {
              thread.read = true;
            }

            // If users weren't populated, they were removed.
            // Don't return thread at all at this point.
            //
            // @todo:
            // Return thread but with placeholder user and old user's ID
            // With ID we could fetch the message thread — now all we could
            // show is this line at inbox but not actual messages
            if (thread.userTo && thread.userFrom) {
              threadsCleaned.push(thread);
            }
          });
        }

        // Pass pagination data to construct link header
        setLinkHeader(req, res, data.pages);

        res.json(threadsCleaned);
      }
    }
  );
};

/**
 * Send a message
 */
exports.send = function(req, res) {

  // No user
  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // No receiver
  if (!req.body.userTo) {
    return res.status(400).send({
      message: 'Missing `userTo` field.'
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(req.body.userTo)) {
    return res.status(400).send({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  // Don't allow sending messages to myself
  if (req.user._id.equals(req.body.userTo)) {
    return res.status(403).send({
      message: 'Recepient cannot be currently authenticated user.'
    });
  }

  // No content or test if content is actually empty (when html is stripped out)
  if (!req.body.content || textProcessor.isEmpty(req.body.content)) {
    return res.status(400).send({
      message: 'Please write a message.'
    });
  }

  async.waterfall([

    // Check receiver
    function(done) {
      User.findById(req.body.userTo, 'public').exec(function(err, receiver) {
        // If we were unable to find the receiver, return the error and stop here
        if (err || !receiver || !receiver.public) {
          return res.status(404).send({
            message: 'Member you are writing to does not exist.'
          });
        }
        done();
      });
    },

    // Check if this is first message to this thread (=does the thread object exist?)
    function(done) {
      Thread.findOne({
        // User id's can be either way around in thread handle, so we gotta test for both situations
        $or: [
          {
            userTo: req.user._id,
            userFrom: req.body.userTo
          },
          {
            userTo: req.body.userTo,
            userFrom: req.user._id
          }
        ]
      },
      function(err, thread) {
        done(err, thread);
      });
    },

    // Check sender's profile isn't empty If it was first message
    // If the sending user has an empty profile, reject the message
    function(thread, done) {
      // If this was first message to the thread
      if (!thread) {

        User.findById(req.user._id, 'description').exec(function(err, sender) {
          // Handle errors
          if (err) {
            return done(err);
          }

          var descriptionLength = (sender.description) ? textProcessor.plainText(sender.description).length : 0;

          // If the sender has too empty description, return an error
          if (descriptionLength < config.profileMinimumLength) {
            return res.status(400).send({
              error: 'empty-profile',
              limit: config.profileMinimumLength,
              message: (descriptionLength === 0) ? 'Please fill out your profile description before you send messages.' : 'Please write longer profile description before you send messages.'
            });
          }

          // Continue
          done(err);
        });
      } else {
        // It wasn't first message to this thread
        done(null);
      }

    },

    // Save message
    function(done) {

      var message = new Message(req.body);

      // Allow some HTML
      message.content = textProcessor.html(message.content);

      message.userFrom = req.user;
      message.read = false;
      message.notified = false;

      message.save(function(err, message) {
        done(err, message);
      });

    },

    // Create/upgrade Thread handle between these two users
    function(message, done) {

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
        done(err, message);
      });
    },

    // Here we collect some message data into the influxdb
    function (message, done) {
      // this module collects, processes and sends data to influxdb via
      // influxService /modules/core/server/services/...
      // the function takes callback as an optional 2nd argument
      // in this case we don't provide the callback and don't wait for finishing
      // because it has (should have) no effect on sending the message and
      // longer waiting for the response would influence performance negatively
      messageToInfluxService.save(message);

      return done(null, message);
    },

    // We'll need some info about related users, populate some fields
    function(message, done) {
      message
        .populate('userFrom', userHandler.userMiniProfileFields)
        .populate({
          path: 'userTo',
          select: userHandler.userMiniProfileFields
        }, function(err, message) {
          if (err) {
            return done(err);
          }

          // Finally return saved message
          return res.json(message);
        });
    }


  ], function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
  });

};


/**
 * Thread of messages
 */
exports.thread = function(req, res) {
  res.json(req.messages || []);
};

/**
 * Thread middleware
 */
exports.threadByUser = function(req, res, next, userId) {

  async.waterfall([

    // Find messages
    function(done) {

      if (!req.user) {
        return res.status(403).send({
          message: errorHandler.getErrorMessageByKey('forbidden')
        });
      }

      // Not user id or its not a valid ObjectId
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).send({
          message: errorHandler.getErrorMessageByKey('invalid-id')
        });
      }

      Message.paginate(
        {
          $or: [
            { userFrom: req.user._id, userTo: userId },
            { userTo: req.user._id, userFrom: userId }
          ]
        },
        {
          page: req.query.page || 1,
          limit: req.query.limit || 20,
          sort: 'field -created',
          populate: {
            path: 'userFrom userTo',
            select: userHandler.userMiniProfileFields
          }
        },
        function(err, data) {
          if (err) {
            return done(err);
          }

          if (!data || !data.docs) {
            return done(new Error('Failed to load messages.'));
          }

          // Pass pagination data to construct link header
          if (data.docs.length > 0) {
            setLinkHeader(req, res, data.pages);
          }

          done(err, data.docs);
        }
      );

    },

    // Sanitize messages and return them for the API
    function(messages, done) {

      var messagesCleaned = [];

      if (messages && messages.length > 0) {
        // Sanitize each outgoing message's contents
        messages.forEach(function(message) {
          message.content = sanitizeHtml(message.content, textProcessor.sanitizeOptions);
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

      if (req.messages && req.messages.length > 0) {

        var recentMessage = _.first(req.messages);

        // If latest message in the thread was to current user, mark thread read
        if (recentMessage.userTo._id && recentMessage.userTo._id.toString() === req.user._id.toString()) {

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
            function(err) {
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
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      return next();
    }
  });

};


/**
 * Mark set of messages as read
 * Works only for currently logged in user's messages
 */
exports.markRead = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  var messages = [];

  // Produce an array of messages to be updated
  req.body.messageIds.forEach(function(messageId) {
    messages.push({
      _id: messageId,
      // read: false,

      // Although this isn't in index, but it ensures
      // user has access to update only his/hers own messages
      userTo: req.user.id
    });
  });

  // Mark messages read
  Message.update(
    {
      $or: messages
    },
    {
      read: true
    },
    {
      multi: true
    },
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorHandler.getErrorMessage(err)
        });
      } else {
        res.status(200).send();
      }
    }
  );

};


/**
 * Get unread message count for currently logged in user
 */
exports.messagesCount = function(req, res) {

  if (!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  Thread.count({
    read: false,
    userTo: req.user._id
  }, function(err, unreadCount) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    }
    return res.json({ unread: unreadCount ? parseInt(unreadCount, 10) : 0 });
  });
};
