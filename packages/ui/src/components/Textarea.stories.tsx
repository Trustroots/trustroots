import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { Textarea } from './Textarea';

const meta = {
  component: Textarea,
  args: { 'aria-label': 'Message', rows: 7 },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const field = canvas.getByRole('textbox', { name: 'Message' });
    await userEvent.tab();
    await expect(field).toHaveFocus();
    await userEvent.type(field, 'Hello!');
    await expect(field).toHaveValue('Hello!');
  },
};

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Sending…' },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('textbox', { name: 'Message' }),
    ).toBeDisabled();
  },
};
