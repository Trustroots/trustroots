import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';

import { ToggleGroup, ToggleGroupItem } from './ToggleGroup';

function Demo({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState<'yes' | 'no' | 'unknown' | null>(null);
  return (
    <fieldset disabled={disabled}>
      <h4 id="recommend-question">Would you recommend them?</h4>
      <ToggleGroup
        name="recommend"
        value={value}
        onValueChange={setValue}
        aria-labelledby="recommend-question"
      >
        <ToggleGroupItem value="yes">Yes</ToggleGroupItem>
        <ToggleGroupItem value="no">No</ToggleGroupItem>
        <ToggleGroupItem value="unknown">Skip</ToggleGroupItem>
      </ToggleGroup>
    </fieldset>
  );
}

const meta = {
  component: ToggleGroup,
  // Each story renders its own controlled Demo; these satisfy the types.
  args: {
    name: 'recommend',
    value: null,
    onValueChange: () => {},
    'aria-labelledby': 'recommend-question',
    children: null,
  },
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * One answer from joined buttons, as for the experience recommendation. The
 * options are radios: arrow keys move and select, Tab reaches the checked one.
 */
export const Default: Story = {
  render: () => <Demo />,
  play: async ({ canvas }) => {
    const group = canvas.getByRole('radiogroup', {
      name: 'Would you recommend them?',
    });
    await expect(group).toBeInTheDocument();
    for (const name of ['Yes', 'No', 'Skip']) {
      await expect(canvas.getByRole('radio', { name })).not.toBeChecked();
    }

    await userEvent.click(canvas.getByText('No'));
    await expect(canvas.getByRole('radio', { name: 'No' })).toBeChecked();
    // The checked option is filled.
    await waitFor(() =>
      expect(getComputedStyle(canvas.getByText('No')).backgroundColor).toBe(
        getComputedStyle(canvas.getByText('No')).borderTopColor,
      ),
    );

    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('radio', { name: 'Skip' })).toBeChecked();
    await expect(canvas.getByRole('radio', { name: 'Skip' })).toHaveFocus();
  },
};

/** A disabled fieldset disables every option. */
export const InDisabledFieldset: Story = {
  render: () => <Demo disabled />,
  play: async ({ canvas }) => {
    for (const name of ['Yes', 'No', 'Skip']) {
      await expect(canvas.getByRole('radio', { name })).toBeDisabled();
    }
  },
};
