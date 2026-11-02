import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';

const meta = {
  component: ButtonGroup,
  args: { role: 'group', 'aria-label': 'Choices' },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: { size: 'lg' },
  render: args => (
    <ButtonGroup {...args}>
      <Button>Yes</Button>
      <Button>Maybe</Button>
      <Button>No</Button>
    </ButtonGroup>
  ),
};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: args => (
    <ButtonGroup {...args}>
      <Button variant="ghost">Streets</Button>
      <Button variant="ghost">Satellite</Button>
    </ButtonGroup>
  ),
};

/** Nested groups sharing the full width, like the search settings. */
export const Justified: Story = {
  args: { justified: true },
  render: args => (
    <ButtonGroup {...args}>
      <ButtonGroup size="lg" role="group">
        <Button>Filters</Button>
      </ButtonGroup>
      <ButtonGroup size="lg" role="group">
        <Button>Map</Button>
      </ButtonGroup>
    </ButtonGroup>
  ),
};
