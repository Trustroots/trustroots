const path = require('path');
const log = require(path.resolve('./config/lib/logger'));

// Default error message when unsure how to respond
const defaultErrorMessage =
  'Snap! Something went wrong. If this keeps happening, please contact us.';

/**
 * Get the error by key
 * This is to keep error messages consistent.
 *
 * @param key String Message key
 * @return String Error message
 */
exports.getErrorMessageByKey = function (key) {
  const errorMessages = {
    'not-found': 'Not found.',
    forbidden: 'Forbidden.',
    'invalid-id': 'Cannot interpret id.',
    'unprocessable-entity': 'Unprocessable Entity.', // Status 422, @link http://www.restpatterns.org/HTTP_Status_Codes/422_-_Unprocessable_Entity
    'unsupported-media-type': 'Unsupported Media Type.', // Status 415
    'bad-request': 'Bad request.', // Status 400
    conflict: 'Conflict.', // Status 409
    suspended: 'Your account has been suspended.',
    default: defaultErrorMessage,
  };

  return key && errorMessages[key] ? errorMessages[key] : defaultErrorMessage;
};

/**
 * Generate JS Error object with a message and status code
 *
 * @param key String Key matching messages at getErrorMessageByKey()
 * @param status Int Valid HTTP status code
 * @return Error
 */
exports.getNewError = function (key, status) {
  const message = this.getErrorMessageByKey(key);
  const err = new Error(message);

  if (status) err.status = status;

  return err;
};

/**
 * Get the error message from error object
 * @param err Error
 * @return String Error message
 */
exports.getErrorMessage = function (err) {
  let message = false;

  for (const errName in err.errors) {
    if (err.errors[errName].message) message = err.errors[errName].message;
  }

  return message || defaultErrorMessage;
};

/**
 * Error responses middleware
 */
exports.errorResponse = function (err, req, res, next) {
  // If the error object doesn't exists
  if (!err) return next();

  // Log errors
  log('error', 'API error response', err.stack);

  // Construct error response
  const errorResponse = {
    message: err.message || defaultErrorMessage,
  };

  // In development mode, pass the error with the response
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = err;
  }

  // Do content negotiation and return a message
  return res.status(err.status || 500).format({
    'text/html'() {
      res.render('500.server.view.html');
    },
    'application/json'() {
      res.json(errorResponse);
    },
    default() {
      res.send(errorResponse.message);
    },
  });
};
