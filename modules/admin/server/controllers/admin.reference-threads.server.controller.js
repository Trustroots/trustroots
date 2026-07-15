/**
 * Module dependencies.
 */
const mongoose = require('mongoose');

const errorService = require('../../../core/server/services/error.server.service');

const ReferenceThread = mongoose.model('ReferenceThread');
const User = mongoose.model('User');

const REFERENCE_THREADS_LIMIT = 500;
const TOP_NEGATIVE_RECIPIENTS_LIMIT = 10;

exports.list = async (req, res) => {
  try {
    const [items, topNegativeRecipientCounts] = await Promise.all([
      ReferenceThread.find({ reference: 'no' })
        .sort('-created')
        .limit(REFERENCE_THREADS_LIMIT)
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
        .exec(),
      ReferenceThread.aggregate([
        { $match: { reference: 'no' } },
        { $group: { _id: '$userTo', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: TOP_NEGATIVE_RECIPIENTS_LIMIT },
      ]).exec(),
    ]);

    const userIds = (topNegativeRecipientCounts || [])
      .map(({ _id }) => _id)
      .filter(Boolean);
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } })
          .select('username displayName _id')
          .exec()
      : [];
    const usersById = users.reduce((result, user) => {
      result[user._id.toString()] = user;
      return result;
    }, {});

    const topNegativeRecipients = (topNegativeRecipientCounts || []).map(
      ({ _id, count }) => ({
        count,
        user: _id ? usersById[_id.toString()] || _id : _id,
      }),
    );

    res.send({
      items: items || [],
      topNegativeRecipients,
    });
  } catch (err) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err),
    });
  }
};
