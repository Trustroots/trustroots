import { A, EmailLayout, P, type EmailParams } from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  name?: string;
  supportUrl?: string;
  requestedAt?: string;
}

export default function EmailChangeNotification(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hey {p.name}!</P>
      <P>
        An email address change was requested for your Trustroots account on{' '}
        {p.requestedAt}.
      </P>
      <P>
        Your current address stays active until the new address is confirmed.
      </P>
      <P>
        If you did not request this change,{' '}
        <A href={p.supportUrl}>contact Trustroots support</A>.
      </P>
    </EmailLayout>
  );
}

EmailChangeNotification.PreviewProps = {
  ...previewParams,
  mailTitle: 'An email change was requested',
  name: 'Alex',
  requestedAt: '2026-11-26 06:00 UTC',
  supportUrl: 'https://www.trustroots.org/support',
} satisfies Props;
