import _ from 'lodash';
import async from 'async';
import sanitizeHtml from 'sanitize-html';
import moment from 'moment';
import mongoose, { type HydratedDocument, type Types } from 'mongoose';
import config from '../../../../config/config.mts';
import log from '../../../../config/lib/logger.mjs';
import messageToStatsService from '../services/message-to-stats.server.service.mjs';
import messageStatService from '../services/message-stat.server.service.mjs';
import messageThrottleAlertService from '../services/message-throttle-alert.server.service.mts';
import errorService from '../../../core/server/services/error.server.service.mjs';
import textService from '../../../core/server/services/text.server.service.mjs';
import userRolesService from '../../../users/server/services/user-roles.server.service.mjs';
import statService from '../../../stats/server/services/stats.server.service.mts';
import paginationService from '../../../core/server/services/pagination.server.service.mjs';
import userMiniService from '../../../users/server/services/user-mini.server.service.mjs';
import type {
  MessageMember,
  MessagePayload,
  MessageThreadSummary,
} from '../../shared/messages.js';
import type { MessageRecord } from '../models/message.server.model.mts';
import type { ThreadRecord } from '../models/thread.server.model.mts';
import {
  prepareMarkReadSelector,
  prepareMarkReadResponse,
  prepareMessageForClient,
  prepareNewMessageFields,
  preparePreviewMessageResponse,
  prepareThreadSummary,
  prepareUnreadMessageCount,
} from '../services/messages-payload.server.service.mts';

interface MessageUser extends MessageMember<Types.ObjectId> {
  id: string;
  roles: string[];
  blocked?: Types.ObjectId[];
  public?: boolean;
  email?: string;
  displayName?: string;
  username?: string;
  description?: string;
}

interface PopulatedMessageUser extends MessageMember<Types.ObjectId> {
  email?: string;
  roles?: string[];
}

type MessageEndpointRecord = Omit<MessageRecord, 'userFrom' | 'userTo'> & {
  _id: Types.ObjectId;
  content: string;
  created: Date;
  read: boolean;
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  shadowHidden?: boolean;
  notified?: boolean;
};

type ThreadEndpointRecord = Omit<
  ThreadRecord,
  'userFrom' | 'userTo' | 'message' | 'updated' | 'read'
> & {
  _id: Types.ObjectId;
  updated: Date;
  read: boolean;
  userFrom: Types.ObjectId | PopulatedMessageUser | null;
  userTo: Types.ObjectId | PopulatedMessageUser | null;
  message?: Types.ObjectId | Pick<MessageEndpointRecord, 'content'> | null;
};
type MessageEndpointDocument = HydratedDocument<MessageEndpointRecord> & {
  toObject(): MessageEndpointRecord;
};
type PopulatedMessageEndpointDocument = HydratedDocument<
  Omit<MessageEndpointRecord, 'userFrom' | 'userTo'> & {
    userFrom: PopulatedMessageUser;
    userTo: PopulatedMessageUser;
  }
>;
type ThreadEndpointDocument = HydratedDocument<ThreadEndpointRecord> & {
  toObject(): ThreadEndpointRecord;
};
interface QueryResult<Result> extends PromiseLike<Result> {
  sort(sort: Record<string, 1 | -1>): this;
  select(fields: string): this;
  exec(): Promise<Result>;
}
interface PageResult<Document> {
  docs: Document[] | null;
  pages: number;
}
interface MessageEndpointModel {
  new (
    record?: Omit<Partial<MessageEndpointRecord>, 'userTo'> & {
      userTo?: ObjectIdInput;
    },
  ): MessageEndpointDocument;
  distinct(field: string, query: object): Promise<Types.ObjectId[]>;
  find(query: object): QueryResult<MessageEndpointDocument[]>;
  paginate(
    query: object,
    options: Record<string, unknown>,
    callback: (
      error: Error | null,
      result: PageResult<PopulatedMessageEndpointDocument>,
    ) => void,
  ): void;
  updateMany(query: object, update: object): Promise<unknown>;
}
interface ThreadEndpointModel {
  new (record?: Partial<ThreadEndpointRecord>): ThreadEndpointDocument;
  paginate(
    query: object,
    options: Record<string, unknown>,
    callback: (
      error: Error | null,
      result: PageResult<ThreadEndpointDocument>,
    ) => void,
  ): void;
  findById(
    id: ObjectIdInput,
    projection: string,
  ): QueryResult<ThreadEndpointDocument | null>;
  findOne(query: object): QueryResult<ThreadEndpointDocument | null>;
  updateOne(query: object, update: object, options: object): Promise<unknown>;
  updateMany(query: object, update: object): Promise<unknown>;
  countDocuments(query: object): Promise<number>;
}
interface UserEndpointModel {
  findOne(query: object): QueryResult<HydratedDocument<MessageUser> | null>;
  findById(
    id: Types.ObjectId,
    projection: string,
  ): QueryResult<HydratedDocument<MessageUser> | null>;
  find(query: object): QueryResult<HydratedDocument<PopulatedMessageUser>[]>;
}

