import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { Button } from './Button';

const meta = {
  component: Button,
  args: { children: 'Continue', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'default'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: 'primary' },
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole('button', { name: 'Continue' });
    await expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Default: Story = { args: { variant: 'default' } };

export const Disabled: Story = {
  args: { variant: 'primary', disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toBeDisabled();
  },
};

/** Every variant side by side. */
export const Variants: Story = {
  render: args => (
    <div className="tw:flex tw:gap-2">
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="default">
        Default
      </Button>
    </div>
  ),
};
