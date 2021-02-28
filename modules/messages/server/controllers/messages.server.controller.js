/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const async = require('async');
const sanitizeHtml = require('sanitize-html');
const paginate = require('express-paginate');
const moment = require('moment');
const mongoose = require('mongoose');
const config = require(path.resolve('./config/config'));
const messageToStatsService = require(path.resolve(
  './modules/messages/server/services/message-to-stats.server.service',
));
const messageStatService = require(path.resolve(
  './modules/messages/server/services/message-stat.server.service',
));
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const textService = require(path.resolve(
  './modules/core/server/services/text.server.service',
));
const userProfile = require(path.resolve(
  './modules/users/server/controllers/users.profile.server.controller',
));
const Message = mongoose.model('Message');
const Thread = mongoose.model('Thread');
const User = mongoose.model('User');

// Allowed fields of message object to be set over API
const messageFields = [
  '_id',
  'content',
  'created',
  'read',
  'userFrom',
  'userTo',
].join(' ');

// Allowed fields of thread object to be set over API
const threadFields = [
  '_id',
  'message',
  'read',
  'updated',
  'userFrom',
  'userTo',
].join(' ');

/**
 * Sanitize message content field
 * @param {Array} messages - list of messages to go trough
 * @returns {Array}
 */
function sanitizeMessages(messages) {
  if (!messages || !messages.length) {
    return [];
  }

  const messagesCleaned = [];

  // Sanitize each outgoing message's contents
  messages.forEach(function (message) {
    message.content = sanitizeHtml(
      message.content,
      textService.sanitizeOptions,
    );
    messagesCleaned.push(message);
  });

  return messagesCleaned;
}
exports.sanitizeMessages = sanitizeMessages;

/**
 * Fill `userFrom` or `userTo` with deleted user's ID
 *
 * If user is deleted, the object from `User` collection is gone.
 * `Thread.paginate()` attempts to populate it but failing to do so,
 * leaves `userFrom` or `userTo` as `null` instead of just keeping
 * the original document `_id` which would still be useful at the frontend.
 * Until we refactor our code not to use `mongoose-paginate`, this helper
 * will backfill the IDs. Cumbersome and not optimal, but there are not that
 * many deleted profiles that this would be a significant issue.
 *
 * @param {Object} Thread
 * @return {Object} Thread with possibly mutated `thread.userFrom` / `thread.userTo`
 */
function fillDeletedProfiles(threads, callback) {
  if (!threads || !threads.length) {
    return callback(null, []);
  }

  async.mapSeries(
    threads,
    function (thread, done) {
      if (thread.userTo && thread.userFrom) {
        return done(null, thread);
      }

      // Check which field is `null` — only one of them can
      const field = !thread.userTo ? 'userTo' : 'userFrom';

      Thread.findById(thread._id, field, function (err, newThread) {
        if (!err && newThread) {
          thread[field] = {
            _id: newThread[field],
          };
        }
        done(null, thread);
      });
    },
    callback,
  );
}

/**
 * Sanitize threads
 *
 * @param {Array} threads - list of threads to go trough
 * @param {ObjectId} authenticatedUserId - ID of currently authenticated user
 * @returns {Array}
 */
function sanitizeThreads(threads, authenticatedUserId, callback) {
  if (!threads || !threads.length) {
    return callback(null, []);
  }

  async.mapSeries(
    threads,
    function (thread, done) {
      // Threads need just excerpt
      thread = thread.toObject();

      // Clean message content from html + clean all whitespace + shorten
      if (thread.message) {
        thread.message.excerpt = thread.message.content
          ? textService
              .plainText(thread.message.content, true)
              .substring(0, 100)
          : '…';
        delete thread.message.content;
      } else {
        // Ensure this works even if messages couldn't be found for some reason
        thread.message = {
          excerpt: '…',
        };
      }
      // If latest message in the thread was from current user, show
      // it as read - sender obviously read his/her own message
      if (
        thread.userFrom &&
        thread.userFrom._id &&
        thread.userFrom._id.toString() === authenticatedUserId.toString()
      ) {
        thread.read = true;
      }

      done(null, thread);
    },
    callback,
  );
}

/**
 * Constructs link headers for pagination
 */
const setLinkHeader = function (req, res, pageCount) {
  if (paginate.hasNextPages(req)(pageCount)) {
    const url = (config.https ? 'https' : 'http') + '://' + config.domain;
    const nextPage =
      url + res.locals.paginate.href({ page: req.query.page + 1 });
    res.links({
      next: nextPage,
      // last: ''
    });
  }
};

