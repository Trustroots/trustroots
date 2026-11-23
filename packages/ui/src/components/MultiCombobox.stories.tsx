import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MultiCombobox } from './MultiCombobox';

const languages = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
];

function Example() {
  const [value, setValue] = useState(languages.slice(0, 1));
  const [query, setQuery] = useState('');
  return (
    <MultiCombobox
      aria-label="Languages"
      items={languages}
      filteredItems={languages.filter(option =>
        option.label.toLowerCase().includes(query.toLowerCase()),
      )}
      value={value}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={setValue}
      emptyMessage="No matches"
      removeLabel={option => `Remove ${option.label}`}
      placeholder="Select languages"
    />
  );
}

const meta = {
  title: 'Components/MultiCombobox',
  component: Example,
} satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Multiple = {
  play: async ({ canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.type(
      canvas.getByRole('combobox', { name: 'Languages' }),
      'Fr',
    );
    await expect(
      await page.findByRole('option', { name: 'French' }),
    ).toBeVisible();
    await userEvent.keyboard('{Enter}');
    await expect(
      canvas.getByRole('button', { name: 'Remove French' }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Remove English' }),
    );
    await expect(
      canvas.queryByRole('button', { name: 'Remove English' }),
    ).not.toBeInTheDocument();
  },
} satisfies Story;
