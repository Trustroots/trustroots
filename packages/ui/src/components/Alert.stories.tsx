import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { Alert } from './Alert';

const meta = {
  component: Alert,
  args: { children: 'Your profile is not visible to other members yet.' },
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
