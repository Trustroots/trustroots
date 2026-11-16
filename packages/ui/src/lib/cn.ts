import { createCn } from 'cn/config';

/*
 * The `tw:` prefix and theme tokens match ../globals.css. Add a
 * name here whenever that file adds a token used by a Tailwind utility.
 */
export const cn = createCn({
  prefix: 'tw',
  extend: {
    theme: {
      leading: ['base'],
      radius: ['base'],
      spacing: ['control-x', 'control-y'],
    },
  },
});
