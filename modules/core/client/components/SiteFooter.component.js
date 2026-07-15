import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

import BoardCredits from './BoardCredits';

function BuildLink({ build }) {
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

BuildLink.propTypes = {
  build: PropTypes.shape({
    branch: PropTypes.string,
    committedAt: PropTypes.string,
    commitUrl: PropTypes.string,
    shortCommit: PropTypes.string,
  }),
};

function FooterLinks() {
  return (
    <ul className="site-footer-links list-inline">
      <li>
        <a href="/volunteering">Volunteering</a>
      </li>
      <li>
        <a href="/rules">Rules</a>
      </li>
      <li>
        <a href="/faq">FAQ</a>
      </li>
      <li>
        <a href="https://wiki.trustroots.org/">Wiki</a>
      </li>
      <li>
        <a href="/privacy">Privacy</a>
      </li>
      <li>
        <a href="/contact">Contact</a>
      </li>
    </ul>
  );
}

function SharedFooter({ build, photoCredits, variant }) {
  const showOnMobile = variant === 'admin';

  return (
    <footer
      id="tr-footer"
      role="contentinfo"
      className={classnames('container hidden-print', {
        'hidden-xs': !showOnMobile,
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

SharedFooter.propTypes = {
  build: BuildLink.propTypes.build,
  photoCredits: PropTypes.object,
  variant: PropTypes.string,
};

export default function SiteFooter({
  build,
  photoCredits,
  variant = 'standard',
}) {
  if (variant === 'home') {
    return (
      <footer className="site-footer-home hidden-print" role="contentinfo">
        <BuildLink build={build} />
        <BoardCredits photoCredits={photoCredits || {}} />
      </footer>
    );
  }

  return (
    <SharedFooter build={build} photoCredits={photoCredits} variant={variant} />
  );
}

SiteFooter.propTypes = {
  build: BuildLink.propTypes.build,
  photoCredits: PropTypes.object,
  variant: PropTypes.string,
};