/**
 * List of threads aka inbox
 */
exports.inbox = function (req, res) {
  // No user
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  Thread.paginate(
    {
      // Returns only threads where currently authenticated user is participating member
      $or: [{ userFrom: req.user }, { userTo: req.user }],
    },
    {
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      sort: '-updated',
      select: threadFields,
      populate: [
        {
          path: 'message',
          select: 'content',
        },
        {
          path: 'userFrom userTo',
          select: userProfile.userMiniProfileFields,
          model: 'User',
        },
      ],
    },
    function (err, data) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      } else {
        // Pass pagination data to construct link header
        setLinkHeader(req, res, data.pages);

        // Sanitize and return threads
        sanitizeThreads(data.docs, req.user._id, function (err, threads) {
          // If user is deleted, the object from `User` collection is gone.
          // `Thread.paginate()` attempts to populate it but failing to do so,
          // leaves `userFrom` or `userTo` as `null` instead of just keeping
          // the original document `_id` which would still be useful at the frontend.
          // Until we refactor our code not to use `mongoose-paginate`, this helper
          // will backfill the IDs. Cumbersome and not optimal, but there are not that
          // many deleted profiles that this would be a significant issue.
          fillDeletedProfiles(threads, function (err, threads) {
            res.json(threads || []);
          });
        });
      }
    },
  );
};

/**
 * Send a message
 */
