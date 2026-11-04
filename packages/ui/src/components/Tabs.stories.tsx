import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';

import { Tab, Tabs, TabsList, TabsPanel } from './Tabs';

/** Controlled tabs with three panels, the way the app uses them. */
function Demo({
  variant,
  justified,
  disabled = [],
  initial = 'availability',
}: {
  variant: 'tabs' | 'pills';
  justified?: boolean;
  disabled?: string[];
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  const tabs = ['availability', 'description', 'location'];
  return (
    <Tabs value={value} onValueChange={setValue}>
      <TabsList variant={variant} justified={justified}>
        {tabs.map(tab => (
          <Tab key={tab} value={tab} disabled={disabled.includes(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </Tab>
        ))}
      </TabsList>
      {tabs.map(tab => (
        <TabsPanel key={tab} value={tab}>
          <p className="tw:pt-4">The {tab} panel.</p>
        </TabsPanel>
      ))}
    </Tabs>
  );
}

const meta = {
  component: Tabs,
  // Each story renders its own controlled Demo; these satisfy the types.
  args: { value: 'availability', onValueChange: () => {}, children: null },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Bootstrap's bordered tabs, as on the hosting and meeting offer editors.
 * Arrow keys move between tabs and select the one they land on.
 */
export const Bordered: Story = {
  render: () => <Demo variant="tabs" />,
  play: async ({ canvas }) => {
    const tablist = canvas.getByRole('tablist');
    await expect(tablist).toHaveAttribute('data-variant', 'tabs');
    const availability = canvas.getByRole('tab', { name: 'Availability' });
    await expect(availability).toHaveAttribute('aria-selected', 'true');
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent(
      'The availability panel.',
    );

    await userEvent.click(availability);
    await userEvent.keyboard('{ArrowRight}');
    const description = canvas.getByRole('tab', { name: 'Description' });
    await waitFor(() => expect(description).toHaveFocus());
    await waitFor(() =>
      expect(description).toHaveAttribute('aria-selected', 'true'),
    );
    await expect(canvas.getByRole('tabpanel')).toHaveTextContent(
      'The description panel.',
    );

    // Focus wraps from the first tab to the last.
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    await waitFor(() =>
      expect(canvas.getByRole('tab', { name: 'Location' })).toHaveFocus(),
    );
  },
};

/** Tabs share the full width, as in the search sidebar. */
export const Justified: Story = {
  render: () => (
    <div className="tw:w-96">
      <Demo variant="tabs" justified />
    </div>
  ),
  play: async ({ canvas }) => {
    const [first, second] = canvas.getAllByRole('tab');
    await expect(first.getBoundingClientRect().width).toBeCloseTo(
      second.getBoundingClientRect().width,
      0,
    );
  },
};

/** A disabled tab is skipped by arrow keys and ignores clicks. */
export const DisabledTab: Story = {
  render: () => <Demo variant="tabs" disabled={['description']} />,
  play: async ({ canvas }) => {
    const description = canvas.getByRole('tab', { name: 'Description' });
    await expect(description).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(canvas.getByRole('tab', { name: 'Availability' }));
    await userEvent.keyboard('{ArrowRight}');
    const location = canvas.getByRole('tab', { name: 'Location' });
    await waitFor(() => expect(location).toHaveFocus());
    await waitFor(() =>
      expect(location).toHaveAttribute('aria-selected', 'true'),
    );
  },
};

/**
 * Bootstrap's pills, for the steps of the experience form. There every tab
 * is disabled and the step buttons below move between them.
 */
export const Pills: Story = {
  render: () => (
    <Demo
      variant="pills"
      initial="description"
      disabled={['availability', 'description', 'location']}
    />
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tablist')).toHaveAttribute(
      'data-variant',
      'pills',
    );
    const active = canvas.getByRole('tab', { name: 'Description' });
    await expect(active).toHaveAttribute('aria-selected', 'true');
    await expect(getComputedStyle(active).backgroundColor).not.toBe(
      'rgba(0, 0, 0, 0)',
    );
  },
};
