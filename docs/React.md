# A brief guide to the React migration

If you want get familiar with react, start with the [official site](reactjs.org). It has a nice [tutorial](https://reactjs.org/tutorial/tutorial.html) and [guide](https://reactjs.org/docs/hello-world.html).

## What do we want to achieve?

We want to have a separate codebases for server and client. The client will be written in react.

We'll replace the current AngularJS components one by one. Eventually, we'll drop the AngularJS and create a React project. 

### Rationale

- React is more attractive to developers.
- AngularJS is being replaced by newer frameworks.
- MEAN is not maintained. (is that true?)

## How to wire up React components to AngularJS

Create a react component with a path `modules/**/client/components/SomeName.component.js`. It will get imported to Angular automatically. Then you can use this component within Angular like `<some-name></some-name>`.
See an [example component](https://github.com/Trustroots/trustroots/blob/master/modules/pages/client/components/Volunteering.component.js).

## Issues and solutions

### Routing

We're still using AngularJS for routing.

## Time scale

We'll have a separate React app by the end of 2018 or beginning of 2019.
