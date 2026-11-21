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
  userFrom: { displayName?: string };
  userTo: { firstName?: string };
  days?: number;
  userFromProfileUrl?: string;
  giveExperienceUrl?: string;
  giveExperienceUrlPlainText?: string;
}

export default function ExperienceNotificationFirst(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hello {p.userTo.firstName},</P>
      <P>
        <A href={p.userFromProfileUrl}>{p.userFrom.displayName}</A> has shared
        their experience with you on Trustroots.
      </P>
      <P>
        Would you like to share yours as well? You can{' '}
        <A href={p.giveExperienceUrl}>write about your experience</A> and both
        experiences will become public right after that.
      </P>
      <P>
        Not in the mood to do it now? You have {p.days} days to share your
        experience with them. After that their experience will become public and
        you will only be able to share your experience with limited choices.
      </P>
      <P>
        If you think this message is an error or if you don’t know this person,{' '}
        <A href={p.supportUrl}>let us know</A> so our Trust &amp; Safety team
        can look into it.
      </P>
      <Button href={p.giveExperienceUrl} label="Share your experience now" />
      <CopyPasteUrl url={p.giveExperienceUrlPlainText} />
    </EmailLayout>
  );
}

ExperienceNotificationFirst.PreviewProps = {
  ...previewParams,
  mailTitle: 'New experience from Sam Rivers',
  userFrom: { displayName: 'Sam Rivers' },
  userTo: { firstName: 'Alex' },
  days: 14,
  userFromProfileUrl: 'https://www.trustroots.org/profile/sam',
  giveExperienceUrl: 'https://www.trustroots.org/profile/sam/experiences/new',
  giveExperienceUrlPlainText:
    'https://www.trustroots.org/profile/sam/experiences/new',
} satisfies Props;
