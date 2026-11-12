import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { NavigationDropdown } from './NavigationDropdown';

const meta = {
  component: NavigationDropdown,
  args: {
    id: 'support-dropdown',
    label: 'Support',
    children: (
      <>
        <a className="tw:navigation-panel-item" href="/faq">
          Frequently Asked Questions
        </a>
        <a className="tw:navigation-panel-item" href="/support">
          Contact us
        </a>
      </>
    ),
  },
  decorators: [
    Story => (
      <nav aria-label="Page navigation" className="tw:p-24">
        <ul className="tw:flex tw:list-none tw:justify-center tw:gap-8">
          <Story />
          <li>
            <a href="/">Home</a>
          </li>
        </ul>
      </nav>
    ),
  ],
} satisfies Meta<typeof NavigationDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Keyboard: Story = {
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole('button', { name: 'Support' });

    await userEvent.tab();
    await expect(trigger).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const dropdown = await page.findByRole('dialog', { name: 'Support' });
    const firstLink = within(dropdown).getByRole('link', {
      name: 'Frequently Asked Questions',
    });

    await userEvent.tab();
    await expect(firstLink).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(dropdown).not.toBeInTheDocument());
    await expect(trigger).toHaveFocus();
  },
};

export const EndAligned: Story = {
  args: { align: 'end' },
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.hover(canvas.getByRole('button', { name: 'Support' }));
    const dropdown = await page.findByRole('dialog', { name: 'Support' });
    await waitFor(() => expect(dropdown).toHaveAttribute('data-align', 'end'));

    await userEvent.hover(
      within(dropdown).getByRole('link', { name: 'Contact us' }),
    );
    await expect(dropdown).toBeVisible();

    await userEvent.click(
      canvas.getByRole('navigation', { name: 'Page navigation' }),
    );
    await waitFor(() => expect(dropdown).not.toBeInTheDocument());
  },
};
