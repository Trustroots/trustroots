// Every label the app renders, in the markup around it. `before` is the base
// branch's hand-written Bootstrap 3 `.label` classes, `after` the owned Badge
// the labels moved onto.
import React, { type ReactNode } from 'react';
import { Badge } from '@trustroots/ui/Badge';

import type { Fixture } from '../fixture.ts';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const legacyClass: Record<Tone, string> = {
  neutral: 'label-default',
  primary: 'label-primary',
  success: 'label-success',
  warning: 'label-warning',
  danger: 'label-danger',
};

// The admin member states: roles, hidden profile, unconfirmed email and
// pending links, in the order UserState renders them.
const userStates: { tone: Tone; text: string }[] = [
  { tone: 'success', text: 'Volunteer' },
  { tone: 'danger', text: 'Suspended' },
  { tone: 'danger', text: 'Hidden profile' },
  { tone: 'warning', text: 'Unconfirmed signup' },
  { tone: 'warning', text: 'Pending removal' },
];

function UserStateBefore() {
  return (
    <div className="admin-user-state">
      {userStates.map(({ tone, text }) => (
        <span key={text} className={`label ${legacyClass[tone]} admin-label`}>
          {text}
        </span>
      ))}
    </div>
  );
}

function UserStateAfter() {
  return (
    <div className="admin-user-state">
      {userStates.map(({ tone, text }) => (
        <Badge key={text} variant="solid" tone={tone}>
          {text}
        </Badge>
      ))}
    </div>
  );
}

function Table({ children }: { children: ReactNode }) {
  return (
    <table className="table table-striped">
      <tbody>{children}</tbody>
    </table>
  );
}

function ExperienceMeta({ children }: { children: ReactNode }) {
  // Meta.tsx's styled-components wrapper: a wrapping flex row.
  return (
    <div
      className="experience-meta"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        padding: '10px 0',
      }}
    >
      {children}
    </div>
  );
}

const experienceTags = ['Recommend', 'Guest', 'Host', 'Met in person'];

function NewCircle({ children }: { children: ReactNode }) {
  return (
    <div className="tribes-grid">
      <div
        className="panel tribe tribe-image"
        style={{ position: 'relative', height: 120, background: '#2c4f5e' }}
      >
        <a href="#circle" className="tribe-link">
          <span className="tribe-new" aria-hidden={true}>
            {children}
          </span>
        </a>
      </div>
    </div>
  );
}

