/**
 * Module dependencies.
 */
const mongoose = require('mongoose');

const ReferenceThread = mongoose.model('ReferenceThread');

exports.list = async (req, res) => {
  const items = await ReferenceThread.find({ reference: 'no' })
    .sort('-created')
    .limit(500)
    .populate({
      path: 'userTo',
      select: 'username displayName _id',
      model: 'User',
    })
    .populate({
      path: 'userFrom',
      select: 'username displayName _id',
      model: 'User',
    })
    .exec();

  res.send(items || []);
};
