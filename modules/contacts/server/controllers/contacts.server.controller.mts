import _ from 'lodash';
import errorService from '../../../core/server/services/error.server.service.mjs';
import textService from '../../../core/server/services/text.server.service.mjs';
import emailService from '../../../core/server/services/email.server.service.mjs';
import userRolesService from '../../../users/server/services/user-roles.server.service.mjs';
import userMiniService from '../../../users/server/services/user-mini.server.service.mjs';
import sanitizeHtml from 'sanitize-html';
import * as htmlToText from 'html-to-text';
import mongoose, { type HydratedDocument, type Types } from 'mongoose';
import type { ContactRecord } from '../models/contacts.server.model.mts';

interface ContactUser {
  _id: Types.ObjectId;
  public?: boolean;
  blocked?: Types.ObjectId[];
  roles?: string[];
  email?: string;
  displayName?: string;
  username?: string;
}

interface AddContactRequest {
  body: { friendUserId?: unknown; message?: unknown; [key: string]: unknown };
  user: ContactUser;
}

interface ContactRequest {
  body?: { friendUserId?: unknown; message?: unknown; [key: string]: unknown };
  user?: ContactUser;
  contact?: ContactDocument | PopulatedContact | null;
  contacts?: ContactListItem[];
}

interface ContactResponse {
  status(code: number): ContactResponse;
  json(body: ContactResponseBody): ContactResponse;
  send(body: ContactResponseBody): ContactResponse;
}

type ContactNext = (error?: unknown) => unknown;
type ContactDocument = HydratedDocument<ContactRecord>;
type ObjectIdInput = Parameters<typeof mongoose.Types.ObjectId.isValid>[0];
interface ContactPerson extends ContactUser {
  _id: Types.ObjectId;
}
type ContactParty = Types.ObjectId | ContactPerson;
type PopulatedContact = HydratedDocument<
  Omit<ContactRecord, 'userFrom' | 'userTo'> & {
    userFrom: ContactParty;
    userTo: ContactParty;
  }
>;
type ContactResponseBody =
  | ContactDocument
  | PopulatedContact
  | ContactListItem[]
  | { message: string; confirmed?: boolean }
  | Record<string, never>;
interface ContactListItem {
  user: ContactPerson & { locationFrom?: string; locationLiving?: string };
}
type ContactMiddleware = (
  req: ContactRequest,
  res: ContactResponse,
  next: ContactNext,
  id?: string | Types.ObjectId,
) => unknown;

interface ContactController {
  add: (req: AddContactRequest, res: ContactResponse) => unknown;
  remove: (
    req: { contact?: ContactDocument | PopulatedContact },
    res: ContactResponse,
  ) => unknown;
  removeAllByUserId: (
    userId: Types.ObjectId | string,
    callback?: (error?: Error | null) => void,
  ) => void;
  confirm: (
    req: {
      user?: ContactUser;
      contact?: ContactDocument | PopulatedContact | null;
    },
    res: ContactResponse,
  ) => unknown;
  list: (
    req: { contacts?: ContactListItem[] },
    res: ContactResponse,
  ) => unknown;
  get: (
    req: { contact?: ContactDocument | PopulatedContact },
    res: ContactResponse,
  ) => unknown;
  contactByUserId: ContactMiddleware;
  contactById: ContactMiddleware;
  filterByCommon: ContactMiddleware;
  contactListByUser: ContactMiddleware;
}

const service = {} as ContactController;

/**
 * Module dependencies.
 */
const Contact = mongoose.model<ContactRecord>('Contact');
const User = mongoose.model<ContactUser>('User');

function isValidObjectId(value: unknown): value is ObjectIdInput {
  return mongoose.Types.ObjectId.isValid(value as ObjectIdInput);
}

function objectIdEquals(id: Types.ObjectId, value: ObjectIdInput): boolean {
  // ObjectId.equals accepts fewer input forms than isValidObjectId does.
  return id.equals(value as Parameters<typeof id.equals>[0]);
}

function sendBadRequest(res: ContactResponse, error: unknown) {
  // The legacy error service accepts raw rejection values; keep them unchanged.
  return errorService.sendBadRequest(res, error as Error);
}

