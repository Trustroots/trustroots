/**
 * Module dependencies.
 */
const multer = require('multer');
const mongoose = require('mongoose');
const path = require('path');
const config = require('../../../../config/config');

const errorService = require('../../../core/server/services/error.server.service');
const userRolesService = require('../../../users/server/services/user-roles.server.service');

const Offer = mongoose.model('Offer');
const User = mongoose.model('User');
const EARTH_RADIUS_KM = 6378.1;
const NEWSLETTER_AUDIENCE_FORMATS = ['csv', 'preview'];
const NEWSLETTER_LOCATION_SOURCES = ['from', 'hosting', 'living'];
const MAX_AUDIENCE_CIRCLES = 100;
const MAX_HOSTING_RADIUS_KM = 500;
const CSV_COLUMNS = [
  { key: 'email', label: 'Email Address' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
];
const UNSUBSCRIBED_CSV_COLUMNS = [
  ...CSV_COLUMNS,
  { key: 'reason', label: 'Reason' },
];
const RECIPIENT_UPLOAD_EXTENSIONS = ['.csv', '.jsonl', '.ndjson'];
const JSON_LINES_EXTENSIONS = ['.jsonl', '.ndjson'];

const newsletterRecipientUpload = multer({
  limits: {
    fileSize: config.maxUploadSize,
  },
  storage: multer.memoryStorage(),
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!RECIPIENT_UPLOAD_EXTENSIONS.includes(extension)) {
      const err = new Error('Unsupported recipient file type.');
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

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function invalidAudienceCriteria(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseAudienceCriteria(body = {}) {
  const format = body.format || 'preview';
  if (!NEWSLETTER_AUDIENCE_FORMATS.includes(format)) {
    throw invalidAudienceCriteria('Choose preview or CSV audience output.');
  }

  const sources = Array.isArray(body.sources) ? [...new Set(body.sources)] : [];
  if (
    sources.length > NEWSLETTER_LOCATION_SOURCES.length ||
    sources.some(source => !NEWSLETTER_LOCATION_SOURCES.includes(source))
  ) {
    throw invalidAudienceCriteria('Choose valid newsletter location sources.');
  }

  const locationText =
    typeof body.locationText === 'string' ? body.locationText.trim() : '';
  const usesTextLocation =
    sources.includes('living') || sources.includes('from');
  if (usesTextLocation && !locationText) {
    throw invalidAudienceCriteria(
      'Enter a location for living or origin matching.',
    );
  }

  let hosting = null;
  if (sources.includes('hosting')) {
    const hasCoordinates =
      body.latitude !== '' &&
      body.latitude !== null &&
      body.latitude !== undefined &&
      body.longitude !== '' &&
      body.longitude !== null &&
      body.longitude !== undefined;
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const radiusKm = Number(body.radiusKm);
    if (
      !hasCoordinates ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw invalidAudienceCriteria(
        'Enter valid latitude and longitude for hosting matching.',
      );
    }
    if (
      !Number.isFinite(radiusKm) ||
      radiusKm <= 0 ||
      radiusKm > MAX_HOSTING_RADIUS_KM
    ) {
      throw invalidAudienceCriteria(
        `Enter a hosting radius between 0 and ${MAX_HOSTING_RADIUS_KM} kilometres.`,
      );
    }
    hosting = { latitude, longitude, radiusKm };
  }

  const circleIds = Array.isArray(body.circleIds)
    ? [...new Set(body.circleIds)]
    : [];
  if (
    circleIds.length > MAX_AUDIENCE_CIRCLES ||
    circleIds.some(circleId => !mongoose.Types.ObjectId.isValid(circleId))
  ) {
    throw invalidAudienceCriteria('Choose valid newsletter circles.');
  }

  if (sources.length === 0 && circleIds.length === 0) {
    throw invalidAudienceCriteria(
      'Choose at least one location source or circle.',
    );
  }

  return {
    circleIds: circleIds.map(circleId => new mongoose.Types.ObjectId(circleId)),
    format,
    hosting,
    locationText,
    sources,
  };
}

function buildHostingQuery(hosting) {
  const { latitude, longitude, radiusKm } = hosting;
  return {
    type: 'host',
    location: {
      $geoWithin: {
        $centerSphere: [[latitude, longitude], radiusKm / EARTH_RADIUS_KM],
      },
    },
    $and: [
      {
        $or: [
          { status: { $in: ['yes', 'maybe'] } },
          { status: { $exists: false } },
        ],
      },
      {
        $or: [
          { validUntil: { $gte: new Date() } },
          { validUntil: { $exists: false } },
        ],
      },
    ],
  };
}

function buildAudienceQuery(criteria, hostingUserIds) {
  const conditions = [buildEligibleSubscribersQuery()];

  if (criteria.circleIds.length > 0) {
    conditions.push({
      'member.tribe': { $in: criteria.circleIds },
    });
  }

  if (criteria.sources.length > 0) {
    const locationMatches = [];
    if (criteria.sources.includes('living')) {
      locationMatches.push({
        locationLiving: new RegExp(
          escapeRegularExpression(criteria.locationText),
          'i',
        ),
      });
    }
    if (criteria.sources.includes('from')) {
      locationMatches.push({
        locationFrom: new RegExp(
          escapeRegularExpression(criteria.locationText),
          'i',
        ),
      });
    }
    if (criteria.hosting) {
      locationMatches.push({
        _id: { $in: hostingUserIds },
      });
    }
    conditions.push({ $or: locationMatches });
  }

  return { $and: conditions };
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

function extractEmailsFromJsonLines(jsonLinesText) {
  const lines = String(jsonLinesText)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);
  const emails = [];
  const seenEmails = new Set();

  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      return;
    }

    let record;
    try {
      record = JSON.parse(trimmedLine);
    } catch (error) {
      throw invalidAudienceCriteria(
        `Could not parse JSON on line ${lineIndex + 1}.`,
      );
    }

    const value =
      typeof record === 'string'
        ? record
        : record?.email || record?.emailAddress || record?.address;
    const email = normaliseEmail(value);
    if (!email || seenEmails.has(email)) {
      return;
    }

    seenEmails.add(email);
    emails.push(email);
  });

  return emails;
}

function extractEmailsFromUpload(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  let outputFormat = 'csv';
  if (JSON_LINES_EXTENSIONS.includes(extension)) {
    outputFormat = extension.replace('.', '');
  }
  const isJsonLines = outputFormat !== 'csv';
  const content = file.buffer.toString('utf8');

  return {
    emails: isJsonLines
      ? extractEmailsFromJsonLines(content)
      : extractEmailsFromCsv(content),
    outputFormat,
  };
}

function rowsToJsonLines(rows, includeReason = false) {
  return rows
    .map(row => {
      const record = {
        displayName: row.displayName || '',
        email: row.email,
        firstName: row.firstName || '',
        lastName: row.lastName || '',
        username: row.username || '',
      };
      if (includeReason) {
        record.reason = row.reason;
      }
      return JSON.stringify(record);
    })
    .join('\n');
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

exports.audience = async (req, res) => {
  let criteria;
  try {
    criteria = parseAudienceCriteria(req.body);
  } catch (error) {
    return res.status(error.statusCode).send({
      message: error.message,
    });
  }

  const hostingUserIds = criteria.hosting
    ? await Offer.distinct('user', buildHostingQuery(criteria.hosting)).exec()
    : [];
  const audienceQuery = buildAudienceQuery(criteria, hostingUserIds);
  if (criteria.format === 'preview') {
    const count = await User.countDocuments(audienceQuery).exec();
    return res.send({ count });
  }

  const users = await User.find(audienceQuery, {
    email: 1,
    firstName: 1,
    lastName: 1,
  })
    .sort({ email: 1 })
    .exec();
  return res.set('Content-Type', 'text/csv').send(rowsToCSV(users));
};

exports.uploadSubscribersCsv = (req, res, next) => {
  newsletterRecipientUpload(req, res, err => {
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

  let upload;
  try {
    upload = extractEmailsFromUpload(req.file);
  } catch (error) {
    return res.status(error.statusCode).send({
      message: error.message,
    });
  }

  const { emails, outputFormat } = upload;
  if (emails.length === 0) {
    return res.status(400).send({
      message: 'Could not find any email addresses in the uploaded file.',
    });
  }

  const users = await User.find(
    { email: { $in: emails } },
    {
      email: 1,
      displayName: 1,
      firstName: 1,
      lastName: 1,
      newsletter: 1,
      public: 1,
      removeProfileExpires: 1,
      removeProfileToken: 1,
      roles: 1,
      username: 1,
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
    const userForOutput = {
      displayName: user ? user.displayName : '',
      email,
      firstName: user ? user.firstName : '',
      lastName: user ? user.lastName : '',
      username: user ? user.username : '',
    };

    if (isNewsletterSubscriber(user)) {
      subscribed.push(userForOutput);
      return;
    }

    unsubscribed.push({
      ...userForOutput,
      reason: getUnsubscribedReason(user),
    });
  });

  const outputsJsonLines = outputFormat !== 'csv';
  return res.send({
    outputFormat,
    subscribedCount: subscribed.length,
    subscribedContent: outputsJsonLines
      ? rowsToJsonLines(subscribed)
      : rowsToCSV(subscribed),
    totalEmailCount: emails.length,
    unsubscribedCount: unsubscribed.length,
    unsubscribedContent: outputsJsonLines
      ? rowsToJsonLines(unsubscribed, true)
      : rowsToCSV(unsubscribed, UNSUBSCRIBED_CSV_COLUMNS),
  });
};
