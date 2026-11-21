import {
  A,
  EmailLayout,
  P,
  SocialMedia,
  type EmailParams,
} from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  name?: string;
  from: { name?: string; address?: string };
  urlMeetup?: string;
}

export default function WelcomeSequenceSecond(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hi {p.name}!</P>
      <P>
        I&apos;m {p.from.name} from the Trustroots Foundation. How are your
        first impressions from Trustroots — anything missing? If you have any
        feedback for us, you can simply reply to this email.
      </P>
      <P>
        Trustroots is not only about hosting others but also about meeting
        community members. To make it easier for others to find you, you can{' '}
        <A href={p.urlMeetup}>create a meetup</A>.
      </P>
      <SocialMedia />
      <P>Have a good one! {p.from.name}</P>
    </EmailLayout>
  );
}

WelcomeSequenceSecond.PreviewProps = {
  ...previewParams,
  mailTitle: 'How is it going?',
  name: 'Alex',
  from: { name: 'Robin', address: 'robin@example.org' },
  urlMeetup: 'https://www.trustroots.org/offer/meet',
} satisfies Props;
