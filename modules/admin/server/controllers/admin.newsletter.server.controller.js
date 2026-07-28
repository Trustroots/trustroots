/**
 * Module dependencies.
 */
const multer = require('multer');
const mongoose = require('mongoose');
const config = require('../../../../config/config');

const errorService = require('../../../core/server/services/error.server.service');
const userRolesService = require('../../../users/server/services/user-roles.server.service');

const User = mongoose.model('User');
const CSV_COLUMNS = [
  { key: 'email', label: 'Email Address' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
];
const UNSUBSCRIBED_CSV_COLUMNS = [
  ...CSV_COLUMNS,
  { key: 'reason', label: 'Reason' },
];
const CSV_CONTENT_TYPES = [
  'application/csv',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
];

const newsletterCsvUpload = multer({
  limits: {
    fileSize: config.maxUploadSize,
  },
  storage: multer.memoryStorage(),
  fileFilter: (req, file, callback) => {
    if (!file || !CSV_CONTENT_TYPES.includes(file.mimetype)) {
      const err = new Error('Unsupported CSV file type.');
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      return callback(err);
    }

    return callback(null, true);
  },
}).single('newsletterCsv');

function isNewsletterSubscriber(user) {
  if (!user || !user.public || !user.newsletter) {
    return false;
  }

  if (userRolesService.hasRestrictedMessagingRole(user)) {
    return false;
  }

  if (isProfileDeletionPending(user)) {
    return false;
  }

  return true;
}

function isProfileDeletionPending(user) {
  if (!user || !user.removeProfileToken) {
    return false;
  }

  if (!user.removeProfileExpires) {
    return true;
  }

  const expiresAt = new Date(user.removeProfileExpires);
  if (Number.isNaN(expiresAt.getTime())) {
    return true;
  }

  return expiresAt.getTime() > Date.now();
}

function buildEligibleSubscribersQuery(query = {}) {
  return {
    ...query,
    newsletter: true,
    public: true,
    roles: { $nin: userRolesService.restrictedMessagingRoles },
    $or: [
      { removeProfileToken: { $exists: false } },
      { removeProfileToken: null },
      {
        removeProfileToken: { $exists: true, $ne: null },
        removeProfileExpires: { $lte: new Date() },
      },
    ],
  };
}

function normaliseEmail(value) {
  if (!value) {
    return null;
  }

  const normalised = String(value).trim().toLowerCase().replace(/^<|>$/g, '');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return null;
  }

  return normalised;
}

function csvCell(value) {
  return String(value || '')
    .trim()
    .replace(/[,'"]/g, '');
}

function rowsToCSV(rows, columns = CSV_COLUMNS) {
  // First CSV line is the header
  let data = columns.map(({ label }) => csvCell(label)).join(',');

  if (rows && rows.length > 0) {
    rows.forEach(row => {
      data += '\n';
      data += columns.map(({ key }) => csvCell(row[key])).join(',');
    });
  }

  return data;
}

function getUnsubscribedReason(user) {
  if (!user) {
    return 'Email not found';
  }

  if (userRolesService.hasRole(user, 'suspended')) {
    return 'Account suspended';
  }

  if (userRolesService.hasRole(user, 'shadowban')) {
    return 'Account shadowbanned';
  }

  if (isProfileDeletionPending(user)) {
    return 'Profile deletion pending';
  }

  if (!user.public) {
    return 'Profile not public';
  }

  if (!user.newsletter) {
    return 'Newsletter disabled';
  }

  return 'Not eligible for newsletter emails';
}

function parseFirstCsvField(line) {
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const character = line[i];

    if (character === '"') {
      if (inQuotes && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      break;
    }

    value += character;
  }

  return value.trim();
}

function extractEmailsFromCsv(csvText) {
  const lines = String(csvText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);
  const emails = [];
  const seenEmails = new Set();

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      return;
    }

    const firstField = parseFirstCsvField(trimmedLine);
    if (lineIndex === 0 && /email/i.test(firstField)) {
      return;
    }

    const email = normaliseEmail(firstField || trimmedLine);
    if (!email || seenEmails.has(email)) {
      return;
    }

    seenEmails.add(email);
    emails.push(email);
  });

  return emails;
}