interface ControllerRequest {
  // The authentication middleware adds this untyped field in Express; handlers
  // narrow it after their existing unauthenticated-request guard.
  user?: object;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  messages?: object[];
}

function authenticatedUser(req: ControllerRequest): MessageUser | undefined {
  return req.user as MessageUser | undefined;
}

interface ErrorResponse {
  message: string | boolean;
  error?: unknown;
  limit?: number;
}

type MessageResponseBody =
  | ErrorResponse
  | MessagePayload<
      Types.ObjectId | string,
      Date | string,
      PopulatedMessageUser | null
    >
  | MessageThreadSummary<Types.ObjectId | string, Date | string>
  | MessageThreadSummary<Types.ObjectId | string, Date | string>[]
  | ClientThreadSummary[]
  | MessagePayload<
      Types.ObjectId | string,
      Date | string,
      MessageMember<Types.ObjectId | string> | null
    >
  | MessagePayload<
      Types.ObjectId | string,
      Date | string,
      PopulatedMessageUser | null
    >[]
  | {
      messages:
        | Partial<Record<string, Array<Pick<MessageEndpointRecord, 'content'>>>>
        | Array<Pick<MessageEndpointRecord, 'content'>>;
      users: HydratedDocument<PopulatedMessageUser>[];
    }
  | { unread: number }
  | { content: string }
  | ReturnType<typeof prepareMarkReadResponse>;
type ClientThreadSummary = MessageThreadSummary<
  Types.ObjectId | string,
  Date | string
>;
type PaginatedResponse = ControllerResponse & {
  locals: { paginate: { href(params: Record<string, unknown>): string } };
  links(links: Record<string, string>): unknown;
};

interface ControllerResponse {
  status(code: number): this;
  send(body: MessageResponseBody): this | void;
  json(body: MessageResponseBody): this | void;
  links?(links?: { next?: string }): this | void;
}

type ControllerNext = (error?: unknown) => void;
type ErrorCallback = (error: Error | null) => void;
type WaterfallDone<Result extends unknown[] = []> = {
  (error?: Error | null | undefined): void;
  (error: Error | null | undefined, ...results: Result): void;
};
type WaterfallTask = (...args: never[]) => void;
type WaterfallCallback = (error?: unknown, ...results: unknown[]) => void;
type AsyncCallbacks = {
  mapSeries<Item, Result>(
    items: Item[],
    iteratee: (
      item: Item,
      callback: (error?: Error | null, result?: Result) => void,
    ) => void,
    callback: (error?: Error | null, results?: Result[]) => void,
  ): void;
  waterfall(tasks: WaterfallTask[], callback?: WaterfallCallback): void;
};
const asyncCallbacks = async as unknown as AsyncCallbacks;

interface MessagesController {
  inbox(req: ControllerRequest, res: ControllerResponse): unknown;
  send(req: ControllerRequest, res: ControllerResponse): Promise<unknown>;
  thread(req: ControllerRequest, res: ControllerResponse): unknown;
  threadByUser(
    req: ControllerRequest,
    res: ControllerResponse,
    next: ControllerNext,
    userId?: string,
  ): unknown;
  markRead(req: ControllerRequest, res: ControllerResponse): unknown;
  messagesCount(req: ControllerRequest, res: ControllerResponse): unknown;
  sync(req: ControllerRequest, res: ControllerResponse): unknown;
  markAllMessagesToUserNotified(userId: string, callback: ErrorCallback): void;
  preview(req: ControllerRequest, res: ControllerResponse): unknown;
  sanitizeMessages<Message extends { content: string }>(
    messages?: Message[] | null,
  ): Message[];
}

