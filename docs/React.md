# A brief guide to the React migration

If you want get familiar with React, start with the [official site](reactjs.org). It has a nice [tutorial](https://reactjs.org/tutorial/tutorial.html) and [guide](https://reactjs.org/docs/hello-world.html).

## What do we want to achieve?

We want to have separate codebases for server and client. The client will be written in React.

We'll replace the current AngularJS components one by one. Eventually, we'll drop the AngularJS and create a React project. 

### Rationale

- React is more attractive to developers.
- AngularJS is being replaced by newer frameworks.
- [MEAN is not maintained](https://github.com/Trustroots/trustroots/issues/638). 
- React is simple and minimalistic; we won't risk getting stuck with a framework like AngularJS again.
- React is not exotic. There is plenty of tooling and documentation available. Lots of folks are already familiar with React.
- It has the potential to help with [React Native](https://github.com/Trustroots/trustroots-expo-mobile/) implementation of Trustroots. Not necessarily by re-using components but by allowing us to [_"learn once, write everywhere"_](https://www.youtube.com/watch?v=LIeqUPvh8qY).

## How to wire up React components to AngularJS?

Create a react component with a path `modules/**/client/components/SomeName.component.js`. It will get imported to Angular [automatically](/config/webpac). Then you can use this component within Angular like `<some-name></some-name>`.
See an [example component](https://github.com/Trustroots/trustroots/blob/master/modules/pages/client/components/Volunteering.component.js).

## Issues and solutions

### Routing

We're using [UI-Router for AngularJS](https://ui-router.github.io/ng1/).

The different paths (i.e. [`/volunteering`](https://trustroots.org/volunteering)) are configured in `/modules/**/client/config/**.client.routes.js`.
Look at the ([example](https://github.com/Trustroots/trustroots/blob/master/modules/pages/client/config/pages.client.routes.js)) and search for `volunteering` to see how a React component can be added to the router.

## Passing data from Angular to React

If you need to provide data to a React component, you can pass them in attributes. Then they'll be available in the component as props.

In AngularJS view it will look like this:

```html
<profile-view-basics profile="profileCtrl.profile"></profile-view-basics>
```
where `profile-view-basics` is a React component imported into AngularJS. We assume that `profileCtrl` is a variable available in the AngularJS view. (Look for `profile-view-basics` in an [example](https://github.com/Trustroots/trustroots/blob/master/modules/users/client/views/profile/profile-view-basics.client.view.html).)

In React, we use the `profile` in `props`:

```jsx
export default function ProfileViewBasics({ profile }) {
  return (
    <div>
      Username: {{profile.username}}
    </div>
  );
}

// or equivalently, i.e. if you want to use a state

export default class ProfileViewBasics {

  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div>
        Username: {{this.props.profile.username}}
      </div>
    );
  }
}
```

## Testing

Testing is done with `Jasmine` and [`Enzyme`](https://github.com/airbnb/enzyme).

TODO add an example when references are in master.

## Time scale

We'll have a separate React app by the end of 2018 or beginning of 2019.
