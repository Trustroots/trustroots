import type { ReactNode } from 'react';
import {
  Body,
  Button as EmailButton,
  Container,
  Head,
  Html,
  Link,
  pixelBasedPreset,
  Section,
  Tailwind,
  Text,
} from 'react-email';
import { emailColors } from '../colors.ts';

/** Parameters the email service adds to every email. */
export interface EmailParams {
  mailTitle?: string;
  from?: string | { name?: string; address?: string };
  headerUrl?: string;
  footerUrl?: string;
  supportUrl?: string;
  urlSupportPlainText?: string;
  profileUrl?: string;
  unsubscribeUrl?: string;
}

const tailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: emailColors,
      fontFamily: { sans: ['Helvetica', 'Arial', 'sans-serif'] },
    },
  },
};

export const emailClasses = {
  paragraph: 'my-4 text-[16px] leading-[1.25] text-body',
  link: 'text-brand underline',
  button:
    'my-2 block rounded bg-brand p-[15px] text-center text-[18px] font-bold leading-none text-white no-underline',
  footer: 'text-center text-[12px] leading-[1.25] text-footer',
  footerLink: 'text-footer underline',
};

export function P({ children }: { children?: ReactNode }) {
  return <Text className={emailClasses.paragraph}>{children}</Text>;
}

export function A({ href, children }: { href?: string; children: ReactNode }) {
  return (
    <Link href={href} className={emailClasses.link}>
      {children}
    </Link>
  );
}

export function Button({ href, label }: { href?: string; label: string }) {
  return href ? (
    <EmailButton href={href} className={emailClasses.button}>
      {label}
    </EmailButton>
  ) : null;
}

export function CopyPasteUrl({ url }: { url?: string }) {
  return url ? (
    <>
      <P>You may copy/paste this link into your browser:</P>
      <P>
        <small>{url}</small>
      </P>
    </>
  ) : null;
}

/** Pre-sanitised HTML from a member, on a grey background. */
export function MemberHtml({ html }: { html: string }) {
  return (
    <Section className="my-4 bg-well px-5 py-1 text-[16px] leading-[1.25] text-body">
      {/* The email service sanitises member content with sanitize-html. */}
      {/* nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </Section>
  );
}

export function SocialMedia() {
  return (
    <P>
      Like our{' '}
      <A href="https://www.facebook.com/trustroots.org/?ref=welcome-email">
        Facebook page
      </A>
      , join our{' '}
      <A href="https://www.facebook.com/groups/trustroots/?ref=welcome-email">
        Facebook group
      </A>{' '}
      and follow us on <A href="https://twitter.com/trustroots">Twitter</A> or{' '}
      <A href="https://www.instagram.com/trustroots/">Instagram</A> — it would
      really help us out!
    </P>
  );
}

function FooterLink({ href, children }: { href?: string; children: string }) {
  return href ? (
    <Link href={href} className={emailClasses.footerLink}>
      {children}
    </Link>
  ) : (
    children
  );
}

function Footer({ params }: { params: EmailParams }) {
  const { from, supportUrl, profileUrl, footerUrl } = params;
  return (
    <Text className={emailClasses.footer}>
      {from ? (
        supportUrl && (
          <>
            <FooterLink href={supportUrl}>Contact us</FooterLink>
            <br />
            <br />
          </>
        )
      ) : (
        <>
          This is an automated email. Please don’t reply directly.
          <br />
          {supportUrl && (
            <>
              Need help?{' '}
              <FooterLink href={supportUrl}>
                Contact the Trustroots team
              </FooterLink>
              .
            </>
          )}
          <br />
          <br />
        </>
      )}
      You are receiving this email because you have{' '}
      <FooterLink href={profileUrl}>an active account</FooterLink> on
      Trustroots.
      <br />
      <br />
      <FooterLink href={footerUrl}>Trustroots Foundation</FooterLink>
      <br />
      Carpenter Court 1 Maple Road, Bramhall, Stockport, Cheshire, United
      Kingdom, SK7 2DH
    </Text>
  );
}

export function EmailLayout({
  params,
  children,
}: {
  params: EmailParams;
  children: ReactNode;
}) {
  const logo = (
    <Text className="m-0 mb-2.5 mt-1 text-center text-[15px] font-bold leading-[17px] text-footer">
      TRUSTROOTS
    </Text>
  );
  return (
    <Tailwind config={tailwindConfig}>
      <Html>
        <Head>
          <title>{params.mailTitle}</title>
        </Head>
        <Body className="m-0 bg-page py-2.5 font-sans">
          <Container className="max-w-[600px] px-2.5">
            <Section className="pt-2.5 text-center" data-skip-in-text>
              {params.headerUrl ? (
                <Link href={params.headerUrl} className="no-underline">
                  {logo}
                </Link>
              ) : (
                logo
              )}
            </Section>
            <Section className="rounded border border-solid border-line bg-white px-5 py-1">
              {children}
            </Section>
            <Section className="px-5 pt-5 pb-10">
              <Footer params={params} />
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}
