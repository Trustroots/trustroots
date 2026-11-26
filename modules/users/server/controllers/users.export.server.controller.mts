import log from '@trustroots/logger';
import * as canonical from '../services/data-export-canonical.server.service.mts';
import * as signing from '../services/data-export-signing.server.service.mts';
import type {
  UserMessaging,
  WrittenMessage,
} from '../services/user-messaging.server.contract.mts';
import type {
  UserAccountServices,
  WrittenExperience,
} from '../services/user-account.server.contract.mts';
import type { NextFunction, Response } from 'express';
import type { Types } from 'mongoose';
import type {
  ProfileRequest,
  ProfileResponse,
  ProfileResponseBody,
} from './users.profile.server.contracts.mts';
import type { UserServerDocument } from '../models/user.server.types.mts';
import contacts from '../../../contacts/server/controllers/contacts.server.controller.mts';
import profiles from './users.profile.server.controller.mts';

type ExportId = string | Types.ObjectId;

interface ExportRecord {
  [field: string]: unknown;
}

type ExportRequest = ProfileRequest &
  Parameters<typeof contacts.contactListByUser>[0] & {
    user: UserServerDocument;
  };

interface ExportMember {
  [field: string]: unknown;
  _id?: unknown;
  username?: unknown;
  displayName?: unknown;
}

interface ExportTribe {
  [field: string]: unknown;
  _id?: unknown;
  slug?: unknown;
  label?: unknown;
}

interface ExportMembership {
  tribe?: unknown;
  since?: unknown;
}

interface ExportProfileRecord {
  member?: ExportMembership[] | null;
}

type ContactMiddlewareResponse = Parameters<
  typeof contacts.contactListByUser
>[1];
type MiddlewareResponseBody =
  | ProfileResponseBody
  | Parameters<ContactMiddlewareResponse['send']>[0];

interface MiddlewareResponse {
  statusCode?: number;
  status(code: number): MiddlewareResponse;
  send(body: MiddlewareResponseBody): MiddlewareResponse;
}

type ExportMiddleware<
  Value extends ExportId,
  Response extends ProfileResponse | ContactMiddlewareResponse,
> = (
  req: ExportRequest,
  res: Response,
  next: NextFunction,
  value: Value,
) => unknown;

interface UserExportService {
  download(
    services: Pick<
      UserAccountServices,
      | 'readReplyStats'
      | 'readWrittenMessages'
      | 'readWrittenExperiences'
      | 'readOwnedOffers'
    >,
    req: ExportRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  buildExportFilename(username: unknown, exportedAt: Date): string;
  circlesFromProfile(profile: unknown): ExportRecord[];
  writtenMessages(
    readWrittenMessages: UserMessaging['readWrittenMessages'],
    userId: ExportId,
  ): Promise<ExportRecord[]>;
  writtenExperiences(
    readWrittenExperiences: UserAccountServices['readWrittenExperiences'],
    userId: ExportId,
  ): Promise<ExportRecord[]>;
}

const service = {} as UserExportService;
const EXPORT_USERNAME = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,34}$/;

