import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { Input } from './Input';

const meta = {
  component: Input,
  args: { 'aria-label': 'Search', type: 'search' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const field = canvas.getByRole('searchbox', { name: 'Search' });
    await userEvent.tab();
    await expect(field).toHaveFocus();
    await userEvent.type(field, 'language');
    await expect(field).toHaveValue('language');
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Unavailable' },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('searchbox', { name: 'Search' }),
    ).toBeDisabled();
  },
};
