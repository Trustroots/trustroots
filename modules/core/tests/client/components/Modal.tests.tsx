import React, { useRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@trustroots/ui/Modal';

function Dialog({
  dismissible,
  closeLabel,
  onClose,
  focusField = false,
}: {
  dismissible?: boolean;
  closeLabel?: string;
  onClose: () => void;
  focusField?: boolean;
}) {
  const fieldRef = useRef<HTMLInputElement>(null);
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={dismissible}
      initialFocus={focusField ? fieldRef : undefined}
    >
      <ModalHeader closeLabel={closeLabel}>
        <ModalTitle>Leave this circle?</ModalTitle>
      </ModalHeader>
      <ModalBody>
        <label htmlFor="modal-test-field">Reason</label>
        <input id="modal-test-field" ref={fieldRef} />
      </ModalBody>
      <ModalFooter>
        <button type="button">Leave circle</button>
      </ModalFooter>
    </Modal>
  );
}

describe('Modal', () => {
  it('is a dialog labelled by its title, with its parts marked', async () => {
    render(<Dialog onClose={jest.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Leave this circle?' });
    expect(dialog).toHaveAttribute('data-slot', 'modal');
    expect(dialog).toHaveAttribute('data-size', 'md');
    expect(dialog.querySelector('[data-slot="modal-footer"]')).toContainElement(
      screen.getByRole('button', { name: 'Leave circle' }),
    );
    // The dialog itself takes focus, so the first Tab reaches its first control.
    await waitFor(() => expect(dialog).toHaveFocus());
  });

  it('focuses the given element instead', async () => {
    render(<Dialog onClose={jest.fn()} focusField />);
    await waitFor(() => expect(screen.getByLabelText('Reason')).toHaveFocus());
  });

  it('closes with Escape and the close button', () => {
    const onClose = jest.fn();
    render(<Dialog onClose={onClose} closeLabel="Close" />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('ignores Escape when it is not dismissible, and has no close button', () => {
    const onClose = jest.fn();
    render(<Dialog onClose={onClose} dismissible={false} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Close' }),
    ).not.toBeInTheDocument();
  });
});
