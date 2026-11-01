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
      <Alert tone="warning" role="alert" className="extra">
        A warning
      </Alert>
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
      <Alert tone="warning" role="alert">
        Warning
      </Alert>
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