exports.list = async (req, res) => {
  const users = await User.find(buildEligibleSubscribersQuery(), {
    email: 1,
    firstName: 1,
    lastName: 1,
  }).exec();

  const csv = rowsToCSV(users);
  res.set('Content-Type', 'text/csv').send(csv);
};

exports.listCircleMembers = async (req, res) => {
  const circleId = req?.query?.circleId;

  if (!circleId || !mongoose.Types.ObjectId.isValid(circleId)) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('invalid-id'),
    });
  }

  const onlyNewsletterCircleMembers = !req?.query?.onlyNewsletterCircleMembers;
  const query = onlyNewsletterCircleMembers
    ? buildEligibleSubscribersQuery({
        'member.tribe': circleId,
      })
    : {
        public: true,
        'member.tribe': circleId,
        roles: { $nin: userRolesService.restrictedMessagingRoles },
      };

  const users = await User.find(query, {
    email: 1,
    firstName: 1,
    lastName: 1,
    newsletter: 1,
    public: 1,
    roles: 1,
    removeProfileExpires: 1,
    removeProfileToken: 1,
  }).exec();

  const csv = rowsToCSV(
    onlyNewsletterCircleMembers ? users.filter(isNewsletterSubscriber) : users,
  );
  res.set('Content-Type', 'text/csv').send(csv);
};

exports.uploadSubscribersCsv = (req, res, next) => {
  newsletterCsvUpload(req, res, err => {
    if (!err && req.file && req.file.buffer) {
      return next();
    }

    if (err && err.code === 'UNSUPPORTED_MEDIA_TYPE') {
      return res.status(415).send({
        message: errorService.getErrorMessageByKey('unsupported-media-type'),
      });
    }

    if (err && err.code === 'LIMIT_FILE_SIZE') {
      const maxUploadSizeMb = (config.maxUploadSize / (1024 * 1024)).toFixed(2);
      return res.status(413).send({
        message: `File too big. Please maximum ${maxUploadSizeMb} Mb files.`,
      });
    }

    if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).send({
        message: 'Missing "newsletterCsv" field from the API call.',
      });
    }

    if (err) {
      return res.status(400).send({
        message: errorService.getErrorMessageByKey('default'),
      });
    }

    return res.status(422).send({
      message: errorService.getErrorMessageByKey('unprocessable-entity'),
    });
  });
};

exports.splitSubscribers = async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(422).send({
      message: errorService.getErrorMessageByKey('unprocessable-entity'),
    });
  }

  const emails = extractEmailsFromCsv(req.file.buffer.toString('utf8'));
  if (emails.length === 0) {
    return res.status(400).send({
      message: 'Could not find any email addresses in the uploaded CSV file.',
    });
  }

  const users = await User.find(
    { email: { $in: emails } },
    {
      email: 1,
      firstName: 1,
      lastName: 1,
      newsletter: 1,
      public: 1,
      removeProfileExpires: 1,
      removeProfileToken: 1,
      roles: 1,
    },
  ).exec();

  const usersByEmail = new Map(
    users
      .map(user => [normaliseEmail(user.email), user])
      .filter(([email]) => email),
  );
  const subscribed = [];
  const unsubscribed = [];

  emails.forEach(email => {
    const user = usersByEmail.get(email);
    const userForCsv = {
      email,
      firstName: user ? user.firstName : '',
      lastName: user ? user.lastName : '',
    };

    if (isNewsletterSubscriber(user)) {
      subscribed.push(userForCsv);
      return;
    }

    unsubscribed.push({
      ...userForCsv,
      reason: getUnsubscribedReason(user),
    });
  });

  return res.send({
    subscribedCount: subscribed.length,
    subscribedCsv: rowsToCSV(subscribed),
    totalEmailCount: emails.length,
    unsubscribedCount: unsubscribed.length,
    unsubscribedCsv: rowsToCSV(unsubscribed, UNSUBSCRIBED_CSV_COLUMNS),
  });
};
