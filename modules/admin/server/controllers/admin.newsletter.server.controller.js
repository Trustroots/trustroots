/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const path = require('path');

const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));

const User = mongoose.model('User');

const usersToCSV = users => {
  // First CSV line is the header
  let data = 'Email Address,First Name,Last Name';

  if (users && users.length > 0) {
    users.forEach(user => {
      data += '\n';
      data += [user.email, user.firstName, user.lastName]
        .map(string =>
          // Remove characters that would break CSV files
          string.trim().replace(/[,'"]/g, ''),
        )
        .join(',');
    });
  }

  return data;
};

exports.list = async (req, res) => {
  const users = await User.find(
    { public: true, newsletter: true },
    { email: 1, firstName: 1, lastName: 1 },
  ).exec();

  const csv = usersToCSV(users);
  res.set('Content-Type', 'text/csv').send(csv);
};

exports.listCircleMembers = async (req, res) => {
  const circleId = req?.query?.circleId;

  if (!circleId || !mongoose.Types.ObjectId.isValid(circleId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  const query = {
    public: true,
    'member.tribe': circleId,
  };

  // Include only newsletter subscribers
  if (!req?.query?.onlyNewsletterCircleMembers) {
    query.newsletter = true;
  }

  const users = await User.find(query, {
    email: 1,
    firstName: 1,
    lastName: 1,
  }).exec();

  const csv = usersToCSV(users);
  res.set('Content-Type', 'text/csv').send(csv);
};
