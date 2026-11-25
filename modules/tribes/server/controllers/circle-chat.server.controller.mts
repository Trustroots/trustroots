import type { Express, Request, RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose, { type Types } from 'mongoose';
import type { TribeRecord } from '../models/tribe.server.model.mts';
import {
  chatTopics,
  MAX_CHAT_LENGTH,
  type ChatRoom,
} from '../../shared/circle-chat.ts';
import {
  publishCircleChat,
  readCircleChat,
} from '../services/circle-chat.server.mts';

interface ChatRequest extends Request {
  user?: {
    _id: { toString(): string };
    username: string;
    roles: string[];
    member?: { tribe: Types.ObjectId }[];
  };
}

function sendError(
  res: Parameters<RequestHandler>[1],
  status: number,
  message: string,
) {
  return res.status(status).json({ message });
}

const requireChatAccount: RequestHandler = (req: ChatRequest, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  const { user } = req;
  if (!user) return sendError(res, 401, 'Sign in to use circle chat.');
  if (user.roles.some(role => role === 'suspended' || role === 'shadowban'))
    return sendError(res, 403, 'Circle chat is unavailable for this account.');
  if (!Object.hasOwn(chatTopics, req.params.room as string))
    return sendError(res, 404, 'Chat room not found.');
  next();
};

const getChat: RequestHandler = async (req, res) => {
  try {
    res.json(await readCircleChat(req.params.room as ChatRoom));
  } catch {
    sendError(res, 503, 'Circle chat is temporarily unavailable.');
  }
};

const requireChatMembership: RequestHandler = async (
  req: ChatRequest,
  res,
  next,
) => {
  const slug = req.params.room;
  if (slug === 'volunteering') return next();
  const tribeIds = req.user!.member?.map(({ tribe }) => tribe) ?? [];
  try {
    const tribe = await mongoose.model<TribeRecord>('Tribe').exists({
      slug,
      _id: { $in: tribeIds },
    });
    if (!tribe) return sendError(res, 403, 'Join this circle to access chat.');
    next();
  } catch {
    sendError(res, 503, 'Circle chat is temporarily unavailable.');
  }
};

const postChat: RequestHandler = async (req: ChatRequest, res) => {
  const user = req.user!;
  const room = req.params.room as ChatRoom;
  const { content: rawContent, channel } = (req.body ?? {}) as {
    content?: unknown;
    channel?: unknown;
  };
  const content = typeof rawContent === 'string' ? rawContent.trim() : '';
  if (!content || content.length > MAX_CHAT_LENGTH)
    return sendError(res, 400, 'Enter a chat message of up to 500 characters.');
  if (
    channel !== undefined &&
    (room !== 'radio' ||
      typeof channel !== 'string' ||
      !/^[A-Za-z0-9_-]{1,80}$/.test(channel))
  )
    return sendError(res, 400, 'Invalid radio station.');

  try {
    const event = await publishCircleChat(
      room,
      user.username,
      content,
      channel,
    );
    res.status(201).json(event);
  } catch {
    sendError(res, 503, 'Circle chat is temporarily unavailable.');
  }
};

export function registerCircleChat(app: Express) {
  const postLimit = rateLimit({
    windowMs: 60_000,
    limit: 12,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req: ChatRequest) => req.user!._id.toString(),
    message: { message: 'Too many chat messages. Please try again shortly.' },
  });
  app
    .route('/api/tribes/chat/:room')
    .all(requireChatAccount, requireChatMembership)
    .get(getChat)
    .post(postLimit, postChat);
}
