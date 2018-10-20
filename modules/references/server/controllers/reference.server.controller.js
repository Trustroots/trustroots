var mongoose = require('mongoose'),
    _ = require('lodash'),
    Reference = mongoose.model('Reference');

function create(req, res) {
  var reference = new Reference(_.merge(req.body, { userFrom: req.user._id }));

  reference.save(function (err, savedReference) {
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
