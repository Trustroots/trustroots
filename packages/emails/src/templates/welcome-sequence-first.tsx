import { A, EmailLayout, P, type EmailParams } from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  name?: string;
  from: { name?: string; address?: string };
  urlEditProfile?: string;
  urlFAQ?: string;
}

export default function WelcomeSequenceFirst(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hi {p.name}!</P>
      <P>
        This is {p.from.name} from the Trustroots Foundation. Trustroots is an
        open, transparent, fun, and international sharing community. We believe
        in a world where people can trust each other.
      </P>
      <P>
        Please take a few minutes to{' '}
        <A href={p.urlEditProfile}>fill out your profile</A>. That is the
        foundation of your experience in Trustroots.
      </P>
      <P>
        If you have any issues using Trustroots, check our{' '}
        <A href={p.urlFAQ}>frequently asked questions</A> or simply reply this
        email.
      </P>
      <P>
        Happy trails!
        <br />
        {p.from.name}
      </P>
    </EmailLayout>
  );
}

WelcomeSequenceFirst.PreviewProps = {
  ...previewParams,
  mailTitle: 'Welcome to Trustroots',
  name: 'Alex',
  from: { name: 'Robin', address: 'robin@example.org' },
  urlEditProfile: 'https://www.trustroots.org/profile/edit',
  urlFAQ: 'https://www.trustroots.org/faq',
} satisfies Props;
