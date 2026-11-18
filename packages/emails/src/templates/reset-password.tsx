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

export default function ResetPassword(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hey {p.name}!</P>
      <P>
        Someone (probably you) requested an account recovery on Trustroots for{' '}
        {p.email}.
      </P>
      <P>
        If you did not request this, just ignore this email. We&apos;ll keep
        your account safe.
      </P>
      <P>Please click the reset link below to reset your password.</P>
      <Button href={p.urlConfirm} label="Reset password" />
      <CopyPasteUrl url={p.urlConfirmPlainText} />
    </EmailLayout>
  );
}

ResetPassword.PreviewProps = {
  ...previewParams,
  mailTitle: 'Password Reset',
  name: 'Alex',
  email: 'alex@example.org',
  urlConfirm: 'https://www.trustroots.org/api/auth/reset/token',
  urlConfirmPlainText: 'https://www.trustroots.org/api/auth/reset/token',
} satisfies Props;
