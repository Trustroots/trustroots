// Button: the Bootstrap and Less button classes on the base branch against
// the owned Button on the head branch.
import React from 'react';
import { Button, type ButtonStyleProps } from '@trustroots/ui/Button';
import { ButtonGroup } from '@trustroots/ui/ButtonGroup';

import type { Fixture, State } from '../fixture.ts';

const states: State[] = ['rest', 'hover', 'focus-visible', 'active'];

type Look = ButtonStyleProps;

const looks: [string, string, Look][] = [
  ['default', 'btn-default', {}],
  ['primary', 'btn-primary', { colour: 'primary' }],
  ['danger', 'btn-danger', { colour: 'danger' }],
  ['info', 'btn-info', { colour: 'info' }],
  ['inverse', 'btn-inverse', { variant: 'inverse' }],
  [
    'inverse-primary',
    'btn-inverse-primary',
    { variant: 'inverse', colour: 'primary' },
  ],
  ['offer-yes', 'btn-offer-hosting-yes', { variant: 'offer', colour: 'yes' }],
  [
    'offer-maybe',
    'btn-offer-hosting-maybe',
    { variant: 'offer', colour: 'maybe' },
  ],
  ['offer-no', 'btn-offer-hosting-no', { variant: 'offer', colour: 'no' }],
  ['offer-meet', 'btn-offer-meet', { variant: 'offer', colour: 'meet' }],
  ['link', 'btn-link', { variant: 'link' }],
  ['link-muted', 'btn-link text-muted', { variant: 'link', colour: 'muted' }],
  ['plain', '', { variant: 'plain' }],
];

const sizes: [string, string, Look][] = [
  ['xs', 'btn-xs', { size: 'xs' }],
  ['sm', 'btn-sm', { size: 'sm' }],
  ['md', '', {}],
  ['lg', 'btn-lg', { size: 'lg' }],
  ['action', 'btn-action', { size: 'action' }],
];

// Inverse buttons sit on dark backgrounds in the app.
const dark = (id: string) => (id.startsWith('inverse') ? '#333' : undefined);

