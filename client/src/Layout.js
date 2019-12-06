import React from 'react';

import Header from './Header';
import Footer from './Footer';
import { connect } from 'react-redux';

export function Layout({ showHeader, showFooter, children }) {
  return (<>
    {showHeader && <Header />}
    {children}
    {showFooter && <Footer />}
  </>);
}

export default connect(state => ({
  showHeader: state.ui.header,
  showFooter: state.ui.footer
}))(Layout);
