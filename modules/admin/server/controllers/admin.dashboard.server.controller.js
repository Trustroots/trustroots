/**
 * Module dependencies.
 */
const mongoose = require('mongoose');

const errorService = require('../../../core/server/services/error.server.service');

const Message = mongoose.model('Message');
const ReferenceThread = mongoose.model('ReferenceThread');
const User = mongoose.model('User');

const TOP_MESSENGERS_LIMIT = 10;
const NEGATIVE_REVIEWS_LIMIT = 5;

function dateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function getTopMessengers() {
  const messengerCounts = await Message.aggregate([
    {
      $match: {
        created: { $gte: dateDaysAgo(7) },
        userFrom: { $ne: null },
      },
    },
    { $group: { _id: '$userFrom', messageCount: { $sum: 1 } } },
    { $sort: { messageCount: -1 } },
    { $limit: TOP_MESSENGERS_LIMIT },
  ]).exec();

  const userIds = (messengerCounts || []).map(({ _id }) => _id).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select('username displayName _id')
        .exec()
    : [];
  const usersById = users.reduce((result, user) => {
    result[user._id.toString()] = user;
    return result;
  }, {});

  return (messengerCounts || []).map(({ _id, messageCount }) => ({
    messageCount,
    user: _id ? usersById[_id.toString()] || { _id } : null,
  }));
}

async function getNegativeReviews() {
  const negativeReviews = await ReferenceThread.find({ reference: 'no' })
    .sort('-created')
    .limit(NEGATIVE_REVIEWS_LIMIT)
    .populate({
      path: 'userFrom',
      select: 'username displayName _id',
      model: 'User',
    })
    .populate({
      path: 'userTo',
      select: 'username displayName _id',
      model: 'User',
    })
    .exec();

  return negativeReviews || [];
}

exports.getDashboard = async (req, res) => {
  try {
    const [topMessengers, negativeReviews] = await Promise.all([
      getTopMessengers(),
      getNegativeReviews(),
    ]);

    res.send({
      negativeReviews,
      topMessengers,
    });
  } catch (err) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err),
    });
  }
};