/**
 * Add a contact
 */
service.add = function (req, res) {
  return createContact(req, res);
};

async function createContact(req: AddContactRequest, res: ContactResponse) {
  let contact: ContactDocument | undefined;
  if (userRolesService.hasRestrictedMessagingRole(req.user)) {
    return res.send({ message: 'An email was sent to your contact.' });
  }
  if (!isValidObjectId(req.body.friendUserId)) {
    return errorService.sendInvalidId(res);
  }
  const friendUserId = new mongoose.Types.ObjectId(req.body.friendUserId);
  if (req.user.blocked?.some(id => objectIdEquals(id, friendUserId))) {
    return errorService.sendForbidden(res);
  }

  let messageHTML: string | false = false;
  let messagePlain: string | false = false;
  if (req.body.message && req.body.message !== '') {
    const message = req.body.message as string;
    messageHTML = sanitizeHtml(message, textService.sanitizeOptions);
    messagePlain = htmlToText.htmlToText(message, { wordwrap: 80 });
  }
  delete req.body.message;

  try {
    const existingContactQuery = Contact.findOne({
      $or: [
        { userTo: friendUserId, userFrom: req.user._id },
        { userTo: req.user._id, userFrom: friendUserId },
      ],
    });
    const existingContact = await (typeof existingContactQuery?.exec ===
    'function'
      ? existingContactQuery.exec()
      : existingContactQuery);
    if (existingContact) {
      return res.status(409).json({
        message: errorService.getErrorMessageByKey('conflict'),
        confirmed: existingContact.confirmed,
      });
    }

    // Find friend before creating a contact, so restricted profiles do not
    // receive a request or reveal that they exist.
    const friendQuery = User.findOne(
      {
        _id: friendUserId,
        roles: { $nin: userRolesService.restrictedMessagingRoles },
      },
      'email displayName roles blocked',
    );
    const friend = await (typeof friendQuery?.exec === 'function'
      ? friendQuery.exec()
      : friendQuery);
    if (!friend) throw new Error('Failed to load user ' + friendUserId);
    if (friend.blocked?.some(id => id.equals(req.user._id))) {
      return errorService.sendForbidden(res);
    }

    const newContact = new Contact({
      confirmed: false,
      userFrom: req.user._id,
      userTo: new mongoose.Types.ObjectId(friendUserId),
    });
    contact = newContact;
    await newContact.save();

    await new Promise<void>((resolve, reject) => {
      emailService.sendConfirmContact(
        req.user,
        friend,
        newContact,
        messageHTML,
        messagePlain,
        (error?: Error | null) => {
          if (error) return reject(error);
          res.send({ message: 'An email was sent to your contact.' });
          resolve();
        },
      );
    });
  } catch (error: unknown) {
    if (contact) await contact.deleteOne().catch(() => undefined);
    return sendBadRequest(res, error);
  }
}

/**
 * Disconnect contact
 */
service.remove = async function (req, res) {
  const contact = req.contact!;
  try {
    await contact.deleteOne();
    return res.status(200).send({ message: 'Contact removed.' });
  } catch (error: unknown) {
    return sendBadRequest(res, error);
  }
};

/**
 * Clear all contacts by user id
 */
service.removeAllByUserId = function (userId, callback) {
  const deletion = Contact.deleteMany({
    $or: [
      {
        userTo: userId,
      },
      {
        userFrom: userId,
      },
    ],
  });
  const pending =
    deletion && typeof deletion.exec === 'function'
      ? deletion.exec()
      : deletion;
  void Promise.resolve(pending).then(
    () => callback?.(),
    (error: Error) => callback?.(error),
  );
};

/**
 * Confirm (i.e. update) contact
 */
service.confirm = async function (req, res) {
  // Only receiving user can confirm user connections
  const contactUserToId = req.contact
    ? contactPartyId(req.contact.userTo)
    : undefined;
  if (!req.contact || !req.user || !contactUserToId?.equals(req.user._id)) {
    return errorService.sendForbidden(res);
  }

  // Ta'da!
  const contact = req.contact;
  contact.confirmed = true;
  return contact.save().then(
    () => res.json(contact),
    (error: Error) => errorService.sendBadRequest(res, error),
  );
};