const service = {} as MessagesController;

/**
 * Module dependencies.
 */
// Mongoose 6 callback APIs are retained at these local model boundaries.
const Message = mongoose.model<MessageEndpointRecord>(
  'Message',
) as unknown as MessageEndpointModel;
const Thread = mongoose.model<ThreadEndpointRecord>(
  'Thread',
) as unknown as ThreadEndpointModel;
const User = mongoose.model<MessageUser>(
  'User',
) as unknown as UserEndpointModel;
type ObjectIdInput = Parameters<typeof mongoose.Types.ObjectId.isValid>[0];
function isValidObjectId(value: unknown): value is ObjectIdInput {
  return mongoose.Types.ObjectId.isValid(value as ObjectIdInput);
}
function blockedUserIds(user: MessageUser): string[] {
  return (user.blocked || []).map(blockedUser => blockedUser.toString());
}
function excludeBlockedUsers(
  query: Record<string, unknown>,
  user: MessageUser,
): Record<string, unknown> {
  const blocked = blockedUserIds(user);
  if (blocked.length === 0) {
    return query;
  }
  return {
    $and: [
      query,
      {
        userFrom: {
          $nin: blocked,
        },
        userTo: {
          $nin: blocked,
        },
      },
    ],
  };
}

// Allowed fields of message object to be set over API
const messageFields = [
  '_id',
  'content',
  'created',
  'read',
  'userFrom',
  'userTo',
].join(' ');

// Allowed fields of thread object to be set over API
const threadFields = [
  '_id',
  'message',
  'read',
  'updated',
  'userFrom',
  'userTo',
].join(' ');

/**
 * Sanitize message content field
 * @param {Array} messages - list of messages to go trough
 * @returns {Array}
 */
function sanitizeMessages<Message extends { content: string }>(
  messages?: Message[] | null,
): Message[] {
  if (!messages || !messages.length) {
    return [];
  }
  const messagesCleaned: Message[] = [];

  // Sanitize each outgoing message's contents
  messages.forEach(function (message) {
    message.content = sanitizeHtml(
      message.content,
      textService.sanitizeOptions,
    );
    messagesCleaned.push(message);
  });
  return messagesCleaned;
}
service.sanitizeMessages = sanitizeMessages;

/**
 * Fill `userFrom` or `userTo` with deleted user's ID
 *
 * If user is deleted, the object from `User` collection is gone.
 * `Thread.paginate()` attempts to populate it but failing to do so,
 * leaves `userFrom` or `userTo` as `null` instead of just keeping
 * the original document `_id` which would still be useful at the frontend.
 * Until we refactor our code not to use `mongoose-paginate`, this helper
 * will backfill the IDs. Cumbersome and not optimal, but there are not that
 * many deleted profiles that this would be a significant issue.
 *
 * @param {Object} Thread
 * @return {Object} Thread with possibly mutated `thread.userFrom` / `thread.userTo`
 */
function fillDeletedProfiles(
  threads: ClientThreadSummary[] | null | undefined,
  callback: (error?: Error | null, result?: ClientThreadSummary[]) => void,
): void {
  if (!threads || !threads.length) {
    return callback(null, []);
  }
  asyncCallbacks.mapSeries(
    threads,
    function (
      thread: ClientThreadSummary,
      done: (error?: Error | null, result?: ClientThreadSummary) => void,
    ) {
      if (thread.userTo && thread.userFrom) {
        return done(null, thread);
      }

      // Check which field is `null` — only one of them can
      const field = !thread.userTo ? 'userTo' : 'userFrom';
      Thread.findById(thread._id, field).then(
        newThread => {
          if (newThread) {
            thread[field] = {
              _id: newThread[field] as Types.ObjectId,
            };
          }
          done(null, thread);
        },
        () => done(null, thread),
      );
    },
    callback,
  );
}

