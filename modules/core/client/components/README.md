# Reusable components

## Tooltip

`Tooltip` adds a tooltip to its child component.

### Attributes

- `tooltip` - the text or component to display as tooltip
- `placement` - placement of the tooltip (`left`, `top`, `right`, `bottom`)

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
