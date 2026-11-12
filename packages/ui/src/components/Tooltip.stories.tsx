import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { Button } from './Button';
import { Tooltip } from './Tooltip';

const meta = {
  component: Tooltip,
  args: {
    children: <Button>Remove contact</Button>,
    tooltip: 'Connected since 1 January 2020',
  },
  decorators: [
    Story => (
      <div className="tw:p-24">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    children: { control: false },
    placement: {
      control: 'inline-radio',
      options: ['top', 'bottom', 'left', 'right'],
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Placements: Story = {
  render: args => (
    <div className="tw:flex tw:gap-4">
      {(['top', 'bottom', 'left', 'right'] as const).map(placement => (
        <Tooltip key={placement} {...args} placement={placement}>
          <Button>{placement}</Button>
        </Tooltip>
      ))}
    </div>
  ),
  play: async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'top' });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await expect(await page.findByRole('tooltip')).toHaveTextContent(
      args.tooltip,
    );
    await expect(trigger).toHaveAccessibleDescription(args.tooltip);

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(page.queryByRole('tooltip')).toBeNull());
    await expect(trigger).toHaveFocus();

    const bottomTrigger = canvas.getByRole('button', { name: 'bottom' });
    await userEvent.hover(bottomTrigger);
    await expect(await page.findByRole('tooltip')).toHaveAttribute(
      'data-side',
      'bottom',
    );
  },
};

export const Hidden: Story = {
  args: { hidden: true },
  play: async ({ canvas, canvasElement }) => {
    const trigger = canvas.getByRole('button', { name: 'Remove contact' });
    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await expect(trigger).not.toHaveAttribute('aria-describedby');
    await expect(
      within(canvasElement.ownerDocument.body).queryByRole('tooltip'),
    ).toBeNull();
  },
};
