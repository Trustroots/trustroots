import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '@trustroots/ui';

describe('Button', () => {
  it('renders a bare Bootstrap button without a variant', () => {
    render(<Button>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveClass('btn', { exact: true });
    expect(button).not.toHaveAttribute('type');
  });

  it('maps variant, size and modifiers to btn classes', () => {
    render(
      <Button variant="primary" size="lg" block action round raised>
        Join
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Join' })).toHaveClass(
      'btn btn-primary btn-lg btn-block btn-action btn-round btn-raised',
      { exact: true },
    );
  });

  it('appends a custom className', () => {
    render(
      <Button variant="default" className="pull-right">
        Close
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
      'btn btn-default pull-right',
      { exact: true },
    );
  });

  it('passes native props through', () => {
    const onClick = jest.fn();
    render(
      <Button type="submit" disabled={false} onClick={onClick}>
        Send
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toHaveAttribute('type', 'submit');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('forwards its ref to the rendered element', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref</Button>);

    expect(ref.current).toBe(screen.getByRole('button', { name: 'Ref' }));
  });

  it('renders as another element or component', () => {
    render(
      <Button as="a" href="/about" variant="link">
        About
      </Button>,
    );

    const link = screen.getByRole('link', { name: 'About' });
    expect(link).toHaveAttribute('href', '/about');
    expect(link).toHaveClass('btn btn-link', { exact: true });
  });
});
