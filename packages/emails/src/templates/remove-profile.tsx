import {
  A,
  Button,
  CopyPasteUrl,
  EmailLayout,
  P,
  type EmailParams,
} from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  name?: string;
  urlCancel?: string;
  urlConfirm?: string;
  urlConfirmPlainText?: string;
}

export default function RemoveProfile(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hey {p.name}!</P>
      <P>Someone (probably you) requested removing your Trustroots account.</P>
      <P>
        If you did not request this, just ignore this email. We&apos;ll keep
        your account safe.
      </P>
      <P>
        Are you sure you want to delete your profile? Deletion is permanent once
        you confirm it and cannot be undone.
      </P>
      <P>
        This link opens a final confirmation page. Your account will not be
        deleted unless you confirm there. The link is valid for 24 hours.
      </P>
      <Button href={p.urlConfirm} label="Review account deletion" />
      <CopyPasteUrl url={p.urlConfirmPlainText} />
      <P>
        Changed your mind? <A href={p.urlCancel}>Cancel account deletion</A> in
        Account settings to invalidate this confirmation link and keep your
        account.
      </P>
    </EmailLayout>
  );
}

RemoveProfile.PreviewProps = {
  ...previewParams,
  mailTitle: 'Confirm removing your Trustroots profile',
  name: 'Alex',
  urlCancel: 'https://www.trustroots.org/profile/edit/account',
  urlConfirm: 'https://www.trustroots.org/remove/token',
  urlConfirmPlainText: 'https://www.trustroots.org/remove/token',
} satisfies Props;
