import React from 'react';
import { Badge } from '@trustroots/ui/Badge';

// Internal dependencies
import UserLink from './UserLink.component';
import { getAdminMessagesHref } from '../utils/member-url';

interface ReferenceUserSummary {
  _id?: string;
  username?: string;
  displayName?: string;
}

interface ReferenceVote {
  _id?: string;
  reference?: string;
  userFrom?: string | (ReferenceUserSummary & { _id: string });
  userTo?: string | (ReferenceUserSummary & { _id: string });
}

function getReferenceLabel(reference = '') {
  if (reference === 'yes') {
    return {
      tone: 'success' as const,
      text: 'positive',
      textClassName: 'text-success',
    };
  }

  return {
    tone: 'danger' as const,
    text: 'negative',
    textClassName: 'text-danger',
  };
}

export default function AdminReferenceVoteItem({
  referenceThread,
  showBadge = false,
  showMessagesLink = false,
}: {
  referenceThread: ReferenceVote;
  showBadge?: boolean;
  showMessagesLink?: boolean;
}) {
  const { tone, text, textClassName } = getReferenceLabel(
    referenceThread.reference,
  );
  const messagesHref = getAdminMessagesHref(
    referenceThread.userFrom,
    referenceThread.userTo,
  );

  if (showBadge) {
    return (
      <li>
        <Badge variant="solid" tone={tone}>
          {text}
        </Badge>{' '}
        <UserLink
          user={
            typeof referenceThread.userFrom === 'object'
              ? referenceThread.userFrom
              : undefined
          }
        />
        {' voted for '}
        <UserLink
          user={
            typeof referenceThread.userTo === 'object'
              ? referenceThread.userTo
              : undefined
          }
        />
        {showMessagesLink && messagesHref && (
          <>
            {' · '}
            <a href={messagesHref}>Read messages</a>
          </>
        )}
      </li>
    );
  }

  return (
    <li>
      <UserLink
        user={
          typeof referenceThread.userFrom === 'object'
            ? referenceThread.userFrom
            : undefined
        }
      />
      {' voted '}
      <span className={textClassName}>{text}</span>
      {' for '}
      <UserLink
        user={
          typeof referenceThread.userTo === 'object'
            ? referenceThread.userTo
            : undefined
        }
      />
    </li>
  );
}
