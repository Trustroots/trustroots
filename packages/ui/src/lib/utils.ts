import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * tailwind-merge needs the `tw:` prefix and the custom theme names from
 * `globals.css` so it can tell which classes conflict. Without them, a caller's
 * `tw:px-0` would not replace a component's `tw:px-control-x`. Add a name here
 * whenever `globals.css` gains a token that utilities use.
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

/** Joins class names and lets later Tailwind utilities win over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
