/**
 * Module dependencies.
 */
const mongoose = require('mongoose');

const errorService = require('../../../core/server/services/error.server.service');

const Experience = mongoose.model('Experience');
const Message = mongoose.model('Message');
const ReferenceThread = mongoose.model('ReferenceThread');
const User = mongoose.model('User');

const TOP_MESSENGERS_LIMIT = 10;
const THREAD_VOTES_LIMIT = 10;
const NEGATIVE_EXPERIENCES_LIMIT = 10;

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

async function getThreadVotes() {
  const threadVotes = await ReferenceThread.find({})
    .sort('-created')
    .limit(THREAD_VOTES_LIMIT)
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

  return threadVotes || [];
}

async function getNegativeExperiences() {
  const negativeExperiences = await Experience.find({ recommend: 'no' })
    .sort('-created')
    .limit(NEGATIVE_EXPERIENCES_LIMIT)
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

  return negativeExperiences || [];
}

exports.getDashboard = async (req, res) => {
  try {
    const [negativeExperiences, topMessengers, threadVotes] = await Promise.all(
      [getNegativeExperiences(), getTopMessengers(), getThreadVotes()],
    );

    res.send({
      negativeExperiences,
      threadVotes,
      topMessengers,
    });
  } catch (err) {
    return res.status(400).send({
      message: errorService.getErrorMessage(err),
    });
  }
};