/**
 * Sanitize threads
 *
 * @param {Array} threads - list of threads to go trough
 * @param {ObjectId} authenticatedUserId - ID of currently authenticated user
 * @returns {Array}
 */
function sanitizeThreads(
  threads: ThreadEndpointDocument[] | null | undefined,
  authenticatedUserId: Types.ObjectId,
  callback: (error?: Error | null, result?: ClientThreadSummary[]) => void,
): void {
  if (!threads || !threads.length) {
    return callback(null, []);
  }
  asyncCallbacks.mapSeries(
    threads,
    function (
      thread: ThreadEndpointDocument,
      done: (error?: Error | null, result?: ClientThreadSummary) => void,
    ) {
      // Threads need just excerpt
      const plainThread = thread.toObject();

      // Clean message content from html + clean all whitespace + shorten
      let excerpt;
      if (plainThread.message) {
        const messageContent = (
          plainThread.message as Pick<MessageEndpointRecord, 'content'>
        ).content;
        excerpt = messageContent
          ? textService.plainText(messageContent, true).substring(0, 100)
          : '…';
      } else {
        // Ensure this works even if messages couldn't be found for some reason
        excerpt = '…';
      }
      // If latest message in the thread was from current user, show
      // it as read - sender obviously read his/her own message
      if (
        plainThread.userFrom &&
        plainThread.userFrom._id &&
        plainThread.userFrom._id.toString() === authenticatedUserId.toString()
      ) {
        plainThread.read = true;
      }
      done(null, prepareThreadSummary(plainThread, excerpt));
    },
    callback,
  );
}

/**
 * List of threads aka inbox
 */
service.inbox = function (req, res) {
  // No user
  const user = authenticatedUser(req);
  if (!user) {
    return errorService.sendForbidden(res);
  }
  const query = req.query!;
  Thread.paginate(
    excludeBlockedUsers(
      query.filter === 'unread'
        ? {
            read: false,
            userTo: user._id,
          }
        : {
            // Returns only threads where currently authenticated user is participating member
            $or: [
              {
                userFrom: user,
              },
              {
                userTo: user,
              },
            ],
          },
      user,
    ),
    {
      page: query.page || 1,
      limit: query.limit || 20,
      sort: '-updated',
      select: threadFields,
      populate: [
        {
          path: 'message',
          select: 'content',
        },
        userMiniService.miniUserPopulate('userFrom userTo'),
      ],
    },
    function (err, data) {
      if (err) {
        return errorService.sendBadRequest(res, err);
      } else {
        // Pass pagination data to construct link header
        paginationService.setLinkHeader(
          { query },
          res as PaginatedResponse,
          data.pages,
        );

        // Sanitize and return threads
        sanitizeThreads(data.docs, user._id, function (err, threads) {
          // If user is deleted, the object from `User` collection is gone.
          // `Thread.paginate()` attempts to populate it but failing to do so,
          // leaves `userFrom` or `userTo` as `null` instead of just keeping
          // the original document `_id` which would still be useful at the frontend.
          // Until we refactor our code not to use `mongoose-paginate`, this helper
          // will backfill the IDs. Cumbersome and not optimal, but there are not that
          // many deleted profiles that this would be a significant issue.
          fillDeletedProfiles(threads, function (err, threads) {
            res.json(threads!);
          });
        });
      }
    },
  );
};

/**
 * Count the sender's distinct recipients in the throttle window.
 *
 * @param  {String} userId Message sender user ID
 * @return {number} Number of distinct recipients in the current window.
 */
async function recentRecipientCount(userId: Types.ObjectId): Promise<number> {
  const { duration } = config.limits.messagesToIndividualsThrottle;
  const timeLimit = moment().subtract(moment.duration(duration)).toDate();

  // Count how many persons this user has already written within the limit
  const writtenTo = await Message.distinct('userTo', {
    created: {
      $gte: timeLimit,
    },
    userFrom: userId,
  });
  return writtenTo.length;
}

/**
 * Send a message
 */