/**
 * Contacts list
 */
service.list = function (req, res) {
  res.json(req.contacts || {});
};

/**
 * Single contact
 */
service.get = function (req, res) {
  res.json(req.contact || {});
};

/**
 * Single contact by userId
 *
 * - Find contact record where logged in user is a friend of given userId
 */
service.contactByUserId = async function (req, res, next, userId) {
  // Not a valid ObjectId
  if (!isValidObjectId(userId)) return errorService.sendInvalidId(res);

  // User's own profile, don't bother hitting the DB
  if (req.user && (req.user._id as unknown) === userId) {
    return errorService.sendInvalidId(res);
  }
  if (req.user && req.user.public) {
    try {
      const contact = await Contact.findOne({
        $or: [
          { userTo: userId, userFrom: req.user._id },
          { userTo: req.user._id, userFrom: userId },
        ],
      })
        .populate<{ userTo: ContactPerson; userFrom: ContactPerson }>(
          userMiniService.miniUserPopulate('userTo userFrom', {
            excludeRestrictedRoles: true,
          }),
        )
        .exec();
      if (!contact || !contact.userFrom || !contact.userTo) {
        return errorService.sendNotFound(res);
      }
      req.contact = contact;
      return next();
    } catch (error: unknown) {
      return next(error);
    }
  } else {
    next();
  }
};

/**
 * Single contact by contactId
 */
service.contactById = async function (req, res, next, contactId) {
  // Not a valid ObjectId
  if (!isValidObjectId(contactId)) return errorService.sendInvalidId(res);

  if (req.user && req.user.public) {
    try {
      const contact = await Contact.findById(contactId)
        .populate<{ userTo: ContactPerson; userFrom: ContactPerson }>(
          userMiniService.miniUserPopulate('userTo userFrom', {
            excludeRestrictedRoles: true,
          }),
        )
        .exec();

      // If nothing was found or neither of the user ID's match currently authenticated user's id, return 404
      if (
        !contact ||
        !contact.userFrom ||
        !contact.userTo ||
        (!contactPartyId(contact.userFrom).equals(req.user._id) &&
          !contactPartyId(contact.userTo).equals(req.user._id))
      ) {
        return errorService.sendNotFound(res);
      }
      req.contact = contact;
      return next();
    } catch (error: unknown) {
      return next(error);
    }
  } else {
    next();
  }
};

/**
 * Contact list middleware for filtering only common contacts
 * Takes already formed contact list and drops out contacts which aren't
 * on currently authenticated user's contact list
 */
service.filterByCommon = async function (req, res, next) {
  // No contacts to match, just continue
  const contacts = req.contacts || [];
  if (!contacts.length) {
    return next();
  }
  const user = req.user!;

  // Get currently authenticated user's contact list
  try {
    const authUserContacts = await Contact.find(
      {
        $or: [
          {
            userFrom: user._id,
          },
          {
            userTo: user._id,
          },
        ],
        // Include only confirmed contacts
        confirmed: true,
      },
      {
        // By default, the `_id` field is included in the results.
        // Leave it out.
        _id: 0,
        // Return only `userFrom` & `userTo` fields
        userFrom: 1,
        userTo: 1,
        test: '$userTo',
      },
    ).exec();

    // No contacts to match, just return empty array
    if (!authUserContacts || !authUserContacts.length) {
      req.contacts = [];
      return next();
    }

    // Remodel authenticated user's contact list to array of user ids
    const authUserContactUsers: string[] = [];
    _.map(authUserContacts, function (contact) {
      // Pick user id which isn't authenticated user themself
      const userId = contact.userFrom.equals(user._id)
        ? contact.userTo
        : contact.userFrom;

      // Ensure we have a list of string id's instead of Mongo ObjectId's
      // Otherwise checking against this list fails using `indexOf()`
      authUserContactUsers.push(userId.toString());
    });

    // Ensure we have a list of string id's instead of Mongo ObjectId's
    // Otherwise checking if we have certain id in this list using `indexOf`
    // becomes difficult.
    // authUserContactUsers = _.map(authUserContactUsers, _.toString);

    // We have both contact lists, do the matching
    // @link https://lodash.com/docs/#filter
    req.contacts = _.filter(contacts, function (contact) {
      // Check if `contact.user._id` is also on list of authenticated user's
      // contacts list. Returning truthy will let it trough to `req.contacts`,
      // returning falsy will hold it back.
      return authUserContactUsers.indexOf(contact.user._id.toString()) > -1;
    });
    return next();
  } catch (error: unknown) {
    return next(error);
  }
};

