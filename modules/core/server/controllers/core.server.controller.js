'use strict';

var path = require('path'),
    errorHandler = require('./errors.server.controller'),
    usersHandler = require(path.resolve('./modules/users/server/controllers/users.server.controller'));

/**
 * Render the main application page
 */
exports.renderIndex = function(req, res) {

  var currentUser = null;

  // Expose user
  if(req.user) {
    currentUser = usersHandler.sanitizeProfile(req.user, req.user);
  }

  res.render('modules/core/server/views/index', {
    user: currentUser
  });
};

/**
 * Render the server not found responses
 * Performs content-negotiation on the Accept HTTP header
 */
exports.renderNotFound = function(req, res) {
  res.status(404).format({
    'text/html': function() {
      res.render('modules/core/server/views/404');
    },
    'application/json': function() {
      res.json({ message: errorHandler.getErrorMessageByKey('not-found') });
    },
    'default': function() {
      res.send( errorHandler.getErrorMessageByKey('not-found') );
    }
  });
};
