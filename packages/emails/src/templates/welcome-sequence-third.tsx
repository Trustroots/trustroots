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
  topic?: 'fill-profile' | 'feedback';
  urlEditProfile?: string;
}

export default function WelcomeSequenceThird(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hi {p.name}!</P>
      <P>
        This is {p.from.name} from Trustroots Foundation. You signed up a little
        while ago, and I just wanted to check back.
      </P>
      {p.topic === 'fill-profile' ? (
        <P>
          Your profile seems to be quite empty. It would be very easy to take a
          short time to <A href={p.urlEditProfile}>fill it out</A>, and it would
          make it easier for you to connect with people on Trustroots.
        </P>
      ) : (
        <P>
          How has your experience with Trustroots been for you so far? I would
          be happy to hear any feedback. You can simply reply to this email.
        </P>
      )}
      <SocialMedia />
      <P>
        Happy traveling!
        <br />
        {p.from.name}
      </P>
    </EmailLayout>
  );
}

WelcomeSequenceThird.PreviewProps = {
  ...previewParams,
  mailTitle: 'Checking in',
  name: 'Alex',
  from: { name: 'Robin', address: 'robin@example.org' },
  topic: 'fill-profile',
  urlEditProfile: 'https://www.trustroots.org/profile/edit',
} satisfies Props;
