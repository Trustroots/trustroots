// Every badge the app renders, in the markup around it. `before` is the base
// branch's hand-written badge classes, `after` the owned Badge.
import React, { type CSSProperties, type ReactNode } from 'react';
import { Badge } from '@trustroots/ui/Badge';

import type { Fixture } from '../fixture.ts';

// The styled-components dot that modules/core Badge drew on the base branch.
const baseDot: CSSProperties = {
  borderRadius: '50%',
  height: 7,
  position: 'absolute',
  right: 9,
  top: 6,
  width: 7,
};

function ProfileTabs({ children }: { children: ReactNode }) {
  // The dot is absolutely positioned; give it the same box on both sides.
  return (
    <div className="profile-tabs" style={{ position: 'relative' }}>
      <ul
        className="nav panel panel-default nav-pills nav-narrow nav-underline"
        role="tablist"
      >
        {children}
      </ul>
    </div>
  );
}

function BottomNav({ children }: { children: ReactNode }) {
  // Static instead of fixed to the viewport, so it stays in its shot.
  return (
    <nav
      className="navbar navbar-default navbar-fixed-bottom profile-view-navbar-mobile"
      style={{ position: 'static' }}
    >
      <div className="container">
        <ul className="nav navbar-nav" role="tablist">
          {children}
        </ul>
      </div>
    </nav>
  );
}

function Header({ children }: { children: ReactNode }) {
  return (
    <nav className="navbar navbar-expand" id="tr-header">
      <div className="container">
        <ul className="navbar-nav nav">
          <li>
            <a href="#messages">
              <span>Messages</span>
              {children}
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}

const tabStates: Fixture['states'] = ['rest', 'hover', 'focus-visible'];

export const badgeFixtures: Fixture[] = [
  {
    id: 'badge-profile-tabs',
    width: 420,
    states: tabStates,
    target: 'li:not(.active) a',
    before: () => (
      <ProfileTabs>
        <li className="active" role="presentation">
          <a href="#contacts" role="tab">
            Contacts<span className="badge">12</span>
          </a>
        </li>
        <li role="presentation">
          <a href="#experiences" role="tab">
            Experiences
            <span className="badge">
              3
              <div className="tw:bg-notification" style={baseDot} />
            </span>
          </a>
        </li>
      </ProfileTabs>
    ),
    after: () => (
      <ProfileTabs>
        <li className="active" role="presentation">
          <a href="#contacts" role="tab">
            Contacts
            <Badge
              variant="outline"
              tone="neutral"
              size="sm"
              className="tw:ms-1.25"
            >
              12
            </Badge>
          </a>
        </li>
        <li role="presentation">
          <a href="#experiences" role="tab">
            Experiences
            <Badge
              variant="outline"
              tone="neutral"
              size="sm"
              className="tw:ms-1.25"
              indicator
            >
              3
            </Badge>
          </a>
        </li>
      </ProfileTabs>
    ),
  },
  {
    id: 'badge-profile-bottom-nav',
    width: 374,
    states: tabStates,
    target: 'li:not(.active) a',
    before: () => (
      <BottomNav>
        <li className="active" role="presentation">
          <a href="#about" role="tab">
            {'About'} <span className="badge"></span>
          </a>
        </li>
        <li role="presentation">
          <a href="#contacts" role="tab">
            {'Contacts'} <span className="badge">0</span>
          </a>
        </li>
        <li role="presentation">
          <a href="#circles" role="tab">
            {'Circles'} <span className="badge">12</span>
          </a>
        </li>
      </BottomNav>
    ),
    after: () => (
      <BottomNav>
        <li className="active" role="presentation">
          <a href="#about" role="tab">
            {'About'}{' '}
          </a>
        </li>
        <li role="presentation">
          <a href="#contacts" role="tab">
            {'Contacts'}{' '}
            <Badge variant="outline" tone="inverse">
              0
            </Badge>
          </a>
        </li>
        <li role="presentation">
          <a href="#circles" role="tab">
            {'Circles'}{' '}
            <Badge variant="outline" tone="inverse">
              12
            </Badge>
          </a>
        </li>
      </BottomNav>
    ),
  },
  {
    id: 'badge-unread-messages',
    width: 240,
    states: ['rest', 'hover', 'focus-visible'],
    before: () => (
      <Header>
        <span className="notification-badge">3</span>
      </Header>
    ),
    after: () => (
      <Header>
        <Badge
          variant="solid"
          tone="danger"
          size="xs"
          className="tw:absolute tw:top-2 tw:end-1.25"
        >
          3
        </Badge>
      </Header>
    ),
  },
  {
    id: 'badge-nostroots',
    width: 260,
    before: () => (
      <div>
        <span className="profile-nostr-badge">Nostroots</span>
      </div>
    ),
    after: () => (
      <div>
        <Badge
          variant="solid"
          tone="primary"
          size="sm"
          shape="pill"
        >
          Nostroots
        </Badge>
      </div>
    ),
  },
];
