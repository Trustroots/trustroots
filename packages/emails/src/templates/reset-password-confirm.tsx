import { A, EmailLayout, P, type EmailParams } from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  name?: string;
  urlResetPassword?: string;
}

export default function ResetPasswordConfirm(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hey {p.name}!</P>
      <P>Your Trustroots account password has just been changed.</P>
      <P>
        If you did not change it, please{' '}
        <A href={p.urlResetPassword}>reset your password now.</A>
      </P>
    </EmailLayout>
  );
}

ResetPasswordConfirm.PreviewProps = {
  ...previewParams,
  mailTitle: 'Your password has been changed',
  name: 'Alex',
  urlResetPassword: 'https://www.trustroots.org/password/forgot',
} satisfies Props;
