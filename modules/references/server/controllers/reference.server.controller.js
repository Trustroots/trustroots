'use strict';

var mongoose = require('mongoose'),
    _ = require('lodash'),
    path = require('path'),
    errorService = require(path.resolve('./modules/core/server/services/error.server.service')),
    Reference = mongoose.model('Reference');

function create(req, res) {
  var reference = new Reference(_.merge(req.body, { userFrom: req.user._id }));

  reference.save(function (err, savedReference) {
    var isConflict = err && err.errors && err.errors.userFrom && err.errors.userTo &&
      err.errors.userFrom.kind === 'unique' && err.errors.userTo.kind === 'unique';

    if (isConflict) {
      return res.status(409).json({ message: errorService.getErrorMessageByKey('conflict') });
    }

    return res.status(201).json({
      userFrom: savedReference.userFrom,
      userTo: savedReference.userTo,
      recommend: savedReference.recommend,
      created: savedReference.created.getTime(),
      met: savedReference.met,
      hostedMe: savedReference.hostedMe,
      hostedThem: savedReference.hostedThem,
      id: savedReference._id,
      public: savedReference.public
    });
  });
}

module.exports = {
  create: create
};
