import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { intents } from '#lib/intent';

import { Button, type ButtonSize, type ButtonVariant } from './Button';

const variants: ButtonVariant[] = ['solid', 'outline', 'ghost', 'link'];
const sizes: ButtonSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
/** The default size, and `xs`, the smallest padding and radius. */
const gridSizes: ButtonSize[] = ['md', 'xs'];

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
  component: Button,
  args: { children: 'Continue', onClick: fn() },
  argTypes: {
    variant: { control: 'inline-radio', options: variants },
    intent: { control: 'select', options: intents },
    size: { control: 'inline-radio', options: sizes },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: solid, inverse (white with brand-green text), medium. */
export const Default: Story = {
  play: async ({ args, canvas }) => {
    const button = canvas.getByRole('button', { name: 'Continue' });
    await expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

export const Primary: Story = { args: { intent: 'primary' } };

/**
 * Every variant with every intent, at the default size and at `xs`. Inverse is
 * white, so it sits on the brand colour, as on the home page.
 */
export const Intents: Story = {
  render: args => (
    <table className="tw:border-separate tw:border-spacing-2">
      <tbody>
        {variants.flatMap(variant =>
          gridSizes.map(size => (
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
                  <Button
                    {...args}
                    variant={variant}
                    intent={intent}
                    size={size}
                  >
                    {intent}
                  </Button>
                </td>
              ))}
            </tr>
          )),
        )}
      </tbody>
    </table>
  ),
  play: async ({ canvasElement }) => {
    // Each solid button is filled with its intent's token, so a missing or
    // misspelt token shows up as a transparent button.
    const solids = canvasElement.querySelectorAll<HTMLElement>(
      '[data-variant="solid"]',
    );
    await expect(solids).toHaveLength(intents.length * gridSizes.length);
    for (const button of solids) {
      const token = getComputedStyle(button).getPropertyValue('--intent');
      await expect(token.trim()).not.toBe('');
      await expect(getComputedStyle(button).backgroundColor).toBe(paint(token));
    }
  },
};

export const Sizes: Story = {
  args: { intent: 'primary' },
  render: args => (
    <div className="tw:flex tw:items-center tw:gap-2">
      {sizes.map(size => (
        <Button key={size} {...args} size={size}>
          {size}
        </Button>
      ))}
    </div>
  ),
  play: async ({ canvas }) => {
    // `xs` keeps Bootstrap's `btn-xs` look, used by the "Help!" links.
    const xs = getComputedStyle(canvas.getByRole('button', { name: 'xs' }));
    await expect(xs.fontSize).toBe('12px');
    await expect(xs.padding).toBe('1px 5px');
    await expect(xs.borderRadius).toBe('2px');
  },
};

/** Icon buttons, such as the guest counter on the hosting form. */
export const Round: Story = {
  args: {
    variant: 'outline',
    intent: 'primary',
    round: true,
    'aria-label': 'Add a guest',
    children: '+',
  },
  render: args => (
    <div className="tw:flex tw:items-center tw:gap-2">
      <Button {...args} size="md" />
      <Button {...args} size="lg" />
    </div>
  ),
};

/** The button look on a link; it stays a link. */
export const AsLink: Story = {
  args: { intent: 'primary' },
  render: args => <Button {...args} render={<a href="#signup" />} />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Continue' })).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

export const Disabled: Story = {
  args: { intent: 'primary', disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button')).toBeDisabled();
  },
};
