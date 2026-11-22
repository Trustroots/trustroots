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
  userFrom: { firstName?: string };
  userTo: { firstName?: string };
  userFromProfileUrl?: string;
  seeExperiencesUrl?: string;
  seeExperiencesUrlPlainText?: string;
}

export default function ExperienceNotificationSecond(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hi {p.userTo.firstName}!</P>
      <P>
        <A href={p.userFromProfileUrl}>{p.userFrom.firstName}</A> has shared
        also their experience with you. Both of your experiences are now public.
      </P>
      <Button href={p.seeExperiencesUrl} label="See the experience" />
      <CopyPasteUrl url={p.seeExperiencesUrlPlainText} />
    </EmailLayout>
  );
}

ExperienceNotificationSecond.PreviewProps = {
  ...previewParams,
  mailTitle: 'Sam shared their experience',
  userFrom: { firstName: 'Sam' },
  userTo: { firstName: 'Alex' },
  userFromProfileUrl: 'https://www.trustroots.org/profile/sam',
  seeExperiencesUrl: 'https://www.trustroots.org/profile/alex/experiences',
  seeExperiencesUrlPlainText:
    'https://www.trustroots.org/profile/alex/experiences',
} satisfies Props;
