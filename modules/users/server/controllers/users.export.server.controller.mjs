import mongoose from 'mongoose';
import contacts from './../../../contacts/server/controllers/contacts.server.controller.mjs';
import { prepareOfferPayload } from './../../../offers/server/services/offer-payload.server.service.mjs';
import profiles from './users.profile.server.controller.mjs';
const service = {};
const EXPORT_USERNAME = /^(?=.*[0-9a-z])[0-9a-z.\-_]{3,34}$/;

function formatExportStamp(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

function buildExportFilename(username, exportedAt) {
  const stamp = formatExportStamp(exportedAt);
  const safeUsername = String(username || '').toLowerCase();
  if (EXPORT_USERNAME.test(safeUsername)) {
    return `trustroots-data-${safeUsername}-${stamp}.json`;
  }
  return `trustroots-data-${stamp}.json`;
}

function selectMember(member) {
  if (!member || !member._id) {
    return member || null;
  }
  return {
    _id: member._id,
    ...(member.username === undefined ? {} : { username: member.username }),
    ...(member.displayName === undefined
      ? {}
      : { displayName: member.displayName }),
  };
}

function circlesFromProfile(profile) {
  return ((profile && profile.member) || [])
    .filter(membership => membership && membership.tribe)
    .map(membership => {
      const tribe = membership.tribe;
      const id = tribe._id || tribe;
      return {
        _id: id,
        ...(tribe.slug === undefined ? {} : { slug: tribe.slug }),
        ...(tribe.label === undefined ? {} : { label: tribe.label }),
        since: membership.since,
      };
    });
}

function selectWrittenMessage(message) {
  return {
    _id: message._id,
    created: message.created,
    content: message.content,
    read: message.read,
    userTo: selectMember(message.userTo),
  };
}

function selectWrittenExperience(experience) {
  const interactions = experience.interactions || {};
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

function selectOwnedOffer(offer) {
  return {
    ...prepareOfferPayload(offer),
    ...(offer.createdAt === undefined ? {} : { createdAt: offer.createdAt }),
  };
}

async function writtenMessages(userId) {
  const Message = mongoose.model('Message');
  const messages = await Message.find({ userFrom: userId })
    .sort({ created: 1 })
    .populate('userTo', 'username displayName')
    .lean();
  return messages.map(selectWrittenMessage);
}

async function writtenExperiences(userId) {
  const Experience = mongoose.model('Experience');
  const experiences = await Experience.find({ userFrom: userId })
    .sort({ created: 1 })
    .populate('userTo', 'username displayName')
    .lean();
  return experiences.map(selectWrittenExperience);
}

async function memberOffers(userId) {
  const Offer = mongoose.model('Offer');
  const offers = await Offer.find({ user: userId })
    .sort({ createdAt: 1 })
    .lean();
  return offers.map(selectOwnedOffer);
}

function invokeMiddleware(middleware, req, value) {
  return new Promise((resolve, reject) => {
    const response = {
      status(code) {
        return {
          send(body) {
            const error = new Error(body && body.message);
            error.statusCode = code;
            reject(error);
          },
        };
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
service.download = async function (req, res, next) {
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
    res
      .type('application/json')
      .attachment(buildExportFilename(req.user.username, exportedAt))
      .send({
        format: 'trustroots-data-export',
        version: 1,
        exportedAt: exportedAt.toISOString(),
        profile,
        circles: circlesFromProfile(profile),
        contacts: req.contacts || [],
        hostingOffers,
        messages,
        experiences,
      });
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
export { buildExportFilename };
export const download = defaultExport.download;
export { defaultExport as 'module.exports' };
