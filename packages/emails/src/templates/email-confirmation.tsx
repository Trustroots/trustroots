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

export default function EmailConfirmation(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hey {p.name}!</P>
      <P>
        You initiated an email change at Trustroots. Please click the
        confirmation link below to confirm your new email address: {p.email}
      </P>
      <P>
        <strong>
          If you didn&apos;t make this request, you can ignore this email.
        </strong>
      </P>
      <Button href={p.urlConfirm} label="Confirm" />
      <CopyPasteUrl url={p.urlConfirmPlainText} />
    </EmailLayout>
  );
}

EmailConfirmation.PreviewProps = {
  ...previewParams,
  mailTitle: 'Confirm email change',
  name: 'Alex',
  email: 'alex.new@example.org',
  urlConfirm: 'https://www.trustroots.org/confirm-email/token',
  urlConfirmPlainText: 'https://www.trustroots.org/confirm-email/token',
} satisfies Props;
