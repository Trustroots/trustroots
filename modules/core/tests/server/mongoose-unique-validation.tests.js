const mongoose = require('mongoose');
const uniqueValidation = require('../../../../config/lib/mongoose-unique-validation');
require('should');

describe('Mongoose unique validation adapter', function () {
  function makeSchema(path, message) {
    const handlers = {};
    const schemaType = { options: { unique: message } };
    const schema = {
      tree: {},
      eachPath(callback) {
        callback(path, schemaType);
      },
      post(name, callback) {
        handlers[name] = callback;
      },
    };
    uniqueValidation(schema);
    return { handlers, schemaType };
  }

  it('registers duplicate handlers for save and update methods', function () {
    const { handlers } = makeSchema('name', 'Name is taken.');
    Object.keys(handlers)
      .sort()
      .should.deepEqual([
        'findOneAndUpdate',
        'save',
        'update',
        'updateMany',
        'updateOne',
      ]);
  });

  it('handles nested paths and converts duplicate errors', function (done) {
    const { handlers, schemaType } = makeSchema(
      'profile.handle',
      'Handle is taken.',
    );
    schemaType.options.unique.should.equal(true);
    handlers.updateMany(
      {
        code: 11000,
        keyPattern: { 'profile.handle': 1 },
        keyValue: { 'profile.handle': 'example' },
      },
      null,
      function (error) {
        error.should.be.instanceof(mongoose.Error.ValidationError);
        error.errors['profile.handle'].message.should.equal('Handle is taken.');
        done();
      },
    );
  });

  it('uses the default message and passes through other errors', function (done) {
    const { handlers } = makeSchema('name', true);
    handlers.updateOne(
      { code: 11000, keyPattern: { name: 1 }, keyValue: { name: 'x' } },
      null,
      function (error) {
        error.errors.name.message.should.equal(
          'Path `name` (x) is not unique.',
        );
        const original = new Error('database unavailable');
        handlers.save(original, null, function (passed) {
          passed.should.equal(original);
          done();
        });
      },
    );
  });
});
