# Reusable components

## withTooltip

A Higher-Order Component that adds tooltip to a wrapped component.

It adds attributes `tooltip`, `placement` and `tooltipProps` to the wrapped component.

Use it [outside of render function](https://reactjs.org/docs/higher-order-components.html#dont-use-hocs-inside-the-render-method) only!

### Usage

```jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import withTooltip from '@/modules/core/client/components/withTooltip';
import ComponentWithoutTooltip from '@/path/to/ComponentWithoutTooltip';

// define the component with tooltip outside of render function!
// https://reactjs.org/docs/higher-order-components.html#dont-use-hocs-inside-the-render-method
const ComponentWithTooltip = withTooltip(ComponentWithoutTooltip);

export default function Example() {
  const { t } = useTranslation('namespace');
  return (
    <ComponentWithTooltip
      {...originalProps}
      tooltip={t('Tooltip text')}
      placement="top" // (top, left, bottom, right)
      tooltipProps={{ id: 'tooltip-id', className: 'tooltip-class', ...etc }}
    >
      Hello World!
    </ComponentWithTooltip>
  );
}
```
