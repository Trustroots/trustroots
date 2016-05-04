'use strict';

var path = require('path'),
    errorHandler = require('./errors.server.controller'),
    usersHandler = require(path.resolve('./modules/users/server/controllers/users.server.controller'));

/**
 * Render the main application page
 */
exports.renderIndex = function(req, res) {

  var renderVars = {
    user: null
  };

  // Expose user
  if(req.user) {
    renderVars.user = usersHandler.sanitizeProfile(req.user, req.user);
  }

  // Expose tribe (when browsing `/tribes/tribe-name`)
  if(req.tribe) {
    renderVars.tribe = req.tribe;
  }

  res.render('modules/core/server/views/index', renderVars);
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