service.send = async function (req, res) {
  // No user
  const user = authenticatedUser(req);
  if (!user) {
    return errorService.sendForbidden(res);
  }
  const body = req.body!;
  const senderIsRestricted = userRolesService.hasRestrictedMessagingRole(user);

  // No receiver
  if (!body.userTo) {
    return res.status(400).send({
      message: 'Missing `userTo` field.',
    });
  }

  // Not a valid ObjectId
  if (!isValidObjectId(body.userTo)) {
    return errorService.sendInvalidId(res);
  }

  // Don't allow sending messages to myself
  if (user._id.equals(body.userTo as Parameters<typeof user._id.equals>[0])) {
    return res.status(403).send({
      message: 'Recepient cannot be currently authenticated user.',
    });
  }

  // No content or test if content is actually empty (when html is stripped out)
  if (!body.content || textService.isEmpty(body.content as string)) {
    return res.status(400).send({
      message: 'Please write a message.',
    });
  }

  // Throttle
  const isExemptFromThrottle = user.roles.some(role =>
    ['welcome-team', 'admin'].includes(role),
  );
  const recipientCount = isExemptFromThrottle
    ? 0
    : await recentRecipientCount(user._id);
  const shouldThrottle =
    !isExemptFromThrottle &&
    recipientCount > config.limits.messagesToIndividualsThrottle.count;
  if (shouldThrottle) {
    // Record thottle hit in stats
    statService.stat(
      {
        namespace: 'message-throttle',
        counts: {
          count: 1,
        },
        tags: {},
      },
      () => {},
    );
    try {
      await messageThrottleAlertService.notify(user, recipientCount);
    } catch (error) {
      log('error', 'Failed queuing message throttle notification.', { error });
    }
    return res.status(429).send({
      message: 'You are writing too many messages.',
    });
  }
  asyncCallbacks.waterfall(
    [
      // Check that receiving user is legitimate:
      // - Has to be confirmed their email (hence be public)
      // - Not suspended profile
      function (done: WaterfallDone) {
        // Only admins can send messages to banned users. For others they stay hidden.
        const publicityLimit = user.roles.includes('admin')
          ? {}
          : {
              public: true,
              roles: {
                $nin: ['suspended', 'shadowban'],
              },
            };
        User.findOne({
          _id: body.userTo,
          ...publicityLimit,
        })
          .exec()
          .then(
            function (receiver) {
              // If we were unable to find the receiver, return the error and stop here
              if (!receiver) {
                return res.status(404).send({
                  message: 'Member you are writing to does not exist.',
                });
              }
              done();
            },
            function () {
              return res.status(404).send({
                message: 'Member you are writing to does not exist.',
              });
            },
          );
      },
      // Check if this is first message to this thread (=does the thread object exist?)
      function (done: WaterfallDone<[ThreadEndpointDocument | null]>) {
        Thread.findOne({
          // User id's can be either way around in thread handle, so we gotta test for both situations
          $or: [
            {
              userTo: user._id,
              userFrom: body.userTo,
            },
            {
              userTo: body.userTo,
              userFrom: user._id,
            },
          ],
        }).then(function (thread) {
          done(null, thread);
        }, done);
      },
      // Check sender's profile isn't empty If it was first message
      // If the sending user has an empty profile, reject the message
      function (thread: ThreadEndpointDocument | null, done: WaterfallDone) {
        // If this was first message to the thread
        if (!thread) {
          User.findById(user._id, 'description')
            .exec()
            .then(
              function (sender) {
                const plainText = textService.plainText as (
                  value: string,
                  keepNewLines?: boolean,
                ) => string;
                const descriptionLength = sender?.description
                  ? plainText(sender.description).length
                  : 0;

                // If the sender has too empty description, return an error
                if (descriptionLength < config.profileMinimumLength) {
                  return res.status(400).send({
                    error: 'empty-profile',
                    limit: config.profileMinimumLength,
                    message:
                      descriptionLength === 0
                        ? 'Please fill out your profile description before you send messages.'
                        : 'Please write longer profile description before you send messages.',
                  });
                }

                // Continue
                done();
              },
              function (err) {
                done(err);
              },
            );
        } else {
          // It wasn't first message to this thread
          done();
        }
      },
      // Save message
      function (done: WaterfallDone<[MessageEndpointDocument]>) {
        const message = new Message(
          prepareNewMessageFields(
            {
              userTo: body.userTo as string,
              content: textService.html(body.content as string),
              read: false,
            },
            user._id,
          ),
        );
        // Mongoose casts a supplied User document to its ObjectId reference.
        message.userFrom = user as unknown as Types.ObjectId;
        // "Ghost-send" behavior: restricted senders can still see own messages,
        // but they are hidden from recipients.
        message.read = senderIsRestricted;
        message.shadowHidden = senderIsRestricted;
        message.notified = false;

        message.save().then(saved => done(null, saved), done);
      },
      // Create/upgrade Thread handle between these two users
      function (
        message: MessageEndpointDocument,
        done: WaterfallDone<[MessageEndpointDocument]>,
      ) {
        // Don't update recipient thread/inbox delivery state for shadow-hidden messages.
        if (message.shadowHidden) {
          return done(null, message);
        }
        const thread = new Thread();
        thread.updated = Date.now() as unknown as Date;
        thread.userFrom = message.userFrom;
        thread.userTo = message.userTo;
        thread.message = message as unknown as Types.ObjectId;
        thread.read = false;

        // Convert the Model instance to a simple object using Model's 'toObject' function
        // to prevent weirdness like infinite looping...
        const upsertData = thread.toObject() as Omit<
          ThreadEndpointRecord,
          '_id'
        > & { _id?: Types.ObjectId };

        // Delete the _id property, otherwise Mongo will return a "Mod on _id not allowed" error
        delete upsertData._id;

        // Do the upsert, which works like this: If no Thread document exists with
        // _id = thread.id, then create a new doc using upsertData.
        // Otherwise, update the existing doc with upsertData
        // @link http://stackoverflow.com/a/7855281
        Thread.updateOne(
          {
            // User id's can be either way around in old thread handle, so we gotta test for both situations
            $or: [
              {
                userTo: upsertData.userTo,
                userFrom: upsertData.userFrom,
              },
              {
                userTo: upsertData.userFrom,
                userFrom: upsertData.userTo,
              },
            ],
          },
          upsertData,
          {
            upsert: true,
          },
        ).then(
          () => done(null, message),
          (err: Error) => done(err, message),
        );
      },
      // Here we send some metrics to Stats API to measure how many messages
      // are sent, what type of messages, etc.
      function (
        message: MessageEndpointDocument,
        done: WaterfallDone<[MessageEndpointDocument]>,
      ) {
        messageToStatsService.save(message, function () {
          // do nothing
        });
        return done(null, message);
      },
      // Here we create or update the related MessageStat document in mongodb
      // It serves to count the user's reply rate and reply time
      function (
        message: MessageEndpointDocument,
        done: WaterfallDone<[MessageEndpointDocument]>,
      ) {
        // Messages hidden from their recipient must not lower reply rates or
        // contribute reply-time data.
        if (!message.shadowHidden) {
          messageStatService.updateMessageStat(
            message as MessageRecord & {
              content: string;
              created: Date;
              userFrom: Types.ObjectId;
              userTo: Types.ObjectId;
            },
            function () {
              // do nothing
            },
          );
        }
        return done(null, message);
      },
      // We'll need some info about related users, populate some fields
      function (message: MessageEndpointDocument, done: WaterfallDone) {
        message
          .populate([userMiniService.miniUserPopulate('userFrom userTo')])
          .then(populated => {
            // Turn to object to be able to delete fields
            const messageObject = populated.toObject();

            // Finally return the approved message fields.
            return res.json(prepareMessageForClient(messageObject));
          })
          .catch(done);
      },
    ],
    function (err?: unknown) {
      /* istanbul ignore else */
      if (err) {
        log(
          'error',
          'Message failed to send. #sa239',
          err as Record<string, unknown>,
        );
        return errorService.sendBadRequest(res, err);
      }
    },
  );
};

