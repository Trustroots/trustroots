# How to provide `t` function to a class component

_Please note: You shouldn't need to use this. Check out [our latest i18n documentation](./i18n.md)_

How to enable translations in a React component?

## 1. Wrap your component in [`withTranslation`](https://react.i18next.com/latest/withtranslation-hoc) function.

```jsx
/**
 * Use this one if you want to import the component to Angular
 */
import { withTranslation } from '@/modules/core/client/utils/i18n-angular-load';

/**
 * Use this one for every other case
 */
// import { withTranslation } from 'react-i18next';
// import '@/config/client/i18n'; // sometimes you'll also need to import i18n config

export function MyComponent(props) { // export the unwrapped component if you want to test it
  return (
    <div>I am a React component!</div>
  );
}

export default withTranslation('myDefaultNamespace')(MyComponent); // wrap the component and export it (default export)
```

## 2. Add a `t` function to your props (`withTranslation` wrapper provided it)

```jsx
// ...
import PropTypes from 'prop-types';

export function MyComponent({ t, ...props }) {
  return (
    <div>I am a React component!</div>
  );
}

MyComponent.propTypes = {
  t: PropTypes.func.isRequired,
  // specify your other props here
}

// ...
```

## 3. Follow the [main documentation](./i18n.md#2-wrap-your-strings-for-translating-in-the-t-function) from step 2.


