import { A, EmailLayout, P, type EmailParams } from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  firstName?: string;
  urlOffer?: string;
  urlSurvey?: string | false;
}

export default function ReactivateHosts(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hi {p.firstName},</P>
      <P>
        you haven&apos;t been hosting for a while, would you like to host again?
        <br />
        <A href={p.urlOffer}>Change your status here</A>.
      </P>
      {p.urlSurvey && (
        <P>
          If you&apos;ve decided to stop hosting, we&apos;d absolutely love to
          <br />
          hear why on <A href={p.urlSurvey}>this 1 question survey</A>.
        </P>
      )}
      <P>Thanks for being part of the Trustroots community!</P>
      {p.unsubscribeUrl && (
        <P>
          <A href={p.unsubscribeUrl}>Unsubscribe from hosting reminders</A>
        </P>
      )}
    </EmailLayout>
  );
}

ReactivateHosts.PreviewProps = {
  ...previewParams,
  mailTitle: 'Would you like to host again?',
  firstName: 'Alex',
  urlOffer: 'https://www.trustroots.org/offer/host',
  urlSurvey: 'https://ideas.trustroots.org/survey',
  unsubscribeUrl: 'https://www.trustroots.org/email/unsubscribe/token',
} satisfies Props;