export const labelFixtures: Fixture[] = [
  {
    id: 'label-user-state',
    width: 600,
    before: () => <UserStateBefore />,
    after: () => <UserStateAfter />,
  },
  {
    // Team roles had no label colour: white text on no background. They are
    // neutral badges now, so this one differs on purpose.
    id: 'label-user-state-team-roles',
    width: 600,
    before: () => (
      <div className="admin-user-state">
        <span className="label admin-label">moderator</span>
        <span className="label admin-label">Greeter</span>
        <span className="label admin-label">Support team</span>
      </div>
    ),
    after: () => (
      <div className="admin-user-state">
        <Badge variant="solid" tone="neutral">
          moderator
        </Badge>
        <Badge variant="solid" tone="neutral">
          Greeter
        </Badge>
        <Badge variant="solid" tone="neutral">
          Support team
        </Badge>
      </div>
    ),
  },
  {
    // The member stats panel on the admin member page shrinks its states.
    id: 'label-user-state-member-stats',
    width: 600,
    before: () => (
      <div className="panel panel-default admin-user admin-member-stats">
        <UserStateBefore />
      </div>
    ),
    after: () => (
      <div className="panel panel-default admin-user admin-member-stats">
        <UserStateAfter />
      </div>
    ),
  },
  {
    id: 'label-acquisition-restrictions',
    width: 360,
    before: () => (
      <Table>
        <tr>
          <td>
            <a href="#member">member</a>
            <span className="label label-danger admin-label">Suspended</span>
            <span className="label label-danger admin-label">
              Shadowbanned
            </span>
          </td>
        </tr>
      </Table>
    ),
    after: () => (
      <Table>
        <tr>
          <td>
            <a href="#member">member</a>
            <span className="admin-restriction-badges">
              <Badge variant="solid" tone="danger">
                Suspended
              </Badge>
              <Badge variant="solid" tone="danger">
                Shadowbanned
              </Badge>
            </span>
          </td>
        </tr>
      </Table>
    ),
  },
  {
    id: 'label-thread-read',
    width: 300,
    before: () => (
      <Table>
        <tr>
          <td>
            <span className="label label-success">Read</span>
          </td>
        </tr>
        <tr>
          <td>
            <span className="label label-warning">Unread</span>
          </td>
        </tr>
      </Table>
    ),
    after: () => (
      <Table>
        <tr>
          <td>
            <Badge variant="solid" tone="success">
              Read
            </Badge>
          </td>
        </tr>
        <tr>
          <td>
            <Badge variant="solid" tone="warning">
              Unread
            </Badge>
          </td>
        </tr>
      </Table>
    ),
  },
  {
    id: 'label-reference-votes',
    width: 420,
    before: () => (
      <ul className="list-unstyled">
        <li>
          <span className="label label-success">positive</span>{' '}
          <a href="#a">alice</a> voted for <a href="#b">bob</a>
        </li>
        <li>
          <span className="label label-danger">negative</span>{' '}
          <a href="#a">alice</a> voted for <a href="#b">bob</a>
        </li>
      </ul>
    ),
    after: () => (
      <ul className="list-unstyled">
        <li>
          <Badge variant="solid" tone="success">
            positive
          </Badge>{' '}
          <a href="#a">alice</a> voted for <a href="#b">bob</a>
        </li>
        <li>
          <Badge variant="solid" tone="danger">
            negative
          </Badge>{' '}
          <a href="#a">alice</a> voted for <a href="#b">bob</a>
        </li>
      </ul>
    ),
  },
  {
    id: 'label-reference-count',
    width: 420,
    before: () => (
      <div className="panel panel-default">
        <div className="panel-body">
          <h4>Top score from the last year</h4>
          <ol className="list-inline">
            <li>
              <span className="label label-danger">7</span>{' '}
              <a href="#b">bob</a>
            </li>
            <li>
              <span className="label label-danger">3</span>{' '}
              <a href="#c">carol</a>
            </li>
          </ol>
        </div>
      </div>
    ),
    after: () => (
      <div className="panel panel-default">
        <div className="panel-body">
          <h4>Top score from the last year</h4>
          <ol className="list-inline">
            <li>
              <Badge variant="solid" tone="danger">
                7
              </Badge>{' '}
              <a href="#b">bob</a>
            </li>
            <li>
              <Badge variant="solid" tone="danger">
                3
              </Badge>{' '}
              <a href="#c">carol</a>
            </li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: 'label-experience-meta',
    width: 420,
    before: () => (
      <ExperienceMeta>
        {experienceTags.map(tag => (
          <span
            key={tag}
            className="label label-default"
            style={{ margin: '0 5px 5px 0' }}
          >
            {tag}
          </span>
        ))}
      </ExperienceMeta>
    ),
    after: () => (
      <ExperienceMeta>
        {experienceTags.map(tag => (
          <Badge
            key={tag}
            variant="solid"
            tone="neutral"
            style={{ margin: '0 5px 5px 0' }}
          >
            {tag}
          </Badge>
        ))}
      </ExperienceMeta>
    ),
  },
  {
    id: 'label-new-circle',
    width: 320,
    before: () => (
      <NewCircle>
        <span className="label label-primary">New circle!</span>
      </NewCircle>
    ),
    after: () => (
      <NewCircle>
        <Badge variant="solid" tone="primary">
          New circle!
        </Badge>
      </NewCircle>
    ),
  },
];
