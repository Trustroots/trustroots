import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../../../../../packages/ui/src/components/Button';
import { ButtonGroup } from '../../../../../packages/ui/src/components/ButtonGroup';
import { Alert } from '../../../../../packages/ui/src/components/Alert';
import { Badge } from '../../../../../packages/ui/src/components/Badge';
import { Spinner } from '../../../../../packages/ui/src/components/Spinner';

test('buttons default to non-submitting and support native props', () => {
  const onClick = jest.fn();
  const { rerender } = render(<Button onClick={onClick}>Continue</Button>);
  const button = screen.getByRole('button', { name: 'Continue' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveAttribute('data-slot', 'button');
  expect(button).toHaveAttribute('data-variant', 'solid');
  expect(button).toHaveAttribute('data-colour', 'default');
  expect(button).toHaveAttribute('data-size', 'md');
  expect(button).toHaveClass('tw:bg-button-default');
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(
    <Button type="submit" colour="primary" disabled className="extra">
      Save
    </Button>,
  );
  const save = screen.getByRole('button', { name: 'Save' });
  expect(save).toHaveAttribute('type', 'submit');
  expect(save).toHaveAttribute('data-colour', 'primary');
  expect(save).toHaveClass('tw:bg-brand-primary', 'extra');
  expect(save).toBeDisabled();
});

test('link buttons keep link semantics', () => {
  render(
    <Button variant="inverse" size="lg" render={<a href="/signup" />}>
      Sign up
    </Button>,
  );
  const link = screen.getByRole('link', { name: 'Sign up' });
  expect(link).toHaveAttribute('href', '/signup');
  expect(link).not.toHaveAttribute('type');
  expect(link).toHaveAttribute('data-variant', 'inverse');
  expect(link).toHaveAttribute('data-colour', 'white');
  expect(link).toHaveAttribute('data-size', 'lg');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
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

test('alerts and badges render supplied content and attributes', () => {
  render(
    <>
      <Alert className="extra">A warning</Alert>
      <Badge className="extra" title="Count">
        3
      </Badge>
    </>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('A warning');
  expect(screen.getByRole('alert')).toHaveClass('tw:bg-warning-bg', 'extra');
  expect(screen.getByTitle('Count')).toHaveClass(
    'tw:bg-brand-primary',
    'extra',
  );
});

test('alert and badge do not require a class name', () => {
  render(
    <>
      <Alert>Warning</Alert>
      <Badge>New</Badge>
    </>,
  );
  expect(screen.getByRole('alert')).toHaveClass('tw:bg-warning-bg');
  expect(screen.getByText('New')).toHaveClass('tw:bg-brand-primary');
});

test('spinner announces the caller supplied label', () => {
  render(<Spinner label="Loading languages" />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading languages');
});
