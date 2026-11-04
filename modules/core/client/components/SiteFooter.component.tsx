import React from 'react';
import classnames from 'classnames';

import {
  useAnalytics,
  type NavigationItem,
} from '@trustroots/analytics/client';
import BoardCredits, { type PhotoCredit } from './BoardCredits';

export type Build = {
  branch?: string;
  committedAt?: string;
  commitUrl?: string;
  shortCommit?: string;
};
type Props = {
  build?: Build | null;
  photoCredits?: Record<string, PhotoCredit>;
  variant?: string;
};

function BuildLink({ build }: { build?: Build | null }) {
  if (!build || !build.commitUrl || !build.committedAt || !build.shortCommit) {
    return null;
  }

  const branch = build.branch && build.branch !== 'main' ? build.branch : null;
  const deployedCodeLabel = branch
    ? `Currently deployed code: ${branch}; ${build.committedAt} UTC (${build.shortCommit})`
    : `Currently deployed code: ${build.committedAt} UTC (${build.shortCommit})`;

  return (
    <a
      className="site-footer-build"
      href={build.commitUrl}
      rel="noopener"
      aria-label={deployedCodeLabel}
    >
      <span className="icon-github site-footer-build-icon" aria-hidden="true" />
      {branch && (
        <>
          <span className="site-footer-build-branch">{branch}</span>
          <span className="site-footer-build-separator" aria-hidden="true">
            ·
          </span>
        </>
      )}
      <span className="site-footer-build-commit">
        {build.committedAt} UTC ({build.shortCommit})
      </span>
    </a>
  );
}

const FOOTER_LINKS: {
  item: NavigationItem;
  href: string;
  label: string;
  external?: boolean;
}[] = [
  {
    item: 'volunteering',
    href: '/support?category=volunteering',
    label: 'Volunteering',
  },
  { item: 'rules', href: '/rules', label: 'Rules' },
  { item: 'safety', href: '/safety', label: 'Safety' },
  { item: 'faq', href: '/faq', label: 'FAQ' },
  {
    item: 'wiki',
    href: 'https://wiki.trustroots.org/',
    label: 'Wiki',
    external: true,
  },
  { item: 'privacy', href: '/privacy', label: 'Privacy' },
  { item: 'credits', href: '/credits', label: 'Credits' },
  { item: 'contact', href: '/contact', label: 'Contact' },
];

function FooterLinks() {
  const { track } = useAnalytics();

  return (
    <ul className="site-footer-links list-inline">
      {FOOTER_LINKS.map(({ item, href, label, external }) => (
        <li key={item}>
          <a
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            onClick={() =>
              track('navigation_clicked', { surface: 'footer', item })
            }
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function SharedFooter({ build, photoCredits, variant }: Props) {
  const showOnMobile = variant === 'admin' || variant === 'circle';

  return (
    <footer
      id="tr-footer"
      role="contentinfo"
      className={classnames('container hidden-print', {
        'hidden-xs': !showOnMobile,
        'site-footer-circle': variant === 'circle',
      })}
    >
      <div className="site-footer-content">
        <FooterLinks />
        <div className="site-footer-meta">
          <BuildLink build={build} />
          <BoardCredits photoCredits={photoCredits || {}} />
        </div>
      </div>
    </footer>
  );
}

export default function SiteFooter({
  build,
  photoCredits,
  variant = 'standard',
}: Props) {
  const { track } = useAnalytics();

  if (variant === 'account') {
    return (
      <footer className="site-footer-account hidden-print" role="contentinfo">
        <BuildLink build={build} />
      </footer>
    );
  }

  if (variant === 'home') {
    return (
      <footer className="site-footer-home hidden-print" role="contentinfo">
        <a
          href="/credits"
          onClick={() =>
            track('navigation_clicked', { surface: 'footer', item: 'credits' })
          }
        >
          Credits
        </a>
        <BuildLink build={build} />
        <BoardCredits photoCredits={photoCredits || {}} />
      </footer>
    );
  }

  return (
    <SharedFooter build={build} photoCredits={photoCredits} variant={variant} />
  );
}
