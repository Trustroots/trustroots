import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * The `tw:` prefix and theme tokens match ../globals.css. Add a
 * name here whenever that file adds a token used by a Tailwind utility.
 */
const twMerge = extendTailwindMerge({
  prefix: 'tw',
  extend: {
    theme: {
      leading: ['base'],
      radius: ['base'],
      spacing: ['control-x', 'control-y'],
    },
  },
});

/** Joins conditional classes and resolves conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
