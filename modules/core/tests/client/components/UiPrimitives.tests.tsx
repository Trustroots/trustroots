import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '../../../../../packages/ui/Button';
import { Alert } from '../../../../../packages/ui/Alert';
import { Badge } from '../../../../../packages/ui/Badge';
import { Spinner } from '../../../../../packages/ui/Spinner';

test('buttons default to non-submitting and support native props', () => {
  const onClick = jest.fn();
  const { rerender } = render(<Button onClick={onClick}>Continue</Button>);
  const button = screen.getByRole('button', { name: 'Continue' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveClass('tr-button--primary');
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
    'tr-button--default',
    'extra',
  );
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
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
  expect(screen.getByRole('alert')).toHaveClass('tr-alert', 'extra');
  expect(screen.getByTitle('Count')).toHaveClass('tr-badge', 'extra');
});

test('alert and badge do not require a class name', () => {
  render(
    <>
      <Alert>Warning</Alert>
      <Badge>New</Badge>
    </>,
  );
  expect(screen.getByRole('alert')).toHaveClass('tr-alert');
  expect(screen.getByText('New')).toHaveClass('tr-badge');
});

test('spinner announces the caller supplied label', () => {
  render(<Spinner label="Loading languages" />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading languages');
});
