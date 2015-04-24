'use strict';

/**
 * Get unique error field name
 * @todo: once https://github.com/Automattic/mongoose/issues/2284 gets done, we can have prettier errors for this.
 */
var getUniqueErrorMessage = function(err) {
  var output;

  try {
    var fieldName = err.err.substring(err.err.lastIndexOf('.$') + 2, err.err.lastIndexOf('_1'));
    output = fieldName.charAt(0).toUpperCase() + fieldName.slice(1) + ' already exists';

  } catch(ex) {
    output = 'Unique field already exists';
  }

  return output;
};

/**
 * Get the error message from error object
 */
exports.getErrorMessage = function(err) {
  var message = '';

  if (err.code) {
    switch (err.code) {
      case 11000:
      case 11001:
        message = getUniqueErrorMessage(err);
        break;
      default:
        message = 'Snap! Something went wrong. If this keeps happening, please contact us.';
    }
  } else {
    for (var errName in err.errors) {
      if (err.errors[errName].message) message = err.errors[errName].message;
    }
  }

  return message;
};
