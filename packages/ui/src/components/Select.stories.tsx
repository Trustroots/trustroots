import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { Select } from './Select';

const meta = {
  component: Select,
  args: {
    'aria-label': 'Duration',
    children: (
      <>
        <option value="day">One day</option>
        <option value="week">One week</option>
      </>
    ),
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const select = canvas.getByRole('combobox', { name: 'Duration' });
    await userEvent.selectOptions(select, 'week');
    await expect(select).toHaveValue('week');
  },
};

export const Large: Story = {
  args: { fieldSize: 'lg' },
};
