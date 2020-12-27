/**
 * Module dependencies.
 */
const path = require('path');
const async = require('async');
const mongoose = require('mongoose');

const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const statService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const log = require(path.resolve('./config/lib/logger'));

const Message = mongoose.model('Message');
const Thread = mongoose.model('Thread');
const User = mongoose.model('User');
const ReferenceThread = mongoose.model('ReferenceThread');

/**
 * Create a new thread reference
 */
exports.createReferenceThread = function (req, res) {
  if (!req.user || (req.user && !req.user.public)) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Validate userTo ID
  if (!mongoose.Types.ObjectId.isValid(req.body.userTo)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  async.waterfall(
    [
      // Make sure referenced thread exists and that UserFrom is participating in it
      // Figure out userTo-id (i.e. don't trust the client)
      function (done) {
        Thread.findOne(
          {
            $or: [
              { userFrom: req.user._id, userTo: req.body.userTo },
              { userTo: req.user._id, userFrom: req.body.userTo },
            ],
          },
          'userTo userFrom',
          function (err, thread) {
            if (err || !thread) {
              return res.status(400).send({
                message: 'Thread does not exist.',
              });
            }

            if (thread.userTo && thread.userTo.equals(req.user._id)) {
              // UserTo at the thread is currently authenticated user
              done(null, thread._id, thread.userFrom);
            } else if (
              thread.userFrom &&
              thread.userFrom.equals(req.user._id)
            ) {
              // userFrom at the thread is currently authenticated user
              done(null, thread._id, thread.userTo);
            } else {
              // Currently authenticated user is not participating in this thread!
              return res.status(403).send({
                message: errorService.getErrorMessageByKey('forbidden'),
              });
            }
          },
        );
      },

      // Make sure targeted user has actually sent messages to user who is leaving the reference
      function (threadId, referenceUserToId, done) {
        Message.findOne(
          {
            userFrom: referenceUserToId,
            userTo: req.user._id,
          },
          'userFrom userTo',
          function (err, message) {
            // Handle errors or non-existing thread
            if (err || !message) {
              // Log
              log(
                'error',
                'Thread reference: Not allowed per message rules. #158472',
                {
                  error: err || null,
                },
              );

              return res.status(403).send({
                message: 'Referenced person has not sent messages to to you.',
              });
            }

            // All good, continue
            done(null, threadId, referenceUserToId);
          },
        );
      },

      // Get user
      function (threadId, referenceUserToId, done) {
        User.findById(
          referenceUserToId,
          '_id gender',
          (err, referenceUserTo) => {
            done(err, threadId, referenceUserTo);
          },
        );
      },

      // Save referenceThread
      function (threadId, referenceUserTo, done) {
        const referenceThread = new ReferenceThread(req.body);

        referenceThread.thread = threadId;
        referenceThread.userFrom = req.user._id;
        referenceThread.userTo = referenceUserTo._id;
        referenceThread.created = new Date(); // Ensure user doesn't try to set this

        referenceThread.save(function (err, savedReferenceThread) {
          // Handle errors
          if (err) {
            return res.status(400).send({
              message: errorService.getErrorMessage(err),
            });
          }

          // Send result to the API
          res.json(savedReferenceThread);

          // Send event to stats
          // Doesn't care about already existing references for this thread
          statService.stat(
            {
              namespace: 'threadReference',
              counts: {
                count: 1,
              },
              tags: {
                // References are `yes` or `no`
                // (defined at the `ReferenceThread` model)
                reference: referenceThread.reference,
                reporterGender: req.user.gender || 'unknown',
                reporteeGender: referenceUserTo.gender || 'unknown',
              },
            },
            function () {
              done();
            },
          );
        });
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
 * Show the current Offer
 */
exports.readReferenceThread = function (req, res) {
  res.json(req.referenceThread || {});
};

// Reference Thread reading middleware
exports.readReferenceThreadById = function (req, res, next, userToId) {
  // Check if user is authenticated
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Not a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(userToId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  async.waterfall(
    [
      // Check if we have refference thread stored
      function (done) {
        ReferenceThread.findOne({
          userTo: userToId,
          userFrom: req.user._id, // Ensure we get only references we are allowed to read
        })
          .sort('-created') // Latest first
          .exec(function (err, referenceThread) {
            if (err) return done(err);

            // Found, move on to the next middleware
            if (referenceThread) {
              req.referenceThread = referenceThread;
              return next();
            } else {
              // No existing reference thread found, move on to do more checks
              done(null);
            }
          });
      },

      // Since no pre-existing reference thread found,
      // check if authenticated user would be allowed to send reference to this user at all
      function (done) {
        Message.findOne(
          {
            userFrom: userToId,
            userTo: req.user._id,
          },
          function (err, message) {
            if (err) return done(err);

            // Return 404, but also let client know if we would allow creating a referenceThread
            return res.status(404).send({
              message: errorService.getErrorMessageByKey('not-found'),
              allowCreatingReference: Boolean(message),
            });
          },
        );
      },
    ],
    function (err) {
      if (err) {
        return next(err);
      }
    },
  );
};
