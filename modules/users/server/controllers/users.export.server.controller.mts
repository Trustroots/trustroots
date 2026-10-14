import type { NextFunction, Response } from 'express';
import mongoose, { type Types } from 'mongoose';
import type { OfferPayload } from '../../../offers/shared/offer.js';
import { prepareOfferPayload } from '../../../offers/server/services/offer-payload.server.service.mts';
import type {
  ProfileRequest,
  ProfileResponse,
  ProfileResponseBody,
} from './users.profile.server.contracts.mts';
import type { UserServerDocument } from '../models/user.server.types.mts';
import contacts from '../../../contacts/server/controllers/contacts.server.controller.mjs';
import profiles from './users.profile.server.controller.mjs';

type ExportId = string | Types.ObjectId;

interface ExportRecord {
  [field: string]: unknown;
}

interface ExportMessageRecord extends ExportRecord {
  _id?: unknown;
  created?: unknown;
  content?: unknown;
  read?: unknown;
  userTo?: unknown;
}

interface ExportExperienceRecord extends ExportRecord {
  _id?: unknown;
  created?: unknown;
  public?: unknown;
  interactions?: unknown;
  recommend?: unknown;
  feedbackPublic?: unknown;
  removedAt?: unknown;
  userTo?: unknown;
}

type ExportOfferRecord = OfferPayload<ExportId, Date> & {
  createdAt?: Date;
};

interface ExportRequest extends ProfileRequest {
  user: UserServerDocument;
  contacts?: unknown;
  profile?: UserServerDocument | ProfileRequest['profile'];
}

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

interface MiddlewareResponse extends ProfileResponse {
  statusCode?: number;
}

type ExportMiddleware<Value extends ExportId> = (
  req: ProfileRequest,
  res: ProfileResponse,
  next: NextFunction,
  value: Value,
) => unknown;

interface ExportBody {
  format: 'trustroots-data-export';
  version: 1;
  exportedAt: string;
  profile: unknown;
  circles: ExportRecord[];
  contacts: unknown;
  hostingOffers: ExportOfferRecord[];
  messages: ExportRecord[];
  experiences: ExportRecord[];
}

interface UserExportService {
  download(
    req: ExportRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void>;
  buildExportFilename(username: unknown, exportedAt: Date): string;
  circlesFromProfile(profile: unknown): ExportRecord[];
  writtenMessages(userId: ExportId): Promise<ExportRecord[]>;
  writtenExperiences(userId: ExportId): Promise<ExportRecord[]>;
  memberOffers(userId: ExportId): Promise<ExportOfferRecord[]>;
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
  const safeUsername = String(username || '').toLowerCase();
  if (EXPORT_USERNAME.test(safeUsername)) {
    return `trustroots-data-${safeUsername}-${stamp}.json`;
  }
  return `trustroots-data-${stamp}.json`;
}

function isExportMember(value: unknown): value is ExportMember {
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
  return typeof value === 'object' && value !== null;
}

function circlesFromProfile(profile: unknown): ExportRecord[] {
  const member = isExportProfile(profile) ? profile.member : undefined;
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

function selectWrittenMessage(message: ExportMessageRecord): ExportRecord {
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

function selectWrittenExperience(
  experience: ExportExperienceRecord,
): ExportRecord {
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

function selectOwnedOffer(offer: ExportOfferRecord): ExportOfferRecord {
  return {
    ...prepareOfferPayload(offer),
    ...(offer.createdAt === undefined ? {} : { createdAt: offer.createdAt }),
  };
}

async function writtenMessages(userId: ExportId): Promise<ExportRecord[]> {
  const Message = mongoose.model<ExportMessageRecord>('Message');
  const messages = await Message.find({ userFrom: userId })
    .sort({ created: 1 })
    .populate('userTo', 'username displayName')
    .lean();
  return messages.map(selectWrittenMessage);
}

async function writtenExperiences(userId: ExportId): Promise<ExportRecord[]> {
  const Experience = mongoose.model<ExportExperienceRecord>('Experience');
  const experiences = await Experience.find({ userFrom: userId })
    .sort({ created: 1 })
    .populate('userTo', 'username displayName')
    .lean();
  return experiences.map(selectWrittenExperience);
}

async function memberOffers(
  userId: ExportId,
): Promise<ExportOfferRecord[]> {
  const Offer = mongoose.model<ExportOfferRecord>('Offer');
  const offers = await Offer.find({ user: userId })
    .sort({ createdAt: 1 })
    .lean();
  return offers.map(selectOwnedOffer);
}

function invokeMiddleware<Value extends ExportId>(
  middleware: ExportMiddleware<Value>,
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
      send(body: ProfileResponseBody) {
        const message =
          body && typeof body === 'object' && 'message' in body
            ? body.message
            : undefined;
        const error = Object.assign(
          new Error(message === undefined ? undefined : String(message)),
          { statusCode: this.statusCode },
        );
        reject(error);
        return undefined;
      },
      json() {
        return undefined;
      },
      redirect() {
        return undefined;
      },
    };
    middleware(
      req,
      response,
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
  req: ExportRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await invokeMiddleware(profiles.userByUsername, req, req.user.username);
    await invokeMiddleware(contacts.contactListByUser, req, req.user._id);
    const profile = req.profile || {};
    const [messages, experiences, hostingOffers] = await Promise.all([
      service.writtenMessages(req.user._id),
      service.writtenExperiences(req.user._id),
      service.memberOffers(req.user._id),
    ]);
    const exportedAt = new Date();
    const body: ExportBody = {
      format: 'trustroots-data-export',
      version: 1,
      exportedAt: exportedAt.toISOString(),
      profile,
      circles: circlesFromProfile(profile),
      contacts: req.contacts || [],
      hostingOffers,
      messages,
      experiences,
    };
    res
      .type('application/json')
      .attachment(buildExportFilename(req.user.username, exportedAt))
      .send(body);
  } catch (error) {
    next(error);
  }
};
service.buildExportFilename = buildExportFilename;
service.circlesFromProfile = circlesFromProfile;
service.writtenMessages = writtenMessages;
service.writtenExperiences = writtenExperiences;
service.memberOffers = memberOffers;
const defaultExport = service;
export default defaultExport;
export {
  buildExportFilename,
  circlesFromProfile,
  writtenMessages,
  writtenExperiences,
  memberOffers,
};
export const download = defaultExport.download;
export { defaultExport as 'module.exports' };
