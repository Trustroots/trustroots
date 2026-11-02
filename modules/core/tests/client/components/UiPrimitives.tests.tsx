import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../../../../../packages/ui/src/components/Button';
import { ButtonGroup } from '../../../../../packages/ui/src/components/ButtonGroup';
import { Alert } from '../../../../../packages/ui/src/components/Alert';
import { Badge } from '../../../../../packages/ui/src/components/Badge';
import { Spinner } from '../../../../../packages/ui/src/components/Spinner';
import {
  intentClassNames,
  intents,
} from '../../../../../packages/ui/src/lib/intent';

test('buttons default to a solid, inverse, non-submitting button', () => {
  const onClick = jest.fn();
  const { rerender } = render(<Button onClick={onClick}>Continue</Button>);
  const button = screen.getByRole('button', { name: 'Continue' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveAttribute('data-slot', 'button');
  expect(button).toHaveAttribute('data-variant', 'solid');
  expect(button).toHaveAttribute('data-intent', 'inverse');
  expect(button).toHaveAttribute('data-size', 'md');
  expect(button).toHaveClass('tw:bg-(--intent)', 'tw:[--intent:white]');
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(
    <Button type="submit" intent="primary" disabled className="extra">
      Save
    </Button>,
  );
  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toHaveAttribute('type', 'submit');
  expect(save).toHaveAttribute('data-intent', 'primary');
  expect(save).toHaveClass('tw:[--intent:var(--tr-brand-primary)]', 'extra');
  expect(save).toBeDisabled();
});

test('every intent sets the colour and the text on it', () => {
  expect(Object.keys(intentClassNames)).toEqual([...intents]);
  for (const intent of intents) {
    expect(intentClassNames[intent]).toMatch(/\[--intent:[^\]]+\]/);
    expect(intentClassNames[intent]).toMatch(/\[--on-intent:[^\]]+\]/);
  }
});

test('link buttons keep link semantics', () => {
  render(
    <Button
      variant="outline"
      intent="inverse"
      size="lg"
      render={<a href="/signup" />}
    >
      Sign up
    </Button>,
  );
  const link = screen.getByRole('link', { name: 'Sign up' });
  expect(link).toHaveAttribute('href', '/signup');
  expect(link).not.toHaveAttribute('type');
  expect(link).toHaveAttribute('data-variant', 'outline');
  expect(link).toHaveAttribute('data-intent', 'inverse');
  expect(link).toHaveAttribute('data-size', 'lg');
  expect(link).toHaveClass('tw:focus-visible:outline-white');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('neutral links are muted and round buttons pad evenly', () => {
  render(
    <>
      <Button variant="link" intent="neutral">
        Help
      </Button>
      <Button variant="ghost">Decline</Button>
      <Button round aria-label="Edit" />
    </>,
  );
  expect(screen.getByRole('button', { name: 'Help' })).toHaveClass(
    'tw:text-muted',
  );
  expect(screen.getByRole('button', { name: 'Decline' })).toHaveClass(
    'tw:text-text',
  );
  const round = screen.getByRole('button', { name: 'Edit' });
  expect(round).toHaveClass('tw:rounded-[50%]', 'tw:px-(--py)');
  expect(round).not.toHaveClass('tw:px-3');
});

test('button groups pass their size to their buttons', () => {
  render(
    <ButtonGroup size="lg" role="group" aria-label="Choices">
      <Button>Yes</Button>
      <Button size="sm">No</Button>
    </ButtonGroup>,
  );
  expect(screen.getByRole('group', { name: 'Choices' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute(
    'data-size',
    'lg',
  );
  expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute(
    'data-size',
    'sm',
  );
});

test('nested and vertical button groups join their buttons', () => {
  render(
    <ButtonGroup justified role="group" aria-label="Outer">
      <ButtonGroup size="lg" role="group" aria-label="Inner">
        <Button>One</Button>
      </ButtonGroup>
      <ButtonGroup orientation="vertical" role="group" aria-label="Column">
        <Button>Two</Button>
      </ButtonGroup>
    </ButtonGroup>,
  );
  expect(screen.getByRole('group', { name: 'Outer' })).toHaveClass('tw:w-full');
  expect(screen.getByRole('group', { name: 'Inner' })).toHaveClass(
    'tw:not-first:-ms-px',
  );
  expect(screen.getByRole('group', { name: 'Column' })).toHaveAttribute(
    'data-orientation',
    'vertical',
  );
  expect(screen.getByRole('button', { name: 'Two' })).toHaveClass(
    'tw:not-first:-mt-px',
  );
});

test('alerts and badges render supplied content and attributes', () => {
  render(
    <>
      <Alert intent="warning" role="alert" className="extra">
        A warning
      </Alert>
      <Badge variant="solid" intent="primary" className="extra" title="Count">
        3
      </Badge>
    </>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('A warning');
  expect(screen.getByRole('alert')).toHaveClass(
    'tw:bg-(--bs-warning-bg-subtle)',
    'extra',
  );
  expect(screen.getByTitle('Count')).toHaveClass(
    'tw:[--intent:var(--tr-brand-primary)]',
    'extra',
  );
});

test('alert does not require a class name', () => {
  render(
    <Alert intent="warning" role="alert">
      Warning
    </Alert>,
  );
  expect(screen.getByRole('alert')).toHaveClass(
    'tw:bg-(--bs-warning-bg-subtle)',
  );
});

test('badges expose their resolved variant, intent and size', () => {
  render(
    <>
      <Badge variant="outline" intent="neutral">
        12
      </Badge>
      <Badge variant="solid" intent="danger" className="tw:rounded-full">
        3
      </Badge>
    </>,
  );
  const outline = screen.getByText('12');
  expect(outline).toHaveAttribute('data-slot', 'badge');
  expect(outline).toHaveAttribute('data-variant', 'outline');
  expect(outline).toHaveAttribute('data-intent', 'neutral');
  expect(outline).toHaveAttribute('data-size', 'md');
  expect(outline).toHaveClass(
    'tw:border-current',
    'tw:text-(--intent)',
    'tw:[--intent:var(--tr-neutral)]',
  );

  // A caller's shape replaces the default corners.
  const solid = screen.getByText('3');
  expect(solid).toHaveClass('tw:bg-(--intent)', 'tw:rounded-full');
  expect(solid).not.toHaveClass('tw:rounded-md');
});

test('badge weight follows its variant at the small size', () => {
  render(
    <>
      <Badge variant="outline" intent="neutral" size="sm">
        Light
      </Badge>
      <Badge variant="solid" intent="primary" size="sm">
        Semibold
      </Badge>
    </>,
  );
  expect(screen.getByText('Light')).toHaveClass('tw:font-extralight');
  expect(screen.getByText('Semibold')).toHaveClass('tw:font-semibold');
});

test('spinner announces the caller supplied label', () => {
  render(<Spinner label="Loading languages" />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading languages');
});
