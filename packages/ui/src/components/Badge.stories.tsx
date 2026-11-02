import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { intents } from '#lib/intent';

import { Badge, type BadgeProps } from './Badge';

const variants: BadgeProps['variant'][] = ['solid', 'outline'];
const sizes: NonNullable<BadgeProps['size']>[] = ['md', 'sm'];

/** Resolves a CSS colour the way the browser paints it, as `rgb(…)`. */
function paint(colour: string) {
  const probe = document.createElement('span');
  probe.style.color = colour;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

const meta = {
  component: Badge,
  args: { children: '3', variant: 'solid', intent: 'danger' },
  argTypes: {
    variant: { control: 'inline-radio', options: variants },
    intent: { control: 'select', options: intents },
    size: { control: 'inline-radio', options: sizes },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A count, like the unread messages counter. */
export const Count: Story = {};

/** The profile tab counts. */
export const ProfileCount: Story = {
  args: { variant: 'outline', intent: 'neutral', size: 'sm', children: '12' },
};

/** The Nostroots badge on a profile. */
export const Tag: Story = {
  args: {
    variant: 'solid',
    intent: 'primary',
    size: 'sm',
    className: 'tw:rounded-full',
    children: 'Nostroots',
  },
};

/**
 * Every variant and size with every intent. Inverse is white, so it sits on
 * the brand colour, as in the mobile navigation.
 */
export const Intents: Story = {
  render: args => (
    <table className="tw:border-separate tw:border-spacing-2">
      <tbody>
        {variants.flatMap(variant =>
          sizes.map(size => (
            <tr key={`${variant}-${size}`}>
              <th scope="row" className="tw:pe-2 tw:text-start">
                {variant} {size}
              </th>
              {intents.map(intent => (
                <td
                  key={intent}
                  className={
                    intent === 'inverse'
                      ? 'tw:bg-brand-primary tw:p-2'
                      : 'tw:p-2'
                  }
                >
                  <Badge
                    {...args}
                    variant={variant}
                    intent={intent}
                    size={size}
                  >
                    {intent}
                  </Badge>
                </td>
              ))}
            </tr>
          )),
        )}
      </tbody>
    </table>
  ),
  play: async ({ canvasElement }) => {
    // Each solid badge is filled with its intent's token, so a missing or
    // misspelt token shows up as a transparent badge.
    const solids = canvasElement.querySelectorAll<HTMLElement>(
      '[data-variant="solid"]',
    );
    await expect(solids).toHaveLength(intents.length * sizes.length);
    for (const badge of solids) {
      const token = getComputedStyle(badge).getPropertyValue('--intent');
      await expect(token.trim()).not.toBe('');
      const background = getComputedStyle(badge).backgroundColor;
      await expect(background).not.toBe('rgba(0, 0, 0, 0)');
      await expect(background).toBe(paint(token));
    }
  },
};
