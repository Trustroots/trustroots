import {
  Button,
  CopyPasteUrl,
  EmailLayout,
  P,
  type EmailParams,
} from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  name?: string;
  email?: string;
  timeAgo?: string;
  reminderCount: number;
  reminderCountMax: number;
  urlConfirm?: string;
  urlConfirmPlainText?: string;
}

export default function SignupReminder(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>{p.name},</P>
      <P>
        We haven&apos;t heard from you since you signed up to Trustroots{' '}
        {p.timeAgo}.
      </P>
      <P>
        Your profile will not be visible to others if you don&apos;t confirm
        your email address ({p.email}).
      </P>
      <P>It&apos;s easy — just click on the link below.</P>
      <P>
        <small>
          <em>
            {p.reminderCount >= p.reminderCountMax
              ? 'This is our last reminder, after which we will stop sending you emails.'
              : `This is a reminder ${p.reminderCount}/${p.reminderCountMax}, after which we will stop sending you emails.`}
          </em>
        </small>
      </P>
      <Button href={p.urlConfirm} label="Confirm now" />
      <CopyPasteUrl url={p.urlConfirmPlainText} />
    </EmailLayout>
  );
}

SignupReminder.PreviewProps = {
  ...previewParams,
  mailTitle: 'Complete your signup to Trustroots',
  name: 'Alex',
  email: 'alex@example.org',
  timeAgo: '3 days ago',
  reminderCount: 1,
  reminderCountMax: 3,
  urlConfirm: 'https://www.trustroots.org/confirm-email/token?signup=true',
  urlConfirmPlainText:
    'https://www.trustroots.org/confirm-email/token?signup=true',
} satisfies Props;