/**
 * Thread of messages
 */
service.thread = function (req, res) {
  // Sanitize messages
  const messages =
    req.messages && req.messages.length
      ? sanitizeMessages(req.messages as MessageEndpointRecord[])
      : [];
  res.json(messages.map(message => prepareMessageForClient(message)));
};

/**
 * Thread middleware
 */
service.threadByUser = function (req, res, next, userId) {
  const user = authenticatedUser(req);
  if (!user) {
    return errorService.sendForbidden(res);
  }

  // Not user id or its not a valid ObjectId
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return errorService.sendInvalidId(res);
  }

  // TODO do we want to allow to see the messages from suspended or banned users
  // in order to make them "read"?

  asyncCallbacks.waterfall(
    [
      // Find messages
      function (done: WaterfallDone<[PopulatedMessageEndpointDocument[]]>) {
        const query = req.query!;
        Message.paginate(
          excludeBlockedUsers(
            {
              $or: [
                {
                  userFrom: user._id,
                  userTo: userId,
                },
                {
                  userTo: user._id,
                  userFrom: userId,
                  shadowHidden: {
                    $ne: true,
                  },
                },
              ],
            },
            user,
          ),
          {
            page: query.page || 1,
            limit: query.limit || 20,
            sort: '-created',
            select: messageFields,
            populate: userMiniService.miniUserPopulate('userFrom userTo'),
          },
          function (err, data) {
            if (err) {
              return done(err);
            }
            if (!data || !data.docs) {
              return done(new Error('Failed to load messages.'));
            }

            // Pass pagination data to construct link header
            if (data.docs.length > 0) {
              paginationService.setLinkHeader(
                { query },
                res as PaginatedResponse,
                data.pages,
              );
            }
            done(err, data.docs);
          },
        );
      },
      function (
        messages: PopulatedMessageEndpointDocument[],
        done: WaterfallDone,
      ) {
        req.messages = messages;
        done();
      },
    ],
    function (err) {
      if (err) {
        return errorService.sendBadRequest(res, err);
      }
      next();
    },
  );
};

