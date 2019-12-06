import React from 'react';
import { Router } from '@reach/router';
import { withoutHeader, withoutFooter } from './without';
import Signin from './Signin';
import Signup from './Signup';
import NotFound from './NotFound';
import About from './About';

const SigninN = withoutHeader(withoutFooter(Signin));
const SignupN = withoutHeader(withoutFooter(Signup));
const NotFoundN = withoutHeader(withoutFooter(NotFound));

export default function Routes() {
  return (
    <Router>
      <NotFoundN default />
      <SigninN path="/signin" />
      <SignupN path="/signup" />
      <About path="/about" />
    </Router>
  );
}
