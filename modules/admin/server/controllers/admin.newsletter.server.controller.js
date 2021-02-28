/**
 * Module dependencies.
 */
const mongoose = require('mongoose');

const User = mongoose.model('User');

exports.list = async (req, res) => {
  // First CSV line is the header
  let data = 'Email Address,First Name,Last Name';

  const users = await User.find(
    { public: true, newsletter: true },
    { email: 1, firstName: 1, lastName: 1 },
  ).exec();

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

  res.set('Content-Type', 'text/csv').send(data);
};
