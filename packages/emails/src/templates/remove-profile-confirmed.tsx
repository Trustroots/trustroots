import { A, EmailLayout, P, type EmailParams } from '../components/layout.tsx';
import { previewParams } from './_preview.ts';

interface Props extends EmailParams {
  name?: string;
}

export default function RemoveProfileConfirmed(p: Props) {
  return (
    <EmailLayout params={p}>
      <P>Hey {p.name}!</P>
      <P>Your Trustroots account has been removed.</P>
      <P>
        Feel free to <A href={p.supportUrl}>leave us feedback</A>!
      </P>
      <P>
        If you think this was a mistake, please{' '}
        <A href={p.supportUrl}>contact us</A> immediately.
      </P>
    </EmailLayout>
  );
}

RemoveProfileConfirmed.PreviewProps = {
  ...previewParams,
  mailTitle: 'Your Trustroots profile has been removed',
  name: 'Alex',
} satisfies Props;
