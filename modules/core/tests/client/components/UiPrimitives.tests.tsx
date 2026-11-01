import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../../../../../packages/ui/src/components/Button';
import { Alert } from '../../../../../packages/ui/src/components/Alert';
import { Badge } from '../../../../../packages/ui/src/components/Badge';
import { Spinner } from '../../../../../packages/ui/src/components/Spinner';

test('buttons default to non-submitting and support native props', () => {
  const onClick = jest.fn();
  const { rerender } = render(<Button onClick={onClick}>Continue</Button>);
  const button = screen.getByRole('button', { name: 'Continue' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveClass('tw:bg-brand-primary');
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
  rerender(
    <Button type="submit" variant="default" disabled className="extra">
      Save
    </Button>,
  );
  expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
    'type',
    'submit',
  );
  expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
    'tw:bg-white',
    'extra',
  );
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('alerts and badges render supplied content and attributes', () => {
  render(
    <>
      <Alert className="extra">A warning</Alert>
      <Badge variant="solid" tone="primary" className="extra" title="Count">
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

test('alert does not require a class name', () => {
  render(<Alert>Warning</Alert>);
  expect(screen.getByRole('alert')).toHaveClass('tw:bg-warning-bg');
});

test('badges expose their resolved variant, tone, size and shape', () => {
  render(
    <>
      <Badge variant="outline" tone="neutral">
        12
      </Badge>
      <Badge variant="solid" tone="danger" size="xs" shape="pill">
        3
      </Badge>
    </>,
  );
  const outline = screen.getByText('12');
  expect(outline).toHaveAttribute('data-slot', 'badge');
  expect(outline).toHaveAttribute('data-variant', 'outline');
  expect(outline).toHaveAttribute('data-tone', 'neutral');
  expect(outline).toHaveAttribute('data-size', 'md');
  expect(outline).toHaveAttribute('data-shape', 'rounded');
  expect(outline).toHaveClass('tw:border-current', 'tw:text-neutral');

  const solid = screen.getByText('3');
  expect(solid).toHaveAttribute('data-size', 'xs');
  expect(solid).toHaveAttribute('data-shape', 'pill');
  expect(solid).toHaveClass('tw:bg-notification', 'tw:rounded-full');
  expect(solid).not.toHaveClass('tw:rounded');
});

test('badge weight follows its variant at the small size', () => {
  render(
    <>
      <Badge variant="outline" tone="neutral" size="sm">
        Light
      </Badge>
      <Badge variant="solid" tone="primary" size="sm">
        Semibold
      </Badge>
    </>,
  );
  expect(screen.getByText('Light')).toHaveClass('tw:font-extralight');
  expect(screen.getByText('Semibold')).toHaveClass('tw:font-semibold');
});

test('badge indicator is a decorative dot', () => {
  const { rerender } = render(
    <Badge variant="outline" tone="neutral" indicator>
      5
    </Badge>,
  );
  const dot = document.querySelector('[data-slot="badge-indicator"]');
  expect(dot).toHaveAttribute('aria-hidden', 'true');
  expect(dot).toHaveClass('tw:bg-notification');
  expect(screen.getByText('5')).toHaveTextContent(/^5$/);

  rerender(
    <Badge variant="outline" tone="neutral">
      5
    </Badge>,
  );
  expect(
    document.querySelector('[data-slot="badge-indicator"]'),
  ).not.toBeInTheDocument();
});

test('spinner announces the caller supplied label', () => {
  render(<Spinner label="Loading languages" />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading languages');
});
