import {
  A,
  Button,
  CopyPasteUrl,
  EmailLayout,
  MemberHtml,
  P,
  type EmailParams,
} from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  name?: string;
  meName?: string;
  meURL?: string;
  messageHTML?: string | false;
  urlConfirm?: string;
  urlConfirmPlainText?: string;
}

export default function ConfirmContact(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hey {p.name}!</P>
      <P>
        <A href={p.meURL}>{p.meName}</A> would like to connect with you on
        Trustroots.
      </P>
      {p.messageHTML && <MemberHtml html={p.messageHTML} />}
      <P>To confirm or discard this connection, please click the link below.</P>
      <Button href={p.urlConfirm} label="See connection" />
      <CopyPasteUrl url={p.urlConfirmPlainText} />
    </EmailLayout>
  );
}

ConfirmContact.PreviewProps = {
  ...previewParams,
  mailTitle: 'Confirm connection',
  name: 'Alex',
  meName: 'Sam Rivers',
  meURL: 'https://www.trustroots.org/profile/sam',
  messageHTML: '<p>We met at the <b>meetup</b> last week!</p>',
  urlConfirm: 'https://www.trustroots.org/contact-confirm/contact-id',
  urlConfirmPlainText: 'https://www.trustroots.org/contact-confirm/contact-id',
} satisfies Props;