function Backdrop({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const background = dark(id);
  return background ? (
    <div style={{ background, padding: 6 }}>{children}</div>
  ) : (
    <>{children}</>
  );
}

const fixtures: Fixture[] = [];

for (const [id, classes, look] of looks) {
  fixtures.push({
    id: `button-${id}`,
    states,
    before: text => (
      <Backdrop id={id}>
        <button type="button" className={`btn ${classes}`}>
          {text.label}
        </button>
      </Backdrop>
    ),
    after: text => (
      <Backdrop id={id}>
        <Button {...look}>{text.label}</Button>
      </Backdrop>
    ),
  });
  fixtures.push({
    id: `button-${id}-disabled`,
    states: ['rest', 'hover'],
    before: text => (
      <Backdrop id={id}>
        <button type="button" className={`btn ${classes}`} disabled>
          {text.label}
        </button>
      </Backdrop>
    ),
    after: text => (
      <Backdrop id={id}>
        <Button {...look} disabled>
          {text.label}
        </Button>
      </Backdrop>
    ),
  });
  fixtures.push({
    id: `button-${id}-link`,
    states,
    before: text => (
      <Backdrop id={id}>
        <a href="#fixture" className={`btn ${classes}`}>
          {text.label}
        </a>
      </Backdrop>
    ),
    after: text => (
      <Backdrop id={id}>
        <Button {...look} render={<a href="#fixture" />}>
          {text.label}
        </Button>
      </Backdrop>
    ),
  });
}

for (const [id, classes, look] of sizes) {
  for (const [colourId, colourClass, colourLook] of looks.slice(0, 2)) {
    fixtures.push({
      id: `button-size-${id}-${colourId}`,
      states: ['rest', 'focus-visible'],
      before: text => (
        <button type="button" className={`btn ${colourClass} ${classes}`}>
          {text.label}
        </button>
      ),
      after: text => (
        <Button {...colourLook} size={look.size}>
          {text.label}
        </Button>
      ),
    });
  }
  fixtures.push({
    id: `button-size-${id}-round`,
    states: ['rest', 'hover'],
    before: () => (
      <button
        type="button"
        className={`btn btn-inverse-primary btn-round ${classes}`}
      >
        <i className="icon-plus" />
      </button>
    ),
    after: () => (
      <Button variant="inverse" colour="primary" round size={look.size}>
        <i className="icon-plus" />
      </Button>
    ),
  });
}

fixtures.push(
  {
    id: 'button-round-raised',
    states: ['rest', 'hover'],
    before: () => (
      <button
        type="button"
        className="btn btn-inverse-primary btn-round btn-raised"
      >
        <i className="icon-plus" />
      </button>
    ),
    after: () => (
      <Button variant="inverse" colour="primary" round raised>
        <i className="icon-plus" />
      </Button>
    ),
  },
  {
    id: 'button-block',
    width: 320,
    before: text => (
      <button type="button" className="btn btn-default btn-block">
        {text.label}
      </button>
    ),
    after: text => <Button block>{text.label}</Button>,
  },
  {
    id: 'button-with-icon-and-badge',
    states: ['rest', 'hover'],
    before: text => (
      <button type="button" className="btn btn-primary">
        <i className="icon-heart" /> {text.label}{' '}
        <span className="badge">3</span>
      </button>
    ),
    after: text => (
      <Button colour="primary">
        <i className="icon-heart" /> {text.label}{' '}
        <span className="badge">3</span>
      </Button>
    ),
  },
  {
    id: 'button-group-lg',
    states: ['rest', 'hover', 'focus-visible'],
    target: 'button:nth-child(2)',
    before: text => (
      <div className="btn-group btn-group-lg" role="group">
        <button type="button" className="btn btn-default">
          {text.short}
        </button>
        <button type="button" className="btn btn-default">
          {text.label}
        </button>
        <button type="button" className="btn btn-default">
          {text.short}
        </button>
      </div>
    ),
    after: text => (
      <ButtonGroup size="lg" role="group">
        <Button>{text.short}</Button>
        <Button>{text.label}</Button>
        <Button>{text.short}</Button>
      </ButtonGroup>
    ),
  },
  {
    id: 'button-group-vertical',
    before: text => (
      <div className="btn-group-vertical" role="group">
        <button type="button" className="btn btn-default">
          {text.short}
        </button>
        <button type="button" className="btn btn-default">
          {text.label}
        </button>
      </div>
    ),
    after: text => (
      <ButtonGroup orientation="vertical" role="group">
        <Button>{text.short}</Button>
        <Button>{text.label}</Button>
      </ButtonGroup>
    ),
  },
  {
    id: 'button-group-justified',
    width: 600,
    before: text => (
      <div className="btn-group btn-group-justified" role="group">
        <div className="btn-group btn-group-lg" role="group">
          <button type="button" className="btn btn-default">
            {text.short}
          </button>
        </div>
        <div className="btn-group btn-group-lg" role="group">
          <button type="button" className="btn btn-default">
            {text.label}
          </button>
        </div>
        <div className="btn-group btn-group-lg" role="group">
          <a href="#fixture" className="btn btn-default">
            {text.short}
          </a>
        </div>
      </div>
    ),
    after: text => (
      <ButtonGroup justified role="group">
        <ButtonGroup size="lg" role="group">
          <Button>{text.short}</Button>
        </ButtonGroup>
        <ButtonGroup size="lg" role="group">
          <Button>{text.label}</Button>
        </ButtonGroup>
        <ButtonGroup size="lg" role="group">
          <Button render={<a href="#fixture" />}>{text.short}</Button>
        </ButtonGroup>
      </ButtonGroup>
    ),
  },
);

export const buttonFixtures = fixtures;