/**
 * Mark set of messages as read
 * Works only for currently logged in user's messages
 */
service.markRead = function (req, res) {
  const user = authenticatedUser(req);
  if (!user) {
    return errorService.sendForbidden(res);
  }
  const messageIds = req.body?.messageIds;
  if (
    !Array.isArray(messageIds) ||
    !messageIds.every(
      (id): id is string => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id),
    )
  ) {
    return res.status(400).send({ message: 'Invalid message identifiers.' });
  }
  if (messageIds.length === 0) {
    return res.status(200).send(prepareMarkReadResponse());
  }
  // Mark messages read
  Message.updateMany(prepareMarkReadSelector(messageIds, user.id), {
    read: true,
  })
    .then(() =>
      Thread.updateMany(
        { userTo: user._id, message: { $in: messageIds } },
        { $set: { read: true } },
      ),
    )
    .then(
      () => res.status(200).send(prepareMarkReadResponse()),
      (err: Error) =>
        res.status(400).send({
          message: errorService.getErrorMessage(err),
        }),
    );
};

/**
 * Get unread message count for currently logged in user
 */
service.messagesCount = function (req, res) {
  const user = authenticatedUser(req);
  if (!user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }
  Thread.countDocuments(
    excludeBlockedUsers(
      {
        read: false,
        userTo: user._id,
      },
      user,
    ),
  ).then(
    unreadCount => res.json(prepareUnreadMessageCount(unreadCount)),
    (err: Error) =>
      res.status(400).send({
        message: errorService.getErrorMessage(err),
      }),
  );
};

/**
 * Sync endpoint used by mobile messenger
 */
