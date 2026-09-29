const mongoose = require('mongoose');

/** Convert duplicate-key errors into the validation errors used by our models. */
module.exports = function uniqueValidation(schema) {
  const messages = {};

  schema.eachPath(function (path, schemaType) {
    if (typeof schemaType.options.unique === 'string') {
      messages[path] = schemaType.options.unique;
      schemaType.options.unique = true;
      // Nested paths are absent from schema.tree; schemaType.options is enough
      // for Mongoose to register the unique index.
      if (schema.tree[path]) {
        schema.tree[path].unique = true;
      }
    }
  });

  function handleDuplicate(error, result, next) {
    if (error.code !== 11000 || !error.keyPattern) {
      return next(error);
    }

    const validationError = new mongoose.Error.ValidationError();
    Object.keys(error.keyPattern).forEach(function (path) {
      validationError.addError(
        path,
        new mongoose.Error.ValidatorError({
          path,
          type: 'unique',
          value: error.keyValue && error.keyValue[path],
          message: messages[path] || 'Path `{PATH}` ({VALUE}) is not unique.',
        }),
      );
    });
    next(validationError);
  }

  // Custom messages on schema.index({ ... }, { unique: 'message' }) are not
  // supported; this adapter reads messages from individual schema paths.
  schema.post('save', handleDuplicate);
  schema.post('update', handleDuplicate);
  schema.post('updateOne', handleDuplicate);
  schema.post('updateMany', handleDuplicate);
  schema.post('findOneAndUpdate', handleDuplicate);
};
