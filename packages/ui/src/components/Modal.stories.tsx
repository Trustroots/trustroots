import React, { useRef, useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { Button } from './Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  type ModalSize,
} from './Modal';

const sizes: ModalSize[] = ['md', 'lg'];

type DemoProps = Omit<ComponentProps<typeof Modal>, 'open' | 'children'> & {
  closeLabel?: string;
  defaultOpen?: boolean;
};

/** A trigger button and a confirmation dialog, as on the contacts page. */
function Demo({
  closeLabel,
  defaultOpen = false,
  onClose,
  ...props
}: DemoProps) {
  const [open, setOpen] = useState(defaultOpen);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>Remove contact</Button>
      <Modal {...props} open={open} onClose={close}>
        <ModalHeader closeLabel={closeLabel}>
          <ModalTitle>Remove contact?</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p>Connected since 1 January 2020</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="link" onClick={close}>
            Cancel
          </Button>
          <Button intent="primary" onClick={close}>
            Yes, remove contact
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

const meta = {
  component: Modal,
  args: { open: false, onClose: fn() },
  argTypes: {
    size: { control: 'inline-radio', options: sizes },
    open: { control: false },
  },
  render: args => <Demo {...args} />,
} satisfies Meta<typeof Modal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The dialog renders in a portal, so look for it in the whole page. */
function page(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body);
}

/**
 * Opens from a button, takes focus, keeps Tab inside, closes with Escape and
 * gives focus back to the button.
 */
export const Default: Story = {
  args: { closeLabel: 'Close' } as Story['args'],
  play: async ({ args, canvas, canvasElement }) => {
    const trigger = canvas.getByRole('button', { name: 'Remove contact' });
    await userEvent.click(trigger);

    const dialog = await page(canvasElement).findByRole('dialog');
    await expect(dialog).toHaveAccessibleName('Remove contact?');
    await expect(dialog).toHaveAttribute('data-size', 'md');
    await waitFor(() => expect(dialog).toHaveFocus());

    // Focus is trapped: from the last button, Tab wraps to the first.
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const confirm = within(dialog).getByRole('button', {
      name: 'Yes, remove contact',
    });
    await userEvent.tab();
    await expect(close).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    await expect(confirm).toHaveFocus();
    // Tab lands on Base UI's focus guard, which sends focus back to the start.
    await userEvent.tab();
    await waitFor(() => expect(close).toHaveFocus());

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(page(canvasElement).queryByRole('dialog')).toBeNull(),
    );
    await expect(args.onClose).toHaveBeenCalledOnce();
    await expect(trigger).toHaveFocus();
  },
};

/** A click on the backdrop closes it, as does the close button. */
export const BackdropClose: Story = {
  args: { closeLabel: 'Close' } as Story['args'],
  play: async ({ args, canvas, canvasElement }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove contact' }),
    );
    const dialog = await page(canvasElement).findByRole('dialog');
    // The viewport around the dialog is outside it.
    const viewport = dialog.closest<HTMLElement>(
      '[data-slot="modal-viewport"]',
    )!;
    await userEvent.pointer({
      keys: '[MouseLeft]',
      target: viewport,
      coords: { clientX: 5, clientY: 5 },
    });
    await waitFor(() =>
      expect(page(canvasElement).queryByRole('dialog')).toBeNull(),
    );
    await expect(args.onClose).toHaveBeenCalledOnce();

    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove contact' }),
    );
    await userEvent.click(
      await page(canvasElement).findByRole('button', { name: 'Close' }),
    );
    await waitFor(() => expect(args.onClose).toHaveBeenCalledTimes(2));
  },
};

/**
 * While the action is in progress, Escape and the backdrop leave it open and
 * the header has no close button, as on the admin role change.
 */
export const NotDismissible: Story = {
  args: { dismissible: false, defaultOpen: true } as Story['args'],
  play: async ({ args, canvasElement }) => {
    const dialog = await page(canvasElement).findByRole('dialog');
    await expect(
      within(dialog).queryByRole('button', { name: 'Close' }),
    ).toBeNull();
    await userEvent.keyboard('{Escape}');
    await expect(page(canvasElement).getByRole('dialog')).toBeVisible();
    await expect(args.onClose).not.toHaveBeenCalled();
  },
};

/** Long content in a large dialog: only the body scrolls. */
export const LargeScrollable: Story = {
  args: { size: 'lg', scrollable: true },
  render: args => <ScrollableDemo {...args} />,
  play: async ({ canvasElement }) => {
    const dialog = await page(canvasElement).findByRole('dialog');
    await expect(dialog).toHaveAttribute('data-size', 'lg');
    const message = within(dialog).getByLabelText('Message from your account');
    await waitFor(() => expect(message).toHaveFocus());
    const body = dialog.querySelector<HTMLElement>('[data-slot="modal-body"]')!;
    await expect(getComputedStyle(body).overflowY).toBe('auto');
    await expect(dialog.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      window.innerHeight,
    );
  },
};

/** Focus starts in the message field, as on the location corrections. */
function ScrollableDemo(args: ComponentProps<typeof Modal>) {
  const messageRef = useRef<HTMLTextAreaElement>(null);
  return (
    <Modal {...args} open initialFocus={messageRef}>
      <ModalHeader closeLabel="Close">
        <ModalTitle>Review a member</ModalTitle>
      </ModalHeader>
      <ModalBody>
        {Array.from({ length: 30 }, (_, index) => (
          <p key={index}>Hosting offer {index + 1} at Berlin, Germany</p>
        ))}
        <label htmlFor="story-message">Message from your account</label>
        <textarea
          ref={messageRef}
          id="story-message"
          className="form-control"
          rows={4}
        />
      </ModalBody>
    </Modal>
  );
}

/** Only a photo, with a custom width, as on profiles. */
export const Photo: Story = {
  args: {
    className: 'tw:min-[576px]:max-w-[300px]',
    defaultOpen: true,
  } as Story['args'],
  render: ({ defaultOpen, ...args }: DemoProps) => (
    <Modal {...args} open={Boolean(defaultOpen)}>
      <img
        alt=""
        className="tw:block tw:w-full"
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect width='1' height='1' fill='%2312b591'/%3E%3C/svg%3E"
      />
    </Modal>
  ),
  play: async ({ canvasElement }) => {
    const dialog = await page(canvasElement).findByRole('dialog');
    await expect(dialog.getBoundingClientRect().width).toBeLessThanOrEqual(300);
  },
};