function formatExportStamp(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

function buildExportFilename(username: unknown, exportedAt: Date): string {
  const stamp = formatExportStamp(exportedAt);
  // Stryker disable next-line StringLiteral: any fallback with a space or '!' fails EXPORT_USERNAME, as '' does
  const safeUsername = String(username || '').toLowerCase();
  if (EXPORT_USERNAME.test(safeUsername)) {
    return `trustroots-data-${safeUsername}-${stamp}.json`;
  }
  return `trustroots-data-${stamp}.json`;
}

function isExportMember(value: unknown): value is ExportMember {
  // Stryker disable next-line ConditionalExpression: `value !== null` is redundant because selectMember returns early for a falsy member; this also ignores the line's other ConditionalExpression mutants, which the function-valued userTo test would kill
  return typeof value === 'object' && value !== null;
}

function selectMember(member: unknown): unknown {
  const record = isExportMember(member) ? member : undefined;
  if (!member || !record?._id) {
    return member || null;
  }
  return {
    _id: record._id,
    ...(record.username === undefined ? {} : { username: record.username }),
    ...(record.displayName === undefined
      ? {}
      : { displayName: record.displayName }),
  };
}

function isExportProfile(value: unknown): value is ExportProfileRecord {
  return typeof value === 'object' && value !== null;
}

function isExportTribe(value: unknown): value is ExportTribe {
  // Stryker disable next-line ConditionalExpression,LogicalOperator: `value !== null` is redundant because memberships without a tribe are filtered out first; a truthy non-object tribe has no _id, slug or label, so treating it as a record gives the same id and fields
  return typeof value === 'object' && value !== null;
}

function circlesFromProfile(profile: unknown): ExportRecord[] {
  const member = isExportProfile(profile) ? profile.member : undefined;
  // Stryker disable next-line LogicalOperator,ArrayDeclaration: `member || member` is the same value, and a placeholder string has no tribe so the filter drops it
  return ((member && member) || [])
    .filter(membership => membership && membership.tribe)
    .map(membership => {
      const tribe = membership.tribe;
      const id = isExportTribe(tribe) ? tribe._id || tribe : tribe;
      const fields = isExportTribe(tribe) ? tribe : undefined;
      return {
        _id: id,
        ...(fields?.slug === undefined ? {} : { slug: fields.slug }),
        ...(fields?.label === undefined ? {} : { label: fields.label }),
        since: membership.since,
      };
    });
}

function selectWrittenMessage(message: WrittenMessage): ExportRecord {
  return {
    _id: message._id,
    created: message.created,
    content: message.content,
    read: message.read,
    userTo: selectMember(message.userTo),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function selectWrittenExperience(experience: WrittenExperience): ExportRecord {
  const interactions = isRecord(experience.interactions)
    ? experience.interactions
    : {};
  return {
    _id: experience._id,
    created: experience.created,
    public: experience.public,
    interactions: {
      met: Boolean(interactions.met),
      guest: Boolean(interactions.guest),
      host: Boolean(interactions.host),
    },
    recommend: experience.recommend,
    ...(experience.feedbackPublic === undefined
      ? {}
      : { feedbackPublic: experience.feedbackPublic }),
    ...(experience.removedAt === undefined
      ? {}
      : { removedAt: experience.removedAt }),
    userTo: selectMember(experience.userTo),
  };
}

async function writtenMessages(
  readWrittenMessages: UserMessaging['readWrittenMessages'],
  userId: ExportId,
): Promise<ExportRecord[]> {
  const messages = await readWrittenMessages(userId);
  return messages.map(selectWrittenMessage);
}

async function writtenExperiences(
  readWrittenExperiences: UserAccountServices['readWrittenExperiences'],
  userId: ExportId,
): Promise<ExportRecord[]> {
  const experiences = await readWrittenExperiences(userId);
  return experiences.map(selectWrittenExperience);
}

function invokeMiddleware<
  Value extends ExportId,
  Response extends ProfileResponse | ContactMiddlewareResponse,
>(
  middleware: ExportMiddleware<Value, Response>,
  req: ExportRequest,
  value: Value,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const response: MiddlewareResponse = {
      statusCode: undefined,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      send(body: MiddlewareResponseBody) {
        const message =
          body && typeof body === 'object' && 'message' in body
            ? body.message
            : undefined;
        const error = Object.assign(
          new Error(message === undefined ? undefined : String(message)),
          { statusCode: this.statusCode },
        );
        reject(error);
        return this;
      },
    };
    middleware(
      req,
      response as Response,
      error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      },
      value,
    );
  });
}

service.download = async function (
  services,
  req: ExportRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await invokeMiddleware(
      profiles.userByUsername.bind(null, services.readReplyStats),
      req,
      req.user.username,
    );
    await invokeMiddleware(contacts.contactListByUser, req, req.user._id);
    const profile = req.profile || {};
    const [messages, experiences, hostingOffers] = await Promise.all([
      service.writtenMessages(services.readWrittenMessages, req.user._id),
      service.writtenExperiences(services.readWrittenExperiences, req.user._id),
      services.readOwnedOffers(req.user._id),
    ]);
    const exportedAt = new Date();
    const body = canonical.buildSignedPayload({
      profile,
      circles: circlesFromProfile(profile),
      contacts: (req.contacts || []).map(
        ({ _id, confirmed, created, userFrom, userTo, user }) => ({
          _id,
          confirmed,
          created,
          userFrom,
          userTo,
          user: {
            _id: user._id,
            username: user.username,
            displayName: user.displayName,
          },
        }),
      ),
      hostingOffers,
      messages,
      experiences,
    });
    const signature = signing.signPayload(body, {
      username: req.user.username,
    });
    if (!signature) {
      log(
        'warn',
        'Serving an unsigned export because no usable signing key is configured.',
      );
    }
    res
      .type('application/json')
      .attachment(buildExportFilename(req.user.username, exportedAt))
      .send({ ...body, exportedAt: exportedAt.toISOString(), signature });
  } catch (error) {
    next(error);
  }
};
service.buildExportFilename = buildExportFilename;
service.circlesFromProfile = circlesFromProfile;
service.writtenMessages = writtenMessages;
service.writtenExperiences = writtenExperiences;
export default service;
/** @esmNamed */
export {
  buildExportFilename,
  circlesFromProfile,
  writtenMessages,
  writtenExperiences,
};
/** @esmNamed */
export const download = service.download;
