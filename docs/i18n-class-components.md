# How to provide `t` function to a class component

_Please note: This document is deprecated. Use it only if you have a good reason to do so._

_Explanation: Since React 16.8 you don't need to create class components at all, but use [hooks](https://reactjs.org/docs/hooks-overview.html) in functional components instead. Check out [our main i18n documentation](./i18n.md)._

How to enable translations in a React class component?

## 1. Wrap your component in [`withTranslation`](https://react.i18next.com/latest/withtranslation-hoc) function.

```jsx
import React, { Component } from 'react';

/**
 * Use this one if you want to import the component to Angular
 */
import { withTranslation } from '@/modules/core/client/utils/i18n-angular-load';

/**
 * Use this one for every other case
 */
// import { withTranslation } from 'react-i18next';
// import '@/config/client/i18n'; // sometimes you'll also need to import i18n config

export class MyComponent extends Component {
  // export the unwrapped component if you want to test it
  render() {
    return <div>I am a React component!</div>;
  }
}

export default withTranslation('myNamespace')(MyComponent); // wrap the component and export it (default export)
```

## 2. Add a `t` function to your props (`withTranslation` wrapper provided it)

```jsx
// ...
import PropTypes from 'prop-types';

export class MyComponent extends Component {
  // export the unwrapped component if you want to test it

  constructor(props) {
    super(props);
  }

  render() {
    const { t } = this.props;
    return <div>I am a React component!</div>;
  }
}

MyComponent.propTypes = {
  t: PropTypes.func.isRequired,
  // specify your other props here
};

// ...
```

## 3. Follow the [main documentation](./i18n.md#2-wrap-your-strings-for-translating-in-the-t-function) from step 2.
