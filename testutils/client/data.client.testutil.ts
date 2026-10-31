import range from 'lodash/range';

import {
  generateClientUser,
  generateId,
} from '../common/data.common.testutil.mts';
import type {
  MessageMember,
  MessagePayload,
  MessageThreadSummary,
} from '@/modules/messages/shared/messages';

export { generateClientUser };

export interface FixtureMessageUser extends MessageMember {
  public?: boolean;
  description?: string;
  blocked?: string[];
  languages?: string[];
}

type FixtureThread = MessageThreadSummary & {
  userFrom: FixtureMessageUser;
  userTo: FixtureMessageUser;
};

type FixtureMessage = MessagePayload & {
  userFrom: FixtureMessageUser;
  userTo: FixtureMessageUser;
};

export function generateThreads(
  count: number,
  users: { userFrom?: FixtureMessageUser; userTo?: FixtureMessageUser } = {},
): FixtureThread[] {
  return range(count).map(() => generateThread(users));
}

export function generateMessage(
  userFrom: FixtureMessageUser,
  userTo: FixtureMessageUser = generateClientUser(),
): FixtureMessage {
  return {
    _id: generateId(),
    userFrom,
    userTo,
    created: new Date().toISOString(),
    content: 'A fictional message.',
    read: true,
  };
}

export function generateThread({
  userFrom = generateClientUser(),
  userTo = generateClientUser(),
}: {
  userFrom?: FixtureMessageUser;
  userTo?: FixtureMessageUser;
} = {}): FixtureThread {
  return {
    _id: generateId(),
    read: true,
    updated: new Date().toISOString(),
    message: {
      excerpt: 'A fictional conversation preview.',
    },
    userFrom,
    userTo,
  };
}