exports.send = function (req, res) {
  // No user
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // No receiver
  if (!req.body.userTo) {
    return res.status(400).send({
      message: 'Missing `userTo` field.',
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(req.body.userTo)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  // Don't allow sending messages to myself
  if (req.user._id.equals(req.body.userTo)) {
    return res.status(403).send({
      message: 'Recepient cannot be currently authenticated user.',
    });
  }

  // No content or test if content is actually empty (when html is stripped out)
  if (!req.body.content || textService.isEmpty(req.body.content)) {
    return res.status(400).send({
      message: 'Please write a message.',
    });
  }

  // Only moderator and admin roles can send messages to banned users. For others they stay hidden.
  const publicityLimit =
    req.user.roles.includes('moderator') || req.user.roles.includes('admin')
      ? {}
      : {
          public: true,
          roles: { $nin: ['suspended', 'shadowban'] },
        };

  async.waterfall(
    [
      // Check that receiving user is legitimate:
      // - Has to be confirmed their email (hence be public)
      // - Not suspended profile
      function (done) {
        User.findOne({
          _id: req.body.userTo,
          ...publicityLimit,
        }).exec(function (err, receiver) {
          // If we were unable to find the receiver, return the error and stop here
          if (err || !receiver) {
            return res.status(404).send({
              message: 'Member you are writing to does not exist.',
            });
          }
          done();
        });
      },

      // Check if this is first message to this thread (=does the thread object exist?)
      function (done) {
        Thread.findOne(
          {
            // User id's can be either way around in thread handle, so we gotta test for both situations
            $or: [
              {
                userTo: req.user._id,
                userFrom: req.body.userTo,
              },
              {
                userTo: req.body.userTo,
                userFrom: req.user._id,
              },
            ],
          },
          function (err, thread) {
            done(err, thread);
          },
        );
      },

      // Check sender's profile isn't empty If it was first message
      // If the sending user has an empty profile, reject the message
      function (thread, done) {
        // If this was first message to the thread
        if (!thread) {
          User.findById(req.user._id, 'description').exec(function (
            err,
            sender,
          ) {
            // Handle errors
            if (err) {
              return done(err);
            }

            const descriptionLength = sender.description
              ? textService.plainText(sender.description).length
              : 0;

            // If the sender has too empty description, return an error
            if (descriptionLength < config.profileMinimumLength) {
              return res.status(400).send({
                error: 'empty-profile',
                limit: config.profileMinimumLength,
                message:
                  descriptionLength === 0
                    ? 'Please fill out your profile description before you send messages.'
                    : 'Please write longer profile description before you send messages.',
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
      function (done) {
        const message = new Message(req.body);

        // Allow some HTML
        message.content = textService.html(message.content);

        message.userFrom = req.user;
        message.read = false;
        message.notified = false;

        message.save(function (err, message) {
          done(err, message);
        });
      },

      // Create/upgrade Thread handle between these two users
      function (message, done) {
        const thread = new Thread();
        thread.updated = Date.now();
        thread.userFrom = message.userFrom;
        thread.userTo = message.userTo;
        thread.message = message;
        thread.read = false;

        // Convert the Model instance to a simple object using Model's 'toObject' function
        // to prevent weirdness like infinite looping...
        const upsertData = thread.toObject();

        // Delete the _id property, otherwise Mongo will return a "Mod on _id not allowed" error
        delete upsertData._id;

        // Do the upsert, which works like this: If no Thread document exists with
        // _id = thread.id, then create a new doc using upsertData.
        // Otherwise, update the existing doc with upsertData
        // @link http://stackoverflow.com/a/7855281
        Thread.update(
          {
            // User id's can be either way around in old thread handle, so we gotta test for both situations
            $or: [
              {
                userTo: upsertData.userTo,
                userFrom: upsertData.userFrom,
              },
              {
                userTo: upsertData.userFrom,
                userFrom: upsertData.userTo,
              },
            ],
          },
          upsertData,
          { upsert: true },
          function (err) {
            done(err, message);
          },
        );
      },

      // Here we send some metrics to Stats API to measure how many messages
      // are sent, what type of messages, etc.
      function (message, done) {
        messageToStatsService.save(message, function () {
          // do nothing
        });

        return done(null, message);
      },

      // Here we create or update the related MessageStat document in mongodb
      // It serves to count the user's reply rate and reply time
      function (message, done) {
        messageStatService.updateMessageStat(message, function () {
          // do nothing
        });

        return done(null, message);
      },

      // We'll need some info about related users, populate some fields
      function (message, done) {
        message
          .populate({
            path: 'userFrom',
            select: userProfile.userMiniProfileFields,
          })
          .populate(
            {
              path: 'userTo',
              select: userProfile.userMiniProfileFields,
            },
            function (err, message) {
              if (err) {
                return done(err);
              }

              // Turn to object to be able to delete fields
              message = message.toObject();

              // Don't return this field
              delete message.notified;

              // Finally return saved message
              return res.json(message);
            },
          );
      },
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};

/**
 * Thread of messages
 */
exports.thread = function (req, res) {
  // Sanitize messages
  const messages =
    req.messages && req.messages.length ? sanitizeMessages(req.messages) : [];

  res.json(messages);
};

/**
 * Thread middleware
 */
exports.threadByUser = function (req, res, next, userId) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Not user id or its not a valid ObjectId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  // TODO do we want to allow to see the messages from suspended or banned users
  // in order to make them "read"?

  // // Only moderator and admin roles can read messages from banned users. For others they stay hidden.
  // const publicityLimit =
  //   req.user.roles.includes('moderator') || req.user.roles.includes('admin')
  //     ? {}
  //     : {
  //         public: true,
  //         roles: { $nin: ['suspended', 'shadowban'] },
  //       };

  async.waterfall(
    [
      // TODO commented out just to make it work.
      // We probably want to still return 404, if the user existed by didn't
      // have conversation with logged-in user?

      // // Check that other user is legitimate:
      // // - Has to be confirmed their email (hence be public)
      // // - Not suspended profile
      // function (done) {
      //   User.findOne({
      //     _id: userId,
      //     ...publicityLimit,
      //   }).exec(function (err, receiver) {
      //     // If we were unable to find the receiver, return the error and stop here
      //     if (err || !receiver) {
      //       return res.status(404).send({
      //         message: 'Member does not exist.',
      //       });
      //     }
      //     done();
      //   });
      // },

      // Find messages
      function (done) {
        Message.paginate(
          {
            $or: [
              { userFrom: req.user._id, userTo: userId },
              { userTo: req.user._id, userFrom: userId },
            ],
          },
          {
            page: req.query.page || 1,
            limit: req.query.limit || 20,
            sort: '-created',
            select: messageFields,
            populate: {
              path: 'userFrom userTo',
              select: userProfile.userMiniProfileFields,
            },
          },
          function (err, data) {
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
          },
        );
      },

      /* Mark the thread read
       *
       * @todo: mark it read:true only when it was read:false,
       * now it performs write each time thread is opened
       */
      function (messages, done) {
        if (!messages || messages.length === 0) {
          return done();
        }

        req.messages = messages;

        // If latest message in the thread was to current user, mark thread read
        if (
          messages[0].userTo &&
          messages[0].userTo._id &&
          req.user._id.equals(messages[0].userTo._id)
        ) {
          Thread.update(
            {
              userTo: req.user._id,
              userFrom: userId,
            },
            { read: true },
            { multi: false },
            done,
          );
        } else {
          done();
        }
      },
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }

      next();
    },
  );
};

/**
 * Mark set of messages as read
 * Works only for currently logged in user's messages
 */
exports.markRead = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  const messages = [];

  // Produce an array of messages to be updated
  req.body.messageIds.forEach(function (messageId) {
    messages.push({
      _id: messageId,
      // read: false,

      // Although this isn't in index, but it ensures
      // user has access to update only his/hers own messages
      userTo: req.user.id,
    });
  });

  // Mark messages read
  Message.update(
    {
      $or: messages,
    },
    {
      read: true,
    },
    {
      multi: true,
    },
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      } else {
        res.status(200).send({});
      }
    },
  );
};

/**
 * Get unread message count for currently logged in user
 */
exports.messagesCount = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  Thread.countDocuments(
    {
      read: false,
      userTo: req.user._id,
    },
    function (err, unreadCount) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
      return res.json({ unread: unreadCount ? parseInt(unreadCount, 10) : 0 });
    },
  );
};

/**
 * Sync endpoint used by mobile messenger
 */
exports.sync = function (req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Root object to be sent out from this API endpoint
  const data = {
    messages: [],
    users: [],
  };

  async.waterfall(
    [
      // Find messages
      function (done) {
        // Validate and construct date filters
        let dateFrom;
        let dateTo;
        const queryDate = {};

        if (_.has(req, 'query.dateFrom')) {
          dateFrom = moment(req.query.dateFrom);

          // Validate `dateFrom`
          if (!dateFrom.isValid()) {
            return res.status(400).send({
              message: 'Invalid `dateFrom`.',
            });
          }

          // Append dateFrom to date query
          _.set(queryDate, 'created.$gt', dateFrom.toDate());
        }

        if (_.has(req, 'query.dateTo')) {
          dateTo = moment(req.query.dateTo);
          // Validate `dateTo`
          if (!dateTo.isValid()) {
            return res.status(400).send({
              message: 'Invalid `dateTo`.',
            });
          }

          // Append dateTo to date query
          _.set(queryDate, 'created.$lt', dateTo.toDate());
        }

        // Validate correct order of dates
        if (dateFrom && dateTo && dateFrom.isAfter(dateTo)) {
          return res.status(400).send({
            message: 'Invalid dates: `dateFrom` cannot be later than `dateTo`',
          });
        }

        // Construct final Mongo query
        let query;

        // This is always part of the query
        const queryUsers = {
          $or: [{ userFrom: req.user._id }, { userTo: req.user._id }],
        };

        // Filter only by user or also by date?
        if (_.has(queryDate, 'created')) {
          // Construct query with date limits
          query = {
            $and: [queryUsers, queryDate],
          };
        } else {
          // Construct query without date limit
          query = queryUsers;
        }

        // Run the query
        Message.find(query)
          .sort({ created: -1 })
          .select(messageFields)
          .exec(function (err, messages) {
            if (err) {
              return done(err);
            }

            // Sanitize messages
            messages = sanitizeMessages(messages);

            // Collect user ids
            let userIds = [];

            // Re-group messages by users
            data.messages = _.groupBy(messages, function (row) {
              // Collect user id
              userIds.push(row.userTo.toString());
              userIds.push(row.userFrom.toString());

              // Determines key of the group
              if (row.userTo === req.user._id) {
                return row.userFrom;
              }
              return row.userTo;
            });

            // Ensure we have only one of each user ids
            userIds = _.uniq(userIds);

            done(err, userIds);
          });
      },

      // Collect users
      function (userIds, done) {
        // Get objects for users based on above user ids
        User.find({
          _id: {
            $in: userIds,
          },
        })
          .select(userProfile.userMiniProfileFields)
          .exec(function (err, users) {
            data.users = users;
            done(err);
          });
      },

      // Return the package
      function () {
        return res.json(data);
      },
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};

/**
 * Mark all the messages of which the user with given userId is receiver notified (notificationCount: 2)
 * @param {string} userId
 * @param {function} callback - function (?error) {}
 */
exports.markAllMessagesToUserNotified = function (userId, callback) {
  Message.update({ userTo: userId }, { notificationCount: 2 }, function (err) {
    callback(err);
  });
};
