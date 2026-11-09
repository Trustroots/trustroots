/**
 * Module dependencies.
 */
import multer from 'multer';
import mongoose, { type Types } from 'mongoose';
import path from 'path';
import config from './../../../../config/config.mts';
import errorService from './../../../core/server/services/error.server.service.mjs';
import userRolesService from './../../../users/server/services/user-roles.server.service.mjs';
import { isProfileDeletionPending } from '../services/profile-deletion.server.service.mts';
interface NewsletterUser {
  _id: Types.ObjectId;
  email?: string | null;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  username?: string;
  newsletter?: boolean;
  public?: boolean;
  roles?: string[];
  removeProfileToken?: string | null;
  removeProfileExpires?: Date | string | null;
  locationLiving?: string;
  locationFrom?: string;
  member?: Array<{ tribe: Types.ObjectId }>;
}

interface HostingCriteria {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

interface AudienceCriteria {
  circleIds: Types.ObjectId[];
  format: 'csv' | 'preview';
  hosting: HostingCriteria | null;
  locationText: string;
  sources: NewsletterLocationSource[];
}

type NewsletterLocationSource = 'from' | 'hosting' | 'living';

interface NewsletterRow {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  displayName?: unknown;
  username?: unknown;
  reason?: unknown;
}

interface NewsletterFile {
  buffer: Buffer;
  originalname: string;
}

interface NewsletterRequest {
  body?: Record<string, unknown> | null;
  file?: NewsletterFile;
  query?: Record<string, unknown>;
}

interface NewsletterResponse {
  status(code: number | undefined): NewsletterResponse;
  set(name: string, value: string): NewsletterResponse;
  send(body: unknown): unknown;
}

interface CodedError {
  code?: string;
  statusCode?: number;
  message?: unknown;
}

const Offer = mongoose.model<{ user: Types.ObjectId }>('Offer');
const User = mongoose.model<NewsletterUser>('User');
const EARTH_RADIUS_KM = 6378.1;
const NEWSLETTER_AUDIENCE_FORMATS = ['csv', 'preview'] as const;
const NEWSLETTER_LOCATION_SOURCES = ['from', 'hosting', 'living'] as const;
const MAX_AUDIENCE_CIRCLES = 100;
const MAX_HOSTING_RADIUS_KM = 500;
const CSV_COLUMNS = [
  {
    key: 'email',
    label: 'Email Address',
  },
  {
    key: 'firstName',
    label: 'First Name',
  },
  {
    key: 'lastName',
    label: 'Last Name',
  },
] satisfies NewsletterCsvColumn[];
const UNSUBSCRIBED_CSV_COLUMNS = [
  ...CSV_COLUMNS,
  {
    key: 'reason',
    label: 'Reason',
  },
] satisfies NewsletterCsvColumn[];
const RECIPIENT_UPLOAD_EXTENSIONS = ['.csv', '.jsonl', '.ndjson'];
const JSON_LINES_EXTENSIONS = ['.jsonl', '.ndjson'];
const newsletterRecipientUpload = multer({
  limits: {
    fileSize: config.maxUploadSize,
  },
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!RECIPIENT_UPLOAD_EXTENSIONS.includes(extension)) {
      const err: Error & CodedError = new Error(
        // Stryker disable next-line StringLiteral: clients get the 415 message for the code; this text is never read
        'Unsupported recipient file type.',
      );
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      return callback(err);
    }
    return callback(null, true);
  },
}).single('newsletterCsv');
function isNewsletterSubscriber(
  user: NewsletterUser | null | undefined,
): boolean {
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

interface NewsletterCsvColumn {
  key: 'email' | 'firstName' | 'lastName' | 'reason';
  label: string;
}
function buildEligibleSubscribersQuery(
  query: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...query,
    newsletter: true,
    public: true,
    roles: {
      $nin: userRolesService.restrictedMessagingRoles,
    },
    $or: [
      {
        removeProfileToken: {
          $exists: false,
        },
      },
      {
        removeProfileToken: null,
      },
      {
        removeProfileToken: {
          $exists: true,
          $ne: null,
        },
        removeProfileExpires: {
          $lte: new Date(),
        },
      },
    ],
  };
}
function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function invalidAudienceCriteria(message: string): Error & CodedError {
  const error: Error & CodedError = new Error(message);
  error.statusCode = 400;
  return error;
}
function isLocationSource(value: unknown): value is NewsletterLocationSource {
  return NEWSLETTER_LOCATION_SOURCES.some(source => source === value);
}

