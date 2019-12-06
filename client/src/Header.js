import React from 'react';

import { Link } from '@reach/router';

export default function Header() {
  return <header>
    <Link to="/signin">signin</Link>
    <Link to="/signup">signup</Link>
    <Link to="/about">about</Link>
  </header>;
}