service.sync = function (req, res) {
  const user = authenticatedUser(req);
  if (!user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }

  // Root object to be sent out from this API endpoint
  const data: {
    messages:
      | Partial<Record<string, MessageEndpointDocument[]>>
      | MessageEndpointDocument[];
    users: HydratedDocument<PopulatedMessageUser>[];
  } = {
    messages: [],
    users: [],
  };
  asyncCallbacks.waterfall(
    [
      // Find messages
      function (done: WaterfallDone<[string[]]>) {
        const queryParams = req.query!;
        // Validate and construct date filters
        let dateFrom;
        let dateTo;
        const queryDate = {};
        if (_.has(req, 'query.dateFrom')) {
          dateFrom = moment(
            queryParams.dateFrom as Parameters<typeof moment>[0],
          );

          // Validate `dateFrom`
          if (!dateFrom.isValid()) {
            return res.status(400).send({
              message: 'Invalid `dateFrom`.',
            });
          }

          // Append dateFrom to date query
          _.set(queryDate, 'created.$gt', dateFrom.toDate());
        }
        if (_.has(req, 'query.dateTo')) {
          dateTo = moment(queryParams.dateTo as Parameters<typeof moment>[0]);
          // Validate `dateTo`
          if (!dateTo.isValid()) {
            return res.status(400).send({
              message: 'Invalid `dateTo`.',
            });
          }

          // Append dateTo to date query
          _.set(queryDate, 'created.$lt', dateTo.toDate());
        }

        // Validate correct order of dates
        if (dateFrom && dateTo && dateFrom.isAfter(dateTo)) {
          return res.status(400).send({
            message: 'Invalid dates: `dateFrom` cannot be later than `dateTo`',
          });
        }

        // Construct final Mongo query
        let messageQuery: Record<string, unknown>;

        // This is always part of the query
        const queryUsers = excludeBlockedUsers(
          {
            $or: [
              {
                userFrom: user._id,
              },
              {
                userTo: user._id,
                shadowHidden: {
                  $ne: true,
                },
              },
            ],
          },
          user,
        );

        // Filter only by user or also by date?
        if (_.has(queryDate, 'created')) {
          // Construct query with date limits
          messageQuery = {
            $and: [queryUsers, queryDate],
          };
        } else {
          // Construct query without date limit
          messageQuery = queryUsers;
        }

        // Run the query
        Message.find(messageQuery)
          .sort({
            created: -1,
          })
          .select(messageFields)
          .exec()
          .then(
            function (messages) {
              // Sanitize messages
              messages = sanitizeMessages(messages);

              // Collect user ids
              let userIds: string[] = [];

              // Re-group messages by users
              data.messages = _.groupBy(messages, function (row) {
                // Collect user id
                userIds.push(row.userTo.toString());
                userIds.push(row.userFrom.toString());

                // Determines key of the group
                if (row.userTo === user._id) {
                  return row.userFrom;
                }
                return row.userTo;
              });

              // Ensure we have only one of each user ids
              userIds = _.uniq(userIds);
              done(null, userIds);
            },
            function (err) {
              done(err);
            },
          );
      },
      // Collect users
      function (userIds: string[], done: WaterfallDone) {
        // Get objects for users based on above user ids
        User.find({
          _id: {
            $in: userIds,
          },
        })
          .select(userMiniService.userMiniProfileFields)
          .exec()
          .then(
            function (users) {
              data.users = users;
              done();
            },
            function (err) {
              done(err);
            },
          );
      },
      // Return the package
      function () {
        return res.json(data);
      },
    ],
    function (err) {
      /* istanbul ignore else */
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};

/**
 * Mark all the messages of which the user with given userId is receiver notified (notificationCount: 2)
 * @param {string} userId
 * @param {function} callback - function (?error) {}
 */
service.markAllMessagesToUserNotified = function (userId, callback) {
  Message.updateMany(
    { userTo: userId },
    { $set: { notificationCount: 2 } },
  ).then(() => callback(null), callback);
};
/** Format a draft without saving it or touching conversation state. */
service.preview = function (req, res) {
  if (!req.user) {
    return res.status(403).json({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }
  const content = req.body?.content;
  if (typeof content !== 'string' || textService.isEmpty(content)) {
    return res.status(400).json({ message: 'Please write a message.' });
  }
  return res.json(preparePreviewMessageResponse(textService.html(content)));
};
const preview = service.preview;
const inbox = service.inbox;
const markAllMessagesToUserNotified = service.markAllMessagesToUserNotified;
const markRead = service.markRead;
const messagesCount = service.messagesCount;
const sanitizeMessagesExport = service.sanitizeMessages;
const send = service.send;
const sync = service.sync;
const thread = service.thread;
const threadByUser = service.threadByUser;
export {
  preview,
  inbox,
  markAllMessagesToUserNotified,
  markRead,
  messagesCount,
  sanitizeMessagesExport as sanitizeMessages,
  send,
  sync,
  thread,
  threadByUser,
};
export default service;
export { service as 'module.exports' };
