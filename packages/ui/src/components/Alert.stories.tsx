import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { Alert, type AlertIntent } from './Alert';

const alertIntents: AlertIntent[] = ['danger', 'warning', 'info', 'success'];

const meta = {
  component: Alert,
  args: {
    intent: 'warning',
    role: 'alert',
    children: 'Your profile is not visible to other members yet.',
  },
  argTypes: {
    intent: { control: 'inline-radio', options: alertIntents },
    role: {
      control: 'inline-radio',
      options: ['alert', 'status', 'note', 'dialog'],
    },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Warning: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Your profile is not visible',
    );
  },
};

/** Every intent; the tints come from Bootstrap's `--bs-*-subtle` variables. */
export const Intents: Story = {
  args: { role: 'status' },
  render: args => (
    <>
      {alertIntents.map(intent => (
        <Alert key={intent} {...args} intent={intent}>
          This is the {intent} alert.
        </Alert>
      ))}
    </>
  ),
  play: async ({ canvas }) => {
    const alerts = canvas.getAllByRole('status');
    await expect(alerts).toHaveLength(alertIntents.length);
    for (const alert of alerts) {
      // A missing Bootstrap variable would leave the alert transparent.
      await expect(getComputedStyle(alert).backgroundColor).not.toBe(
        'rgba(0, 0, 0, 0)',
      );
    }
  },
};

/** Centred, as on the confirmation pages. */
export const Centred: Story = {
  args: { intent: 'success', className: 'tw:text-center' },
};
