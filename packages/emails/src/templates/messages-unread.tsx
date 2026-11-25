import {
  A,
  Button,
  EmailLayout,
  MemberHtml,
  P,
  type EmailParams,
} from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

export interface MessagesUnreadProps extends EmailParams {
  userToName?: string;
  userFromName?: string;
  messageCount: number;
  messages: Array<{ content: string; plainText?: string }>;
  urlReply?: string;
  urlUserFromProfile?: string;
}

export default function MessagesUnread(p: MessagesUnreadProps) {
  return (
    <EmailLayout params={p}>
      <P>Hello {p.userToName}!</P>
      <P>
        {p.messageCount > 1
          ? `You have ${p.messageCount} unread messages from `
          : 'You have one unread message from '}
        <strong>
          <A href={p.urlUserFromProfile}>{p.userFromName}</A>
        </strong>{' '}
        at Trustroots.
      </P>
      {p.messages.map((message, index) => (
        <MemberHtml
          key={index}
          html={message.content}
          className="unread-message-content"
        />
      ))}
      <P>
        <strong>Safety note:</strong> Trustroots will never ask you for your ID,
        credit card details, or payment of any kind.
      </P>
      <Button href={p.urlReply} label={`Reply to ${p.userFromName}`} />
      {p.unsubscribeUrl && (
        <P>
          <A href={p.unsubscribeUrl}>Unsubscribe from unread-message emails</A>
        </P>
      )}
    </EmailLayout>
  );
}

MessagesUnread.PreviewProps = {
  ...previewParams,
  mailTitle: 'Sam Rivers wrote you from Trustroots',
  userToName: 'Alex',
  userFromName: 'Sam Rivers',
  messageCount: 2,
  messages: [
    { content: '<p>Hi! Could I stay with you next week?</p>' },
    { content: '<p>I arrive on <b>Tuesday</b>.</p>' },
  ],
  urlReply: 'https://www.trustroots.org/messages/sam',
  urlUserFromProfile: 'https://www.trustroots.org/profile/sam',
  unsubscribeUrl: 'https://www.trustroots.org/email/unsubscribe/token',
} satisfies MessagesUnreadProps;