function contactPartyId(party: ContactParty): Types.ObjectId {
  return party instanceof mongoose.Types.ObjectId ? party : party._id;
}

/**
 * Contact list middleware
 */
service.contactListByUser = async function (req, res, next, listUserId) {
  // Not a valid ObjectId
  if (!isValidObjectId(listUserId)) return errorService.sendInvalidId(res);

  // Turn `listUserId` String into a Mongo ObjectId
  const userObjectId = new mongoose.Types.ObjectId(listUserId);
  const contactQuery: Record<string, unknown> = {
    $or: [
      {
        userFrom: userObjectId,
      },
      {
        userTo: userObjectId,
      },
    ],
    confirmed: true,
  };

  // Remove `confirmed:true` requirement from queries if currently
  // authenticated user is requesting their own contact list
  if (req.user && req.user._id.equals(userObjectId)) {
    delete contactQuery.confirmed;
  }
  try {
    const contacts = await Contact.aggregate<ContactListItem>([
      // Finds all documents where requested user id equals `userFrom` OR `userTo`
      // Optionally limits to documents with `confirmed:true` only
      {
        $match: contactQuery,
      },
      // Format results
      {
        $project: {
          // Normal contact document fields here
          _id: '$_id',
          confirmed: '$confirmed',
          created: '$created',
          userFrom: '$userFrom',
          userTo: '$userTo',
          // Project a new `user` field, picking ID of either `userFrom` or `userTo` field,
          // depending on which one equals to requested user. This is to avoid populating
          // requested user's profile, as it would just repeat on every document.
          user: {
            $cond: {
              if: {
                $eq: ['$userFrom', userObjectId],
              },
              then: '$userTo',
              else: '$userFrom',
            },
          },
        },
      },
      // Populate user field: receives whole document of user
      // Because `$lookup`s return an array with one user `[{userObject}]`,
      // the helper unwinds it back to `{userObject}`
      // Existing relationship records may outlive a moderation action. Keep
      // restricted members out of all user-facing contact lists.
      ...userMiniService.visibleUserLookupStages({
        localField: 'user',
        as: 'user',
      }),

      // Another round of formating results as we now have `user` field populated
      {
        $project: {
          // Normal contact document fields here
          _id: '$_id',
          confirmed: '$confirmed',
          created: '$created',
          userFrom: '$userFrom',
          userTo: '$userTo',
          // Project here fields for the user which isn't the user who's list
          // we requested. I.e. "the other party"
          // Projection is derived from the shared mini profile service,
          // extended with contact-specific location fields.
          user: userMiniService.userMiniProjection('$user', {
            locationFrom: '$user.locationFrom',
            locationLiving: '$user.locationLiving',
          }),
        },
      },
    ]).exec();
    if (!contacts) return next(new Error('Failed to load contacts.'));
    req.contacts = contacts;
    return next();
  } catch (error: unknown) {
    return next(error);
  }
};
const add = service.add;
const confirm = service.confirm;
const contactById = service.contactById;
const contactByUserId = service.contactByUserId;
const contactListByUser = service.contactListByUser;
const filterByCommon = service.filterByCommon;
const get = service.get;
const list = service.list;
const remove = service.remove;
const removeAllByUserId = service.removeAllByUserId;
/** @esmNamed */
export {
  add,
  confirm,
  contactById,
  contactByUserId,
  contactListByUser,
  filterByCommon,
  get,
  list,
  remove,
  removeAllByUserId,
};
export default service;
