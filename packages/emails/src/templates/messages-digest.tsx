import { A, EmailLayout, P, type EmailParams } from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  conversations: Array<{ displayName: string; count: number; url: string }>;
}

export default function MessagesDigest(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>You have unread conversations on Trustroots.</P>
      <ul className="text-[16px] leading-[1.25] text-body">
        {p.conversations.map(conversation => (
          <li key={conversation.url}>
            <A href={conversation.url}>{conversation.displayName}</A> (
            {conversation.count} unread)
          </li>
        ))}
      </ul>
      <P>
        <A href={p.unsubscribeUrl}>Unsubscribe from unread-message emails</A>
      </P>
    </EmailLayout>
  );
}

MessagesDigest.PreviewProps = {
  ...previewParams,
  mailTitle: 'Unread conversations on Trustroots',
  conversations: [
    {
      displayName: 'Sam Rivers',
      count: 3,
      url: 'https://www.trustroots.org/messages/sam',
    },
    {
      displayName: 'Robin Vale',
      count: 1,
      url: 'https://www.trustroots.org/messages/robin',
    },
  ],
  unsubscribeUrl: 'https://www.trustroots.org/email/unsubscribe/token',
} satisfies Props;