function isNewsletterAudienceFormat(
  value: unknown,
): value is (typeof NEWSLETTER_AUDIENCE_FORMATS)[number] {
  return NEWSLETTER_AUDIENCE_FORMATS.some(format => format === value);
}

type ObjectIdInput =
  | string
  | Types.ObjectId
  | { id: string | Buffer; toHexString(): string }
  | Buffer
  | Uint8Array;

function isObjectIdLike(value: object): value is {
  id: string | Buffer;
  toHexString(): string;
} {
  return (
    'id' in value &&
    (typeof value.id === 'string' || Buffer.isBuffer(value.id)) &&
    'toHexString' in value &&
    typeof value.toHexString === 'function'
  );
}

function isObjectIdInput(value: unknown): value is ObjectIdInput {
  if (
    typeof value === 'string' ||
    value instanceof mongoose.Types.ObjectId ||
    Buffer.isBuffer(value) ||
    value instanceof Uint8Array
  ) {
    return mongoose.Types.ObjectId.isValid(value);
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    isObjectIdLike(value) &&
    mongoose.Types.ObjectId.isValid(value)
  );
}

function parseAudienceCriteria(
  input: Record<string, unknown> | null = {},
): AudienceCriteria {
  const body = input!;
  const format = body.format || 'preview';
  if (!isNewsletterAudienceFormat(format)) {
    throw invalidAudienceCriteria('Choose preview or CSV audience output.');
  }
  const rawSources = Array.isArray(body.sources)
    ? [...new Set<unknown>(body.sources)]
    : [];
  // The sources are de-duplicated, so any list longer than the known sources
  // contains an invalid one.
  if (!rawSources.every(isLocationSource)) {
    throw invalidAudienceCriteria('Choose valid newsletter location sources.');
  }
  const sources = rawSources;
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
      // Number() reads '' and null as 0; undefined becomes NaN and fails below.
      body.latitude !== '' &&
      body.latitude !== null &&
      body.longitude !== '' &&
      body.longitude !== null;
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
    hosting = {
      latitude,
      longitude,
      radiusKm,
    };
  }
  const rawCircleIds = Array.isArray(body.circleIds)
    ? [...new Set<unknown>(body.circleIds)]
    : [];
  const circleIds = rawCircleIds.filter(isObjectIdInput);
  if (
    rawCircleIds.length > MAX_AUDIENCE_CIRCLES ||
    circleIds.length !== rawCircleIds.length
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
function buildHostingQuery(hosting: HostingCriteria): Record<string, unknown> {
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
          {
            status: {
              $in: ['yes', 'maybe'],
            },
          },
          {
            status: {
              $exists: false,
            },
          },
        ],
      },
      {
        $or: [
          {
            validUntil: {
              $gte: new Date(),
            },
          },
          {
            validUntil: {
              $exists: false,
            },
          },
        ],
      },
    ],
  };
}
function buildAudienceQuery(
  criteria: AudienceCriteria,
  hostingUserIds: Types.ObjectId[] | null,
): Record<string, unknown> {
  const conditions = [buildEligibleSubscribersQuery()];
  if (criteria.circleIds.length > 0) {
    conditions.push({
      'member.tribe': {
        $in: criteria.circleIds,
      },
    });
  }
  // Stryker disable next-line ConditionalExpression,EqualityOperator: without sources hostingUserIds is null, so this adds only $or: [], which Mongoose's cast deletes
  if (criteria.sources.length > 0) {
    const locationMatches: Record<string, unknown>[] = [];
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
    // Stryker disable next-line ConditionalExpression: Mongoose casts $in: null to [null], and no member has a null _id
    if (hostingUserIds) {
      locationMatches.push({
        _id: {
          $in: hostingUserIds,
        },
      });
    }
    conditions.push({
      $or: locationMatches,
    });
  }
  return {
    $and: conditions,
  };
}
function normaliseEmail(value: unknown): string | null {
  // Falsy values stringify to text that is never an email address.
  const normalised = String(value).trim().toLowerCase().replace(/^<|>$/g, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return null;
  }
  return normalised;
}
function csvCell(value: unknown): string {
  return String(value || '')
    .trim()
    .replace(/[,'"]/g, '');
}
function rowsToCSV(
  rows: NewsletterRow[],
  columns: NewsletterCsvColumn[] = CSV_COLUMNS,
): string {
  // First CSV line is the header
  let data = columns.map(({ label }) => csvCell(label)).join(',');
  rows.forEach(row => {
    data += '\n';
    data += columns.map(({ key }) => csvCell(row[key])).join(',');
  });
  return data;
}
function getUnsubscribedReason(user: NewsletterUser | undefined): string {
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
function parseFirstCsvField(line: string): string {
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
  // Stryker disable next-line MethodExpression: the header test ignores spaces, normaliseEmail trims, and a blank field is quoted, so its trimmed-line fallback holds a space and fails the address check
  return value.trim();
}
function extractEmailsFromCsv(csvText: string): string[] {
  // trim() also removes a byte order mark, and blank lines hold no address.
  const lines = csvText.split(/\r?\n/);
  const emails: string[] = [];
  const seenEmails = new Set<string>();
  lines.forEach((line, lineIndex) => {
    // Stryker disable next-line MethodExpression: parseFirstCsvField trims the field and normaliseEmail trims the fallback, so outer whitespace never reaches an address
    const trimmedLine = line.trim();
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
function extractEmailsFromJsonLines(jsonLinesText: string): string[] {
  // trim() below also removes a byte order mark.
  const lines = jsonLinesText.split(/\r?\n/);
  const emails: string[] = [];
  const seenEmails = new Set<string>();
  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      return;
    }
    let record: unknown;
    try {
      record = JSON.parse(trimmedLine);
    } catch {
      throw invalidAudienceCriteria(
        `Could not parse JSON on line ${lineIndex + 1}.`,
      );
    }
    const recordFields = record as {
      email?: unknown;
      emailAddress?: unknown;
      address?: unknown;
    } | null;
    const value =
      typeof record === 'string'
        ? record
        : recordFields?.email ||
          recordFields?.emailAddress ||
          recordFields?.address;
    const email = normaliseEmail(value);
    if (!email || seenEmails.has(email)) {
      return;
    }
    seenEmails.add(email);
    emails.push(email);
  });
  return emails;
}
function extractEmailsFromUpload(file: NewsletterFile): {
  emails: string[];
  outputFormat: 'csv' | 'jsonl' | 'ndjson';
} {
  // Stryker disable next-line StringLiteral: any fallback without a dot has no extension, like ''
  const extension = path.extname(file.originalname || '').toLowerCase();
  let outputFormat: 'csv' | 'jsonl' | 'ndjson' = 'csv';
  if (JSON_LINES_EXTENSIONS.includes(extension)) {
    outputFormat = extension === '.jsonl' ? 'jsonl' : 'ndjson';
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
function rowsToJsonLines(rows: NewsletterRow[]): string {
  return rows
    .map(row => {
      const record: NewsletterRow = {
        displayName: row.displayName || '',
        email: row.email,
        firstName: row.firstName || '',
        lastName: row.lastName || '',
        username: row.username || '',
        // Subscribed rows have no reason, which JSON.stringify leaves out.
        reason: row.reason,
      };
      return JSON.stringify(record);
    })
    .join('\n');
}
/** @esmNamed */
export const list = async (
  _req: NewsletterRequest,
  res: NewsletterResponse,
): Promise<void> => {
  const users = await User.find(
    buildEligibleSubscribersQuery(),
    // Stryker disable next-line ObjectLiteral: the projection only limits what is loaded; the CSV reads named columns
    { email: 1, firstName: 1, lastName: 1 },
  ).exec();
  const csv = rowsToCSV(users);
  res.set('Content-Type', 'text/csv').send(csv);
};
/** @esmNamed */
export const listCircleMembers = async (
  req: NewsletterRequest,
  res: NewsletterResponse,
): Promise<unknown> => {
  const params = req?.query ?? {};
  const circleId = params.circleId;

  if (!isObjectIdInput(circleId)) return errorService.sendInvalidId(res);

  const onlyNewsletterCircleMembers = !params.onlyNewsletterCircleMembers;
  const query = onlyNewsletterCircleMembers
    ? buildEligibleSubscribersQuery({
        'member.tribe': new mongoose.Types.ObjectId(circleId),
      })
    : {
        public: true,
        'member.tribe': new mongoose.Types.ObjectId(circleId),
        roles: {
          $nin: userRolesService.restrictedMessagingRoles,
        },
      };
  const users = await User.find(
    query,
    // Stryker disable next-line ObjectLiteral: the projection only limits what is loaded; the CSV and filter read named fields
    {
      email: 1,
      firstName: 1,
      lastName: 1,
      newsletter: 1,
      public: 1,
      roles: 1,
      removeProfileExpires: 1,
      removeProfileToken: 1,
    },
  ).exec();
  const csv = rowsToCSV(
    onlyNewsletterCircleMembers
      ? // Stryker disable next-line MethodExpression: the eligible-subscriber query already applies the same rules; this is a second guard
        users.filter(isNewsletterSubscriber)
      : users,
  );
  res.set('Content-Type', 'text/csv').send(csv);
};
/** @esmNamed */
export const audience = async (
  req: NewsletterRequest,
  res: NewsletterResponse,
): Promise<unknown> => {
  let criteria;
  try {
    criteria = parseAudienceCriteria(req.body);
  } catch (error: unknown) {
    const audienceError = toCodedError(error);
    return res.status(audienceError.statusCode).send({
      message: audienceError.message,
    });
  }
  const hostingUserIds = criteria.hosting
    ? await Offer.distinct('user', buildHostingQuery(criteria.hosting)).exec()
    : null;
  const audienceQuery = buildAudienceQuery(criteria, hostingUserIds);
  if (criteria.format === 'preview') {
    // parseAudienceCriteria validates every field and constructs the ObjectIds.
    // nosemgrep: request-object-in-database-filter
    const count = await User.countDocuments(audienceQuery).exec();
    return res.send({
      count,
    });
  }
  // Stryker disable next-line ObjectLiteral: the projection only limits what is loaded; the CSV reads named columns
  // parseAudienceCriteria validates every field and constructs the ObjectIds.
  // nosemgrep: request-object-in-database-filter
  const users = await User.find(audienceQuery, {
    email: 1,
    firstName: 1,
    lastName: 1,
  })
    .sort({
      email: 1,
    })
    .exec();
  return res.set('Content-Type', 'text/csv').send(rowsToCSV(users));
};
function toCodedError(error: unknown): CodedError {
  const legacyError = error as {
    statusCode?: number;
    message?: unknown;
  };
  return {
    statusCode: legacyError.statusCode,
    message: legacyError.message,
  };
}

/** @esmNamed */
export const uploadSubscribersCsv = (
  req: NewsletterRequest,
  res: NewsletterResponse,
  next: (error?: Error | null) => void,
): void => {
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
        message: errorService.getErrorMessageByKey(),
      });
    }
    return res.status(422).send({
      message: errorService.getErrorMessageByKey('unprocessable-entity'),
    });
  });
};
/** @esmNamed */
export const splitSubscribers = async (
  req: NewsletterRequest,
  res: NewsletterResponse,
): Promise<unknown> => {
  if (!req.file || !req.file.buffer) {
    return res.status(422).send({
      message: errorService.getErrorMessageByKey('unprocessable-entity'),
    });
  }
  let upload;
  try {
    upload = extractEmailsFromUpload(req.file);
  } catch (error: unknown) {
    const audienceError = toCodedError(error);
    return res.status(audienceError.statusCode).send({
      message: audienceError.message,
    });
  }
  const { emails, outputFormat } = upload;
  if (emails.length === 0) {
    return res.status(400).send({
      message: 'Could not find any email addresses in the uploaded file.',
    });
  }
  const users = await User.find(
    // Stryker disable next-line ObjectLiteral: users are looked up by email afterwards, so loading more of them changes nothing
    {
      email: {
        $in: emails,
      },
    },
    // Stryker disable next-line ObjectLiteral: the projection only limits what is loaded; the output reads named fields
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
  // Users were found by normalised address, so every stored one normalises.
  const usersByEmail = new Map<string | null, NewsletterUser>(
    users.map((user): [string | null, NewsletterUser] => [
      normaliseEmail(user.email),
      user,
    ]),
  );
  const subscribed: NewsletterRow[] = [];
  const unsubscribed: NewsletterRow[] = [];
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
      ? rowsToJsonLines(unsubscribed)
      : rowsToCSV(unsubscribed, UNSUBSCRIBED_CSV_COLUMNS),
  });
};
const defaultInterop = {
  list,
  listCircleMembers,
  audience,
  uploadSubscribersCsv,
  splitSubscribers,
};
export default defaultInterop;
/** @commonjs */
export { defaultInterop as 'module.exports' };
