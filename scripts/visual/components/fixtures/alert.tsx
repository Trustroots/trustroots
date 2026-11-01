// Alert: the Bootstrap `.alert` markup the app used (before) against the owned
// component (after), for every tone and alignment, the content shapes the app
// puts inside alerts, and the auth-page context whose Less touched `.alert`.
import React, { type ReactNode } from 'react';
import { Alert } from '@trustroots/ui/Alert';

import type { Fixture, FixtureText } from '../fixture.ts';

const TONES = ['danger', 'info', 'success', 'warning'] as const;
type Tone = (typeof TONES)[number];

const content: Record<string, (text: FixtureText) => ReactNode> = {
  plain: text => text.sentence,
  strong: text => <strong>{text.sentence}</strong>,
  // ContactAddPage / ContactConfirmPage success.
  heading: text => (
    <>
      <h4>{text.label}</h4>
      <p>
        <strong>
          <a href="#a">{text.short}</a>
        </strong>{' '}
        {text.sentence}
      </p>
    </>
  ),
  // CreateExperience, ProfileEditAccount: a paragraph and a button.
  action: text => (
    <>
      <p>{text.sentence}</p>
      <button type="button" className="btn btn-primary">
        {text.label}
      </button>
    </>
  ),
  // AdminMessages thread votes.
  list: text => (
    <>
      <strong>{text.label}</strong>
      <ul>
        <li>{text.short}</li>
        <li>{text.sentence}</li>
      </ul>
    </>
  ),
};

function fixture(
  id: string,
  tone: Tone,
  body: (text: FixtureText) => ReactNode,
  options: { center?: boolean; element?: 'div' | 'p' } = {},
): Fixture {
  const Element = options.element ?? 'div';
  const legacy = `alert alert-${tone}${options.center ? ' text-center' : ''}`;
  return {
    id,
    width: 360,
    before: text => <Element className={legacy}>{body(text)}</Element>,
    after: text => (
      <Alert
        tone={tone}
        align={options.center ? 'center' : undefined}
        role="alert"
      >
        {body(text)}
      </Alert>
    ),
  };
}

// The auth pages put alerts on the `.board` photo, inside or beside
// `.form-auth`, where `.form-auth .alert` removed the board's text shadow.
const onBoard = (inForm: boolean, children: ReactNode) => (
  <div className="board" style={{ padding: 8 }}>
    {inForm ? <form className="form-auth">{children}</form> : children}
  </div>
);

export const alertFixtures: Fixture[] = [
  ...TONES.flatMap(tone => [
    fixture(`alert-${tone}`, tone, content.plain),
    fixture(`alert-${tone}-p`, tone, content.plain, { element: 'p' }),
  ]),
  fixture('alert-danger-center', 'danger', content.strong, { center: true }),
  fixture('alert-success-center', 'success', content.action, { center: true }),
  fixture('alert-success-heading', 'success', content.heading),
  fixture('alert-danger-action', 'danger', content.action),
  fixture('alert-info-action', 'info', content.action),
  fixture('alert-warning-list', 'warning', content.list),
  {
    id: 'alert-board-form-auth',
    width: 360,
    before: text =>
      onBoard(
        true,
        <div className="alert alert-danger text-center">
          <strong>{text.sentence}</strong>
        </div>,
      ),
    after: text =>
      onBoard(
        true,
        <Alert tone="danger" align="center" role="alert">
          <strong>{text.sentence}</strong>
        </Alert>,
      ),
  },
  {
    id: 'alert-board-signin',
    width: 360,
    before: text =>
      onBoard(
        false,
        <div className="alert alert-danger">{text.sentence}</div>,
      ),
    after: text =>
      onBoard(
        false,
        <Alert tone="danger" role="alert">
          {text.sentence}
        </Alert>,
      ),
  },
  // LanguageSelect already used the owned Alert; before is its old markup.
  {
    id: 'alert-language-select',
    width: 360,
    before: text => (
      <div
        role="alert"
        className="tw:relative tw:mb-4 tw:rounded-md tw:border tw:border-solid tw:border-warning-border tw:bg-warning-bg tw:p-4 tw:text-warning-text"
      >
        {text.sentence}
      </div>
    ),
    after: text => (
      <Alert tone="warning" role="alert">
        {text.sentence}
      </Alert>
    ),
  },
];
