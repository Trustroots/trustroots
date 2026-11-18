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
  urlConfirm?: string;
  urlConfirmPlainText?: string;
}

export default function Signup(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>{p.name},</P>
      <P>Thank you very much for signing up with us.</P>
      <P>
        Confirm your email address ({p.email}) to complete your Trustroots
        account.
      </P>
      <P>It&apos;s easy — just click on the button below.</P>
      <Button href={p.urlConfirm} label="Confirm now" />
      <CopyPasteUrl url={p.urlConfirmPlainText} />
    </EmailLayout>
  );
}

Signup.PreviewProps = {
  ...previewParams,
  mailTitle: 'Confirm your email address',
  name: 'Alex',
  email: 'alex@example.org',
  urlConfirm: 'https://www.trustroots.org/confirm-email/token?signup=true',
  urlConfirmPlainText:
    'https://www.trustroots.org/confirm-email/token?signup=true',
} satisfies Props;
