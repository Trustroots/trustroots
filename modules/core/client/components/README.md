# Reusable components

## Tooltip

`Tooltip` adds a tooltip to its child component.

### Attributes

- `tooltip` - the text or component to display as tooltip _(required)_
- `placement` - placement of the tooltip (`left`, `top`, `right`, `bottom`) _(default: `'top'`)_
- `hidden` - when set to `true`, the tooltip is not rendered _(default: `false`)_

### Usage

```jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '@/modules/core/client/components/Tooltip';
import ComponentWithoutTooltip from '@/path/to/ComponentWithoutTooltip';

export default function Example() {
  const { t } = useTranslation('namespace');
  return (
    <Tooltip
      tooltip={t('Tooltip text')}
      placement="top"
      id="tooltip-id"
      className="tooltip-class"
    >
      <ComponentWithoutTooltip />
    </Tooltip>
  );
}
```
