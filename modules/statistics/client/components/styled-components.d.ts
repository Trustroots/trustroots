declare module 'styled-components' {
  import * as React from 'react';

  type StyledFactory = (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => React.ComponentType<React.HTMLAttributes<HTMLElement>>;

  const styled: {
    div: StyledFactory;
    li: StyledFactory;
    p: StyledFactory;
    span: StyledFactory;
    ul: StyledFactory;
  };

  export default styled;
}
